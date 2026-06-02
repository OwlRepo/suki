---
id: tl-imports-data-upload-flow
locale: tl
category: onboarding
intents: ["import", "upload customers", "bulk upload", "csv import"]
relatedRoutes: ["/imports", "/customers"]
toolBindings: ["route_guidance"]
priority: medium
lastUpdated: 2026-06-02
quickAnswer: Buksan ang Imports para sa bulk upload ng customer data, tapos i-check sa Customers.
---
- Buksan ang Imports kapag marami kang customer records na ia-add.
- Ayusin muna ang file headers at Philippine mobile numbers sa `+639171234567` format bago mag-upload.
- Gamitin ang preview/validation para mahanap agad ang duplicates at errors.
- I-confirm ang mapping suggestions bago final commit.
- Pagkatapos ng import, buksan ang Customers at i-verify ang sample records.
- Gamitin lang ang rollback kapag malinaw na mali ang uploaded data.
- Karaniwang mali: import agad nang walang duplicate check.
- Recovery: linisin muna ang source file at mag-reimport.
- Karaniwang mali: maling column mapping sa commit.
- Recovery: ulitin ang mapping preview bago mag-commit.
