declare module '@openaddresses/cloudfriend' {
    type CFValue = string | object;

    interface Template {
        Description?: string;
        Parameters?: Record<string, object>;
        Resources?: Record<string, {
            Type: string;
            DependsOn?: string[];
            Properties?: Record<string, unknown>;
        }>;
    }

    interface CloudFriend {
        accountId: object;
        partition: object;
        region: object;
        stackName: object;
        ref(resource: string): object;
        getAtt(resource: string, attribute: string): object;
        join(delimiter: string, values: CFValue[]): object;
        join(values: CFValue[]): object;
        merge(...templates: Template[]): Required<Template>;
    }

    const cf: CloudFriend;
    export default cf;
    export type { Template };
}
