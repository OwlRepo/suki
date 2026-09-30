# Task State Machine

States:

NEW
TRIAGED
ANALYZING
PLANNED
READY
BUILDING
REVIEW
QA
PR_READY
WAITING_APPROVAL
MERGED
VERIFIED
REPORTED

SKIPPED_ALREADY_IMPLEMENTED

Canonical transition:

NEW → TRIAGED → ANALYZING → PLANNED → READY → BUILDING → REVIEW → QA →
PR_READY → WAITING_APPROVAL → MERGED → VERIFIED → REPORTED

Already-implemented transition:

ANALYZING → SKIPPED_ALREADY_IMPLEMENTED → REPORTED


Rules:

NEW:
Request exists but not understood.

TRIAGED:
Priority and ownership identified.

ANALYZING:
Requirements and repository inspected.

SKIPPED_ALREADY_IMPLEMENTED:
Every acceptance criterion is proven by existing repository evidence. Do not
create implementation work, branch, worktree, plan, commit, PR, merge, or
release.

PLANNED:
Implementation approach approved.

READY:
Plan complete, dependencies available, and work authorized to begin.

BUILDING:
Implementation in progress.

REVIEW:
Independent code review.

QA:
Behavior validation.

PR_READY:
Evidence complete.

WAITING_APPROVAL:
Human decision required.

MERGED:
Approved PR merged by an authorized human or runtime.

VERIFIED:
Released or accepted.

REPORTED:
Included in engineering report.
