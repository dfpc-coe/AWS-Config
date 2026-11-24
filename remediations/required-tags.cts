import {
    CreateTagsCommand,
    DescribeInstancesCommand,
    DescribeNetworkInterfacesCommand,
    DescribeVolumesCommand,
    DescribeVpcsCommand,
    EC2Client
} from '@aws-sdk/client-ec2';
import type { Tag } from '@aws-sdk/client-ec2';

interface Evaluation {
    complianceType?: string;
    complianceResourceType?: string;
    complianceResourceId?: string;
}

interface PutEvaluationsEvent {
    version?: string;
    source?: string;
    detail?: {
        requestParameters?: {
            evaluations?: Evaluation[];
        };
    };
}

function inheritableTags(tags: Tag[] | undefined): Tag[] {
    return (tags ?? []).filter((tag) => {
        return tag.Key !== undefined
            && tag.Key !== ''
            && !tag.Key.startsWith('Name')
            && !tag.Key.startsWith('aws:')
            && tag.Value !== undefined;
    });
}

async function requiredTagENI(ec2: EC2Client, eniId: string): Promise<void> {
    const eniRes = await ec2.send(new DescribeNetworkInterfacesCommand({
        NetworkInterfaceIds: [eniId]
    }));

    const eni = eniRes.NetworkInterfaces?.[0];
    if (eni?.VpcId === undefined) {
        throw new Error(`Network interface ${eniId} not found`);
    }

    const vpcRes = await ec2.send(new DescribeVpcsCommand({
        VpcIds: [eni.VpcId]
    }));

    const vpc = vpcRes.Vpcs?.[0];
    if (vpc === undefined) {
        throw new Error(`VPC ${eni.VpcId} not found`);
    }

    console.log(`VPC ${eni.VpcId} has ${vpc.Tags?.length ?? 0} tags`);

    const tags = inheritableTags(vpc.Tags);
    if (tags.length > 0) {
        await ec2.send(new CreateTagsCommand({
            Resources: [eniId],
            Tags: tags
        }));

        console.log(`Applied ${tags.length} tags to network interface ${eniId}`);
    }
}

async function requiredTagVolume(ec2: EC2Client, volumeId: string): Promise<void> {
    const volumeRes = await ec2.send(new DescribeVolumesCommand({
        VolumeIds: [volumeId]
    }));

    const volume = volumeRes.Volumes?.[0];
    if (volume === undefined) {
        throw new Error(`Volume ${volumeId} not found`);
    }

    const instanceId = volume.Attachments?.[0]?.InstanceId;
    if (instanceId === undefined) {
        console.log('not ok - Volume is not attached to any instance, cannot copy tags');
        return;
    }

    console.log(`Volume attached to instance: ${instanceId}`);

    const instanceRes = await ec2.send(new DescribeInstancesCommand({
        InstanceIds: [instanceId]
    }));

    const instance = instanceRes.Reservations?.[0]?.Instances?.[0];
    if (instance === undefined) {
        throw new Error(`Instance ${instanceId} not found`);
    }

    const tags = inheritableTags(instance.Tags);
    if (tags.length > 0) {
        await ec2.send(new CreateTagsCommand({
            Resources: [volumeId],
            Tags: tags
        }));

        console.log(`Applied ${tags.length} tags to volume ${volumeId}`);
    }
}

async function remediate(ec2: EC2Client, evaluation: Evaluation): Promise<void> {
    const { complianceResourceType: type, complianceResourceId: id } = evaluation;

    if (id !== undefined && type === 'AWS::EC2::Volume') {
        await requiredTagVolume(ec2, id);
    } else if (id !== undefined && type === 'AWS::EC2::NetworkInterface') {
        await requiredTagENI(ec2, id);
    } else {
        console.log(`Unsupported resource type: ${type} -- ${id}`);
    }
}

export async function handler(event: PutEvaluationsEvent): Promise<void> {
    if (event.version !== '0') {
        throw new Error('Unsupported Event Version');
    } else if (event.source !== 'aws.config') {
        throw new Error('Unsupported Event Source');
    }

    const evaluations = event.detail?.requestParameters?.evaluations;
    if (evaluations === undefined) {
        throw new Error('Invalid Event Detail');
    }

    const ec2 = new EC2Client({ region: process.env.AWS_REGION });
    const errs: Error[] = [];

    for (const evaluation of evaluations) {
        if (evaluation.complianceType !== 'NON_COMPLIANT') continue;

        try {
            await remediate(ec2, evaluation);
        } catch (err) {
            console.error(err);
            errs.push(err instanceof Error ? err : new Error(String(err)));
        }
    }

    if (errs.length > 0) {
        throw new Error(`Errors occurred while processing: ${errs.map((e) => e.message).join(', ')}`);
    }
}
