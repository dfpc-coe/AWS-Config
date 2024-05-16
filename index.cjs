const Config = require('@aws-sdk/client-config-service');
const SNS = require('@aws-sdk/client-sns');

const Enabled_Urgent_Rules = [
    'Required-Tags',
    'Cloudformation-Drift',
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
                    await sns.send(new SNS.PublishBatchCommand({
                        TopicArn: process.env.TopicArn,
                        PublishBatchRequestEntries: res.EvaluationResults.map((e) => {
                            const f = e.EvaluationResultIdentifier.EvaluationResultQualifier;
                            return {
                                Id: f.ResourceId.split(':').pop().replace(/[^a-zA-Z0-9]/g, '-'),
                                Subject: `ALARM: \"${f.ConfigRuleName}:${f.ResourceId}\" - Account: ${process.env.AWS_ACCOUNT_ID}`,
                                Message: `A Resource (${f.ResourceType}) with ARN ${f.ResourceId} is violating the ${f.ConfigRuleName} rule`
                            };
                        }).filter((e) => {
                            if (rule.ConfigRuleName === 'Required-Tags') {
                                // TODO: Remove once Cloudformation created LoadBalancers propagate tags from ALB => ENI
                                return !e.Subject.includes('Required-Tags:eni-')
                            }

                            return true;
                        })
                    }));
                } catch (err) {
                    console.error(err);
                    errs.push(err);
                }
            }
        } while (res.NextToken);
    }

    if (errs.length) throw new Error('One or more errors took place');
}

module.exports = {
    handler
};
