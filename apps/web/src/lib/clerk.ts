export const hasClerk =
  typeof process !== "undefined" &&
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !String(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).includes(
    "placeholder",
  );
