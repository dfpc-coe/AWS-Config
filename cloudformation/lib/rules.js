import cf from '@openaddresses/cloudfriend';

const resources = {
    Resources: {
        ECSRestrictedExecute: {
            Type: "AWS::Config::ConfigRule",
            Properties: {
                ConfigRuleName: 'ECS-Service-Execute-Disabled',
                Scope: {
                    ComplianceResourceTypes: [ "AWS::ECS::Service" ]
                },
                Source: {
                    "Owner": "CUSTOM_POLICY",
                    SourceDetails: [{
                        EventSource: "aws.config",
                        MessageType: "ConfigurationItemChangeNotification"
                    },{
                        EventSource: "aws.config",
                        MessageType: "OversizedConfigurationItemChangeNotification"
                    }],
                    CustomPolicyDetails: {
                        PolicyRuntime: "guard-2.x.x",
                        PolicyText: `
                            rule ecs_service_execute_disabled
                                when
                                    resourceType == "AWS::ECS::Service"
                            {
                                configuration.EnableExecuteCommand == false
                            }
                        `,
                        EnableDebugLogDelivery: false
                    }
                },
                EvaluationModes: [{
                    Mode: "DETECTIVE"
                }]
            }
        },
        OpenSsh: {
            Type: "AWS::Config::ConfigRule",
            Properties: {
                ConfigRuleName: 'Restricted-SSH',
                Description: "Ensure's SSH Ports are not fully open",
                EvaluationModes: [{ Mode: 'DETECTIVE' }],
                Scope: {
                    ComplianceResourceTypes: [ 'AWS::EC2::SecurityGroup' ],
                },
                Source: {
                    SourceIdentifier: 'INCOMING_SSH_DISABLED',
                    Owner: 'AWS'
                }
            }
        },
        CertificateExpiration: {
            Type: "AWS::Config::ConfigRule",
            Properties: {
                ConfigRuleName: 'Certificate-Expiration',
                Description: "Ensure's ACM Certificates are not about to expire",
                InputParameters: {
                    daysToExpiration: 15
                },
                MaximumExecutionFrequency: 'TwentyFour_Hours',
                Scope: {
                    ComplianceResourceTypes: [ 'AWS::CertificateManager::Certificate' ],
                },
                Source: {
                    SourceIdentifier: 'ACM_CERTIFICATE_EXPIRATION_CHECK',
                    Owner: 'AWS'
                }
            }
        },
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
            Type: 'AWS::IAM::Role',
            Properties: {
                RoleName: cf.join([cf.stackName, '-', cf.region, '-cloudformation-drift']),
                Description: "IAM role for AWS Config to access CloudFormation drift detection",
                AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [{
                        Effect: 'Allow',
                        Principal: {
                            Service: 'config.amazonaws.com'
                        },
                        Action: ['sts:AssumeRole']
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
                }],
                ManagedPolicyArns: [cf.join(['arn:', cf.partition, ':iam::aws:policy/ReadOnlyAccess'])]
            }
        },
    }
};

export default resources;
