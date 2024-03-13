const Config = require('@aws-sdk/client-config-service');
const SNS = require('@aws-sdk/client-sns');
const { randomUUID } = require('node:crypto');

async function handler() {
    const config = new Config.ConfigServiceClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION });
    const sns = new SNS.SNSClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION });

    const rules = await config.send(new Config.DescribeConfigRulesCommand({}));

    for (const rule of rules.ConfigRules) {
        let res = {}
        do {
            res = await config.send(new Config.GetComplianceDetailsByConfigRuleCommand({
                NextToken: res.NextToken,
                ConfigRuleName: rule.ConfigRuleName,
                ComplianceTypes: ['NON_COMPLIANT']
            }));

            if (res.EvaluationResults.length) {
                await sns.send(new SNS.PublishBatchCommand({
                    TopicArn: process.env.TopicArn,
                    PublishBatchRequestEntries: res.EvaluationResults.map((e) => {
                        const f = e.EvaluationResultIdentifier.EvaluationResultQualifier;
                        return {
                            Id: f.ResourceId.replace(':', '-'),
                            Subject: `ALARM: \"${f.ConfigRuleName}:${f.ResourceId}\"`,
                            Message: `A Resource (${f.ResourceType}) with ARN ${f.ResourceId} is violating the ${f.ConfigRuleName} rule`
                        };
                    })
                }));
            }
        } while (res.NextToken)

        return true;
    }
}

module.exports = {
    handler
};
