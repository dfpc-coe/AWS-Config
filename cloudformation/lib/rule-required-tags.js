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
            Type: "AWS::Config::RemediationConfiguration",
            Properties: {
                ConfigRuleName: 'Required-Tags',
                TargetType: 'SSM_DOCUMENT',
                TargetId: 'AWS-ExecuteLambdaFunction',
                TargetVersion: '1',
                Parameters: {
                    ResourceId: {
                        ResourceValue: {
                            Value: 'RESOURCE_ID'
                        }
                    }
                },
                Automatic: true,
                MaximumAutomaticAttempts: 1,
                RetryAttemptSeconds: 60,
                ResourceType: 'AWS::EC2::Volume'
            }
        },
        RequiredTagsRemediateFunctionInvokePermission: {
            Type: 'AWS::Lambda::Permission',
            Properties: {
                FunctionName: cf.ref('RequiredTagsRemediationFunction'),
                Action: 'lambda:InvokeFunction',
                Principal: 'config.amazonaws.com',
                SourceAccount: cf.accountId,
            }
        },
        RequiredTagsRemediationFunction: {
            Type: "AWS::Lambda::Function",
            Properties: {
                Handler: "lambda_function.handler",
                Role: cf.getAtt("RequiredTagsRemediationRole", "Arn"),
                Runtime: "nodejs22.x",
                Timeout: 180,
                Code: {
                    ZipFile: String(fs.readFileSync(new URL('../../remediations/required-tags-vol.cjs', import.meta.url)))
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
