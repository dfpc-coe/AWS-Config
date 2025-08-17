exports.handler = async (event) => {
    if (event.version !== '0') {
        throw new Error('Unsupported Event Version');
    } else if (event.source !== 'aws.config') {
        throw new Error('Unsupported Event Source');
    } else if (!event.detail || !event.detail.requestParameters || !event.detail.requestParameters.evaluations) {
        throw new Error('Invalid Event Detail');
    }

    for (const eval of event.detail.requestParameters.evaluations) {
        if (eval.complianceType !== 'NON_COMPLIANT') continue;

        if (eval.complianceResourceType === 'AWS::EC2::Volume') {
            requiredTagVolume(eval.complianceResourceId);
        } else  {
            console.log(`Unsupported resource type: ${eval.complianceResourceType} -- ${eval.complianceResourceId}`);
        }
    }

};

async function requiredTagVolume(volumeId) {
    const { EC2Client, DescribeInstancesCommand, CreateTagsCommand, DescribeVolumesCommand } = require('@aws-sdk/client-ec2');

    const ec2Client = new EC2Client({ region: process.env.AWS_REGION });

    const volumeData = await ec2Client.send(new DescribeVolumesCommand({
        VolumeIds: [volumeId]
    }));

    const volume = volumeData.Volumes[0];

    if (!volume.Attachments || volume.Attachments.length === 0) {
        console.log('not ok - Volume is not attached to any instance, cannot copy tags');
        return;
    }

    const instanceId = volume.Attachments[0].InstanceId;
    console.log(`Volume attached to instance: ${instanceId}`);

    const instanceData = await ec2Client.send(new DescribeInstanceCommand({
        InstanceIds: [instanceId]
    }));

    const instance = instanceData.Reservations[0].Instances[0];
    const instanceTags = instance.Tags || [];

    // Filter tags to apply (exclude AWS system tags)
    const tagsToApply = instanceTags.filter(tag =>
        tag.Key &&
        !tag.Key.startsWith('aws:') &&
        tag.Value !== undefined
    );

    if (tagsToApply.length > 0) {
        await ec2Client.send(new CreateTagsCommand({
            Resources: [volumeId],
            Tags: tagsToApply
        }))

        console.log(`Applied ${tagsToApply.length} tags to volume ${volumeId}`);
    }
}
