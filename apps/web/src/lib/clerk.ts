const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() || "";

export const hasClerk =
  !!key && key.length > 0 && !key.toLowerCase().includes("placeholder");
