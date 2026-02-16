import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const hasClerk =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder");

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/intake(.*)"]);
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/customers(.*)",
  "/appointments(.*)",
  "/promos(.*)",
  "/settings(.*)",
  "/setup(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (hasClerk && !isPublicRoute(req) && isProtectedRoute(req)) {
    await auth.protect();
  }
});
