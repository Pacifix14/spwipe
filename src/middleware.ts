import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Temporarily disable middleware to fix edge runtime issues
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};