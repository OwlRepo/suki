# Bootstrap Validation Workflow

Purpose: Validate that the autonomous engineering system is correctly
installed and internally consistent.

Run checks:

1.  Folder completeness

-   Required directories exist.
-   Required agent files exist.
-   Required workflow files exist.
-   Templates exist.

2.  Reference validation

-   Workflows reference existing agents.
-   Agents reference existing rules.
-   Templates match expected outputs.

3.  Lifecycle validation Verify:

-   every state is defined
-   every transition has a reason
-   blocked states are handled
-   completion requires evidence

4.  Safety validation Check:

-   no instruction bypasses approvals
-   no workflow allows destructive actions
-   no workflow exposes secrets

5.  Runtime validation Check:

-   Codex/Claude instructions exist
-   scheduler behavior is defined
-   manual execution is supported

Output:

VALIDATION REPORT

Status: PASS / NEEDS_REPAIR

## Issues:

## Affected files:

## Recommended fixes:
