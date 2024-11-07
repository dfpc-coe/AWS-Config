const Config = require('@aws-sdk/client-config-service');
const SNS = require('@aws-sdk/client-sns');

const Enabled_Urgent_Rules = [
    'Required-Tags',
    'Restricted-SSH',
    'Cloudformation-Drift',
    'ECS-Service-Execute-Disabled',
    'Certificate-Expiration'
];

async function handler() {
    const config = new Config.ConfigServiceClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION });
    const sns = new SNS.SNSClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION });

    const rules = await config.send(new Config.DescribeConfigRulesCommand({}));

    const errs = [];

    for (const rule of rules.ConfigRules) {
        if (!Enabled_Urgent_Rules.includes(rule.ConfigRuleName)) {
            console.log(`ok - skipping ${rule.ConfigRuleName}`);
            continue;
        } else {
            console.log(`ok - checking ${rule.ConfigRuleName}`);
        }

        let res = {};
        do {
            res = await config.send(new Config.GetComplianceDetailsByConfigRuleCommand({
                NextToken: res.NextToken,
                ConfigRuleName: rule.ConfigRuleName,
                ComplianceTypes: ['NON_COMPLIANT']
            }));

            console.log(`ok - ${rule.ConfigRuleName}: ${res.EvaluationResults.length} violations`);
            if (res.EvaluationResults.length) {
                try {
                    const PublishBatchRequestEntries = res.EvaluationResults.map((e) => {
                        const f = e.EvaluationResultIdentifier.EvaluationResultQualifier;

                        let ResourceId = f.ResourceId;
                        if (ResourceId.startsWith('arn')) {
                            ResourceId = ResourceId.replace(/.*:/, '').replace(/\//g, ':')
                        }

                        return {
                            Id: f.ResourceId.split(':').pop().replace(/[^a-zA-Z0-9]/g, '-'),
                            Subject: `ALARM: \"${process.env.AWS_ACCOUNT_ID}:${f.ConfigRuleName}:${ResourceId}\"`.slice(0, 100),
                            Message: `A Resource (${f.ResourceType}) with ARN ${f.ResourceId} is violating the ${f.ConfigRuleName} rule`
                        };
                    }).filter((e) => {
                        if (rule.ConfigRuleName === 'Required-Tags') {
                            // TODO: Remove once Cloudformation created LoadBalancers propagate tags from ALB => ENI
                            return !e.Subject.includes('Required-Tags:eni-')
                        }

                        return true;
                    });

                    if (PublishBatchRequestEntries.length) {
                        console.log(`ok - ${rule.ConfigRuleName}: publishing ${PublishBatchRequestEntries.length} filtered violations to SNS`);

                        const res = await sns.send(new SNS.PublishBatchCommand({
                            TopicArn: process.env.TopicArn,
                            PublishBatchRequestEntries
                        }));

                        for (const err of (res.Failed || [])) {
                            errs.push(new Error(err.Message))
                        }
                    }
                } catch (err) {
                    console.error(err);
                    errs.push(err);
                }
            }
        } while (res.NextToken);
    }

    if (errs.length) {
        console.error(JSON.stringify(errs.map((e) => { return e.message })));
        throw new Error('One or more errors took place');
    }
}

module.exports = {
    handler
};
