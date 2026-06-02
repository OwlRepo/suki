import { NextRequest, NextResponse } from "next/server";

export default function proxy(req: NextRequest) {
  void req;
  return NextResponse.next();
}
