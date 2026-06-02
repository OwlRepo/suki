---
id: en-imports-data-upload-flow
locale: en
category: onboarding
intents: ["import", "upload customers", "bulk upload", "csv import"]
relatedRoutes: ["/imports", "/customers"]
toolBindings: ["route_guidance"]
priority: medium
lastUpdated: 2026-06-02
quickAnswer: Open Imports to upload customer data in bulk, then validate in Customers.
---
- Open Imports when adding many customer records at once.
- Prepare clean file headers and Philippine mobile numbers in `+639171234567` format before upload.
- Use preview/validation steps to catch duplicates and format issues early.
- Confirm mapping suggestions before final commit.
- After import, open Customers and verify sample records.
- Use rollback path only when uploaded data is clearly incorrect.
- Common mistake: importing without checking duplicates.
- Recovery: run duplicate checks and clean source file, then re-import.
- Common mistake: committing with wrong column mapping.
- Recovery: redo mapping preview before commit.
