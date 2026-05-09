import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { isProtectedPath, isPublicPath } from "@/lib/protected-routes";

const hasClerk =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes("placeholder");

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/intake(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;
  const shouldProtect =
    !isPublicRoute(req) && !isPublicPath(pathname) && isProtectedPath(pathname);

  if (hasClerk && shouldProtect) {
    await auth.protect();
  }
});
