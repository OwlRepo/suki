# Daily Autonomous Cycle

> No scheduler is configured (`config/autonomous-engineering.yaml` `schedule.mode: manual`). Run these phases manually, in this order, until an approved INFRASTRUCTURE task installs a scheduler.

## Planning (time NOT_CONFIGURED)

Product Manager:

- read incoming requests
- analyze requirements, unknowns, risks, and dependencies
- create prioritized queue


## Engineering (time NOT_CONFIGURED)

Coordinator:

- select ready tasks
- assign agents
- execute workflow
- create PRs
- stop at `WAITING_APPROVAL` when approval is required


## Reporting (time NOT_CONFIGURED)

Reporter:

- summarize evidence
- report current task state
- report progress
- list blockers, risks, and next actions
