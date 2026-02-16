/**
 * True when running in development (NODE_ENV=development).
 * Used to show dev-only UI (e.g. Dev Tools in Settings).
 */
export const isDevMode =
  typeof process !== "undefined" &&
  process.env.NODE_ENV === "development";
