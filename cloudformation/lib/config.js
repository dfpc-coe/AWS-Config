import cf from '@openaddresses/cloudfriend';
import fs from 'node:fs';

const resources = {
    Resources: {
        EventNotify: {
            Type: 'AWS::SNS::Topic',
            Properties: {
                TopicName: cf.stackName,
                DisplayName: cf.stackName
            }
        },
        EventRule: {
            Type: 'AWS::Events::Rule',
            Properties: {
                Name: cf.stackName,
                State: 'ENABLED',
                Description: 'Check AWS Config Rules and check for violations',
                ScheduleExpression: 'rate(5 minutes)',
                Targets: [{
                    Id: 'ConfigChecker',
                    Arn: cf.getAtt('EventFunction', 'Arn')
                }]
            }
        },
        EventFunctionRole: {
            Type: 'AWS::IAM::Role',
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }]
                },
                Policies: [{
                    PolicyName: cf.stackName,
                    PolicyDocument: {
                        Statement: [{
                            Effect: 'Allow',
                            Resource: '*',
                            Action: [
                                'config:DescribeConfigRules',
                                'config:GetComplianceDetailsByConfigRule',
                                'config:DescribeComplianceByConfigRule'
                            ]
                        },{
                            Effect: 'Allow',
                            Resource: [ cf.ref('EventNotify')],
                            Action: ['sns:Publish']
                        }]
                    }
                }]
            }
        },
        EventFunctionLogs: {
            Type: 'AWS::Logs::LogGroup',
            Properties: {
                LogGroupName: cf.join(['/aws/lambda/', cf.stackName]),
                RetentionInDays: 7
            }
        },
        EventFunction: {
            Type: 'AWS::Lambda::Function',
            DependsOn: ['EventFunctionLogs'],
            Properties: {
                FunctionName: cf.stackName,
                Description: 'Check AWS Config Rules and check for violations',
                MemorySize: 128,
                Runtime: 'nodejs20.x',
                Role: cf.getAtt('EventFunctionRole', 'Arn'),
                Handler: 'index.handler',
                Timeout: 30,
                Environment: {
                    Variables: {
                        AWS_REGION: cf.region,
                        AWS_ACCOUNT_ID: cf.accountId,
                        TopicArn: cf.ref('EventNotify')
                    }
                },
                Code: {
                    ZipFile: String(fs.readFileSync(new URL('../../index.js', import.meta.url)))
                }
            }
        },
        RequiredTags: {
            Type: "AWS::Config::ConfigRule",
            Properties: {
                ConfigRuleName: "Required-Tags",
                Description: "This rule ensures resources have required tags",
                InputParameters: {
                    tag1Key: "Project",
                    tag2Key: "Client",
                    tag3Key: "Owner"
                },
                EvaluationModes: [{ Mode: 'DETECTIVE' }],
                Source: {
                    SourceIdentifier: 'REQUIRED_TAGS',
                    Owner: "AWS"
                }
            }
        }
    }
};

export default resources;
