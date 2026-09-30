# Lessons Learned

Record:

-   mistakes
-   successful patterns
-   future recommendations

## 2026-10-01

- A trailing comma made `.claude/settings.json` invalid JSON, which silently disabled every project setting (permissions and hooks). `apps/api/src/test/docs-governance.spec.ts` now parses the file so this fails a test instead.
