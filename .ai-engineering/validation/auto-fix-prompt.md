# Validation Auto-Fix Prompt

Run the autonomous engineering validation suite.

If problems are found:

1.  Do not ignore failures.
2.  Do not remove checks.
3.  Do not weaken safety rules.
4.  Fix only the workflow package files.
5.  Explain every change.
6.  Re-run validation after repairs.

The goal is:

A consistent autonomous engineering system ready for use.

Allowed changes: - markdown instructions - templates - workflow
definitions - configuration

Forbidden: - application code changes - production changes - dependency
changes
