import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Simple redirect to a client-side authentication page
  return NextResponse.redirect(new URL("/auth/complete", request.url));
}