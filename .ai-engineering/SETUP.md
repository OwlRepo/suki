# Autonomous Engineering Bootstrap Setup

Goal:
Install an AI engineering operating layer into an existing repository.

Read all files in this package before making changes.

Setup workflow:

1. Inspect repository:
   - stack
   - architecture
   - existing instructions
   - testing
   - deployment
   - integrations

2. Create:
   .ai-engineering/

3. Install:
   - agents
   - workflows
   - templates
   - memory structure
   - configuration

4. Preserve existing project rules.

5. Do not modify application code during setup.

6. Report:
   - detected project information
   - installed workflow
   - configured agents
   - automation recommendations
   - unresolved decisions

This package defines behavior. Runtime execution is handled by Codex, Claude, or another compatible agent runtime.

## Post-Setup Validation

After installing `.ai-engineering/`:

1. Run the bootstrap validation workflow:
   - Read `validation/bootstrap-check.md`
   - Run all workflow tests
   - Validate agent contracts
   - Check templates and references

2. If issues are found:
   - Read `validation/repair-loop.md`
   - Fix bootstrap package files only
   - Do not modify application code

3. Re-run validation.

Setup is complete only when:

- validation passes
- no unresolved workflow conflicts exist
- safety rules remain intact

## Installation record (this repository)

- Installed 2026-10-01 on branch `infra/no-ticket-workflow-port-v2`, ported from the reference layout (agents, config, core, memory, runtime, templates, validation, workflows).
- Activation: autonomy Level 2 pilot — implement and open PRs, never merge (`config/autonomous-engineering.yaml`, `docs/ai/autonomous-engineering.md`).
- Not configured: task source, scheduler, notifications (manual, chat-driven runs).
- Runtime pointers: `AGENTS.md` (block `ai-engineering-integration`), `CLAUDE.md` (imports `AGENTS.md`), `.codex/instructions.md`.
