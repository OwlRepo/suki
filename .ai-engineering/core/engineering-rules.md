# Engineering Rules

Before coding:

-   understand the request
-   inspect existing implementation
-   identify affected areas
-   check existing patterns

During coding:

-   make minimal correct changes
-   avoid unrelated refactors
-   add tests for changed behavior
-   keep backwards compatibility (a `BREAKING CHANGE` needs a label and explicit user approval, `AGENTS.md`)
-   write the failing tests first and prove them with `bun run tdd:red`

Before PR:

-   review diff
-   run validation
-   confirm acceptance criteria
