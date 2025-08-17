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
        HighUrgencyAlarmTopic: {
            Type: 'AWS::SNS::Topic',
            Properties: {
                DisplayName: cf.join([cf.stackName, '-high-urgency']),
                TopicName: cf.join([cf.stackName, '-high-urgency'])
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
                }],
                ManagedPolicyArns: [
                    cf.join(['arn:', cf.partition, ':iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'])
                ]
            }
        },
        EventFunctionLogs: {
            Type: 'AWS::Logs::LogGroup',
            Properties: {
                LogGroupName: cf.join(['/aws/lambda/', cf.stackName]),
                RetentionInDays: 7
            }
        },
        EventFunctionInvoke: {
            Type: 'AWS::Lambda::Permission',
            Properties: {
                FunctionName: cf.getAtt('EventFunction', 'Arn'),
                Action: 'lambda:InvokeFunction',
                Principal: 'events.amazonaws.com',
                SourceArn: cf.getAtt('EventRule', 'Arn')
            }
        },
        EventFunctionNoInvocationsAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join([cf.stackName, '-errors']),
                ActionsEnabled: true,
                AlarmActions: [ cf.ref('HighUrgencyAlarmTopic') ],
                MetricName: 'Errors',
                Namespace: 'AWS/Lambda',
                Statistic: 'Maximum',
                Dimensions: [{
                    Name: 'FunctionName',
                    Value: cf.stackName
                }],
                Period: 60,
                EvaluationPeriods: 3,
                Threshold: 0,
                ComparisonOperator: 'LessThanOrEqualToThreshold',
                TreatMissingData: 'missing'
            }
        },
        EventFunctionNoInvocationsAlarm: {
            Type: 'AWS::CloudWatch::Alarm',
            Properties: {
                AlarmName: cf.join([cf.stackName, '-no-invocations']),
                ActionsEnabled: true,
                AlarmActions: [ cf.ref('HighUrgencyAlarmTopic') ],
                MetricName: 'Invocations',
                Namespace: 'AWS/Lambda',
                Statistic: 'Maximum',
                Dimensions: [{
                    Name: 'FunctionName',
                    Value: cf.stackName
                }],
                Period: 60,
                EvaluationPeriods: 3,
                Threshold: 0,
                ComparisonOperator: 'LessThanOrEqualToThreshold',
                TreatMissingData: 'missing'
            }
        },
        EventFunction: {
            Type: 'AWS::Lambda::Function',
            DependsOn: ['EventFunctionLogs'],
            Properties: {
                FunctionName: cf.stackName,
                Description: 'Check AWS Config Rules and check for violations',
                MemorySize: 128,
                Runtime: 'nodejs22.x',
                Role: cf.getAtt('EventFunctionRole', 'Arn'),
                Handler: 'index.handler',
                Timeout: 30,
                Environment: {
                    Variables: {
                        AWS_ACCOUNT_ID: cf.accountId,
                        TopicArn: cf.ref('EventNotify')
                    }
                },
                Code: {
                    ZipFile: String(fs.readFileSync(new URL('../../index.cjs', import.meta.url)))
                }
            }
        }
    }
};

export default resources;
