# Debugging Notes

Use task-specific workflows under `.ai/workflows/` and architecture maps under `.ai/architecture/` to localize failures quickly.

Recommended order:
1. Reproduce with focused test.
2. Trace route/controller/service path via code map.
3. Verify guard/env dependencies.
4. Patch minimally and re-run targeted verification.
