import {
    ConfigServiceClient,
    DescribeConfigRulesCommand,
    GetComplianceDetailsByConfigRuleCommand
} from '@aws-sdk/client-config-service';
import type { EvaluationResult } from '@aws-sdk/client-config-service';
import { PublishBatchCommand, SNSClient } from '@aws-sdk/client-sns';
import type { PublishBatchRequestEntry } from '@aws-sdk/client-sns';

const ENABLED_URGENT_RULES = new Set([
    'Required-Tags',
    'Restricted-SSH',
    'Cloudformation-Drift',
    'ECS-Service-Execute-Disabled',
    'Certificate-Expiration'
]);

async function listRuleNames(config: ConfigServiceClient): Promise<string[]> {
    const names: string[] = [];

    let NextToken: string | undefined;
    do {
        const res = await config.send(new DescribeConfigRulesCommand({ NextToken }));

        for (const rule of res.ConfigRules ?? []) {
            if (rule.ConfigRuleName !== undefined) names.push(rule.ConfigRuleName);
        }

        ({ NextToken } = res);
    } while (NextToken !== undefined);

    return names;
}

function toEntry(result: EvaluationResult): PublishBatchRequestEntry | undefined {
    const qualifier = result.EvaluationResultIdentifier?.EvaluationResultQualifier;
    const resourceId = qualifier?.ResourceId;
    const ruleName = qualifier?.ConfigRuleName;

    if (qualifier === undefined || resourceId === undefined || ruleName === undefined) return undefined;

    let displayId = resourceId;
    if (displayId.startsWith('arn')) {
        displayId = displayId.replace(/.*:/, '').replaceAll('/', ':');
    }

    // Cloudformation created LoadBalancers do not propagate tags from ALB => ENI
    if (ruleName === 'Required-Tags' && displayId.startsWith('eni-')) return undefined;

    return {
        Id: (resourceId.split(':').pop() ?? resourceId).replaceAll(/[^a-zA-Z0-9]/g, '-'),
        Subject: `ALARM: "${process.env.AWS_ACCOUNT_ID}:${ruleName}:${displayId}"`.slice(0, 100),
        Message: `A Resource (${qualifier.ResourceType}) with ARN ${resourceId} is violating the ${ruleName} rule`
    };
}

async function publishViolations(
    config: ConfigServiceClient,
    sns: SNSClient,
    ruleName: string
): Promise<Error[]> {
    const errs: Error[] = [];

    let NextToken: string | undefined;
    do {
        const res = await config.send(new GetComplianceDetailsByConfigRuleCommand({
            NextToken,
            ConfigRuleName: ruleName,
            ComplianceTypes: ['NON_COMPLIANT'],
            Limit: 10
        }));

        const results = res.EvaluationResults ?? [];
        console.log(`ok - ${ruleName}: ${results.length} violations`);

        const entries = results
            .map((result) => toEntry(result))
            .filter((entry) => entry !== undefined);

        if (entries.length > 0) {
            console.log(`ok - ${ruleName}: publishing ${entries.length} filtered violations to SNS`);

            try {
                const published = await sns.send(new PublishBatchCommand({
                    TopicArn: process.env.TopicArn,
                    PublishBatchRequestEntries: entries
                }));

                for (const failed of published.Failed ?? []) {
                    errs.push(new Error(failed.Message ?? failed.Code));
                }
            } catch (err) {
                console.error(err);
                errs.push(err instanceof Error ? err : new Error(String(err)));
            }
        }

        ({ NextToken } = res);
    } while (NextToken !== undefined);

    return errs;
}

export async function handler(): Promise<void> {
    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
    const config = new ConfigServiceClient({ region });
    const sns = new SNSClient({ region });

    const errs: Error[] = [];

    for (const ruleName of await listRuleNames(config)) {
        if (!ENABLED_URGENT_RULES.has(ruleName)) {
            console.log(`ok - skipping ${ruleName}`);
            continue;
        }

        console.log(`ok - checking ${ruleName}`);
        errs.push(...await publishViolations(config, sns, ruleName));
    }

    if (errs.length > 0) {
        console.error(JSON.stringify(errs.map((e) => e.message)));
        throw new Error('One or more errors took place');
    }
}
