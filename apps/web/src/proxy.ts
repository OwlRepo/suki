import { NextRequest, NextResponse } from "next/server";
import { isProtectedPath } from "@/lib/protected-routes";

export default function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const session = req.cookies.get("suki_session")?.value;
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
