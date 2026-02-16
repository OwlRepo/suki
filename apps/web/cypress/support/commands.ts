/**
 * Use in beforeEach: if Clerk is not configured, skip the test.
 * Call as: if (!Cypress.env("hasClerk")) (this as Mocha.Context).skip();
 */
export function skipWhenNoClerk(context: Mocha.Context): void {
  if (!Cypress.env("hasClerk")) {
    context.skip();
  }
}
