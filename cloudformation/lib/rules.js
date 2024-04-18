import cf from '@openaddresses/cloudfriend';

const resources = {
    Resources: {
        CloudformationDrift: {
            Type: "AWS::Config::ConfigRule",
            Properties: {
                ConfigRuleName: "Cloudformation-Drift",
                Description: "This rule ensures cloudformation templates don't drift",
                InputParameters: {
                    cloudformationRoleArn: cf.getAtt('CloudformationDriftRole', 'Arn')
                },
                MaximumExecutionFrequency: 'One_Hour',
                Scope: {
                    ComplianceResourceTypes: [ 'AWS::CloudFormation::Stack' ],
                },
                Source: {
                    SourceIdentifier: 'CLOUDFORMATION_STACK_DRIFT_DETECTION_CHECK',
                    Owner: "AWS"
                }
            }
        },
        CloudformationDriftRole: {
            Type: "AWS::IAM::Role",
            Properties: {
                RoleName: cf.join([cf.stackName, '-', cf.region, '-cloudformation-drift']),
                Description: "IAM role for AWS Config to access CloudFormation drift detection",
                AssumeRolePolicyDocument: {
                    Version: "2012-10-17",
                    Statement: [{
                        Effect: "Allow",
                        Principal: {
                            Service: "config.amazonaws.com"
                        },
                        Action: ["sts:AssumeRole"]
                    }]
                },
                Policies: [{
                    PolicyName: cf.join([cf.stackName, '-', cf.region, '-cloudformation-drift']),
                    PolicyDocument: {
                        Version: "2012-10-17",
                        Statement: [{
                            Effect: "Allow",
                            Action: [
                                'cloudformation:DetectStackResourceDrift',
                                'cloudformation:DetectStackDrift',
                                'cloudformation:DescribeStackDriftDetectionStatus'
                            ],
                            Resource: cf.join(['arn:', cf.partition, ':cloudformation:', cf.region, ':', cf.accountId, ':*'])
                        }]
                    },
                }]
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
