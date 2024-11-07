# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

### v1.13.0

- :tada: Add and enforce ECS Execute Enabled = true check

### v1.12.0

- :rocket: Fix error in Cloudformation-Drift subject call

### v1.11.0

- :rocket: Avoid publishing empty batch messages

### v1.10.0

- :rocket: Ignore ENI resources in the Required Tags rule as AWS currently doesn't propagate ALB tags to ENIs, resulting in significant alarm fatigue

### v1.9.2

- :bug: Fix logging

### v1.9.1

- :bug: Fix premature exit of Rule iteration

### v1.9.0

- :rocket: Enable `Certificate-Expiration` Rule & Urgent Alarms

### v1.8.0

- :rocket: Enabled `Cloudformation-Drift` Urgent Alarms

### v1.7.0

- :rocket: Add `ReadOnlyAccess` ManagedPolicyArn to CloudFormation Drift Policy

### v1.6.0

- :rocket: Add enabled rules as CloudFormation Drift isn't ready for prime time
- :bug: Fix submission ID to be compliant

### v1.5.0

- :rocket: Include AWSBasicExecution role to get CloudWatch Logs
- :arrow_up: Update Core Deps

### v1.4.0

- :rocket: Prefix Policy & Role with region to avoid errors when deploying to multiple regions

### v1.3.0

- :rocket: More resilient Error handling in lambda function

### v1.2.0

- :rocket: Update detection to hourly

### v1.1.0

- :tada: Enable Cloudformation Drift Detection Rules

### v1.0.1

- :rocket: Add `private: true`

### v1.0.0

- :rocket: Initial Commit with Tagging Rules

