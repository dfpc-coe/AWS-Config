import test from 'node:test';
import assert from 'node:assert/strict';
import template from '../cloudformation/AWS-Config.template.js';

interface Statement {
    Action: string[];
    Resource: Array<{ 'Fn::Join': [string, unknown[]] }>;
}

function properties(name: string): Record<string, unknown> {
    const props = template.Resources[name]?.Properties;
    assert.ok(props, `${name} is defined`);
    return props;
}

test('checker function alarms', () => {
    const errors = properties('EventFunctionErrorsAlarm');
    assert.equal(errors.MetricName, 'Errors');
    assert.equal(errors.ComparisonOperator, 'GreaterThanThreshold');
    assert.equal(errors.TreatMissingData, 'notBreaching');

    const invocations = properties('EventFunctionNoInvocationsAlarm');
    assert.equal(invocations.MetricName, 'Invocations');
    assert.equal(invocations.ComparisonOperator, 'LessThanOrEqualToThreshold');
    assert.equal(invocations.TreatMissingData, 'breaching');
});

test('inline lambdas are compiled CommonJS', () => {
    for (const name of ['EventFunction', 'RequiredTagsRemediationFunction']) {
        const { ZipFile } = properties(name).Code as { ZipFile: string };
        assert.match(ZipFile, /exports\.handler = handler/);
        assert.doesNotMatch(ZipFile, /^import /m);
    }
});

test('remediation role can only tag volumes and network interfaces', () => {
    const [policy] = properties('RequiredTagsRemediationRole').Policies as Array<{
        PolicyDocument: { Statement: Statement[] };
    }>;
    assert.ok(policy !== undefined);

    const tagging = policy.PolicyDocument.Statement.filter((statement) => statement.Action.includes('ec2:CreateTags'));
    assert.equal(tagging.length, 1);
    assert.deepEqual(
        tagging[0]?.Resource.map((resource) => resource['Fn::Join'][1].at(-1)),
        [':volume/*', ':network-interface/*']
    );
});
