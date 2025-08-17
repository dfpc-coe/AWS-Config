import cf from '@openaddresses/cloudfriend';
import fs from 'node:fs'

export default {
    Resources: {
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
        },
        RequiredTagsRemediation: {
            Type: "AWS::Events::Rule",
            Properties: {
                Description: "Invoke Lambda to AddTags to NON_COMPLIANT resources from CONFIG rule",
                EventPattern: {
                    source: [ "aws.config" ],
                    "detail-type": [ "AWS API Call via CloudTrail" ],
                    detail: {
                        eventSource: [ "config.amazonaws.com" ],
                        eventName: [ "PutEvaluations" ],
                        requestParameters: {
                            evaluations: {
                                complianceType: [ "NON_COMPLIANT" ]
                            }
                        },
                        additionalEventData: {
                            managedRuleIdentifier: [ "REQUIRED_TAGS" ]
                        }
                    }
                },
                State: "ENABLED",
                Targets: [{
                    Arn: cf.getAtt("RequiredTagsRemediationFunction", "Arn"),
                    Id: 'LambdaInvoke'
                }]
            }
        },
        RequiredTagsRemediateFunctionInvokePermission: {
            Type: 'AWS::Lambda::Permission',
            Properties: {
                FunctionName: cf.getAtt('RequiredTagsRemediationFunction', 'Arn'),
                Action: 'lambda:InvokeFunction',
                Principal: 'events.amazonaws.com',
                SourceArn: cf.getAtt('RequiredTagsRemediation', 'Arn')
            }
        },
        RequiredTagsRemediationFunction: {
            Type: "AWS::Lambda::Function",
            Properties: {
                FunctionName: cf.join([cf.stackName, '-Remediate-Required-Tags']),
                Description: 'Fix Required Tags where possible',
                Environment: {
                    Variables: {
                        AWS_ACCOUNT_ID: cf.accountId,
                    }
                },
                Handler: 'index.handler',
                Role: cf.getAtt("RequiredTagsRemediationRole", "Arn"),
                Runtime: "nodejs22.x",
                MemorySize: 128,
                Timeout: 180,
                Code: {
                    ZipFile: String(fs.readFileSync(new URL('../../remediations/required-tags.cjs', import.meta.url)))
                }
            }
        },
        RequiredTagsRemediationRole: {
            Type: "AWS::IAM::Role",
            Properties: {
                AssumeRolePolicyDocument: {
                    Version: "2012-10-17",
                    Statement: [{
                        Effect: "Allow",
                        Principal: {
                            Service: ["lambda.amazonaws.com"]
                        },
                        Action: "sts:AssumeRole"
                    }]
                },
                ManagedPolicyArns: [ "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" ],
                Policies: [{
                    PolicyName: cf.join([cf.stackName, "-Required-Tags-Remediation"]),
                    PolicyDocument: {
                        Version: "2012-10-17",
                        Statement: [{
                            Effect: "Allow",
                            Action: [
                                "ec2:DescribeNetworkInterfaces",
                                "ec2:DescribeVpcs",
                                "ec2:DescribeVolumes",
                                "ec2:DescribeInstances",
                                "ec2:CreateTags"
                            ],
                            "Resource": "*"
                        }]
                    }
                }]
            }
        },
    }
}
