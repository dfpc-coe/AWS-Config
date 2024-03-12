import cf from '@openaddresses/cloudfriend';

const resources = {
    Parameters: {
        RoleName: {
            Description: 'Name of the Role to associate with ConfigRecorded',
            Default: 'aws-controltower-ConfigRecorderRole',
            Type: 'String'
        }
    },
    Resources: {
        RequiredTags: {
            "Type": "AWS::Config::ConfigRule",
            "Properties": {
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
