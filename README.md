<h1 align=center>TAK AWS Config</h1>

<p align=center>Create and Manage AWS Config with CloudFormation</p>

## PreReqs

An AWS Config Configuration Recorder must first be setup in the account.
Navigate to the AWS Config setup of the console and enable AWS Config.

If you are sending the SNS notifications to PagerDuty, add a new email subscription
in the subscriptions section of the topic and ensure the settings are set to deduplicate!

## Installation

Local installation can be performed via the following

```sh
npm install
```

## Running Locally

```sh
AWS_REGION=us-gov-east-1 node -e 'require("./index.cjs").handler()'
```

## AWS Deployment

From the root directory, install the deploy dependencies

```sh
npm install
```

Deployment to AWS is handled via AWS Cloudformation. The template can be found in the `./cloudformation`
directory. The deployment itself is performed by [Deploy](https://github.com/openaddresses/deploy) which
was installed in the previous step.

The deploy tool can be run via the following

```sh
npx deploy
```

To install it globally - view the deploy [README](https://github.com/openaddresses/deploy)

Deploy uses your existing AWS credentials. Ensure that your `~/.aws/credentials` has an entry like:

```
[coe]
aws_access_key_id = <redacted>
aws_secret_access_key = <redacted>
```

Deployment can then be performed via the following:

```
npx deploy create <stack>
```

```
npx deploy update <stack>
```

```
npx deploy info <stack> --outputs
```

```
npx deploy info <stack> --parameters
```

Stacks can be created, deleted, cancelled, etc all via the deploy tool. For further information
information about `deploy` functionality run the following for help.

```sh
npx deploy
```

Further help about a specific command can be obtained via something like:

```sh
npx deploy info --help
```

