import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";

export async function GET(request: NextRequest) {
  console.log("=== SPOTIFY CALLBACK RECEIVED ===");
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  console.log("Callback params:", { code: !!code, state, error });

  if (error) {
    console.log("OAuth error:", error);
    return NextResponse.redirect(new URL(`/api/auth/error?error=${error}`, request.url));
  }

  if (!code) {
    console.log("No code received");
    return NextResponse.redirect(new URL("/api/auth/error?error=missing_code", request.url));
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", tokens);
      return NextResponse.redirect(new URL("/api/auth/error?error=token_exchange_failed", request.url));
    }

    // Get user info
    const userResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    const user = await userResponse.json();

    if (!userResponse.ok) {
      console.error("User info fetch failed:", user);
      return NextResponse.redirect(new URL("/api/auth/error?error=user_info_failed", request.url));
    }

    // Create a custom JWT token with user info and Spotify tokens
    const customToken = Buffer.from(
      JSON.stringify({
        user: {
          id: user.id,
          name: user.display_name,
          email: user.email,
          image: user.images?.[0]?.url,
        },
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpires: Date.now() + tokens.expires_in * 1000,
        timestamp: Date.now(),
      })
    ).toString("base64");

    // Pass data via URL parameters instead of cookies
    const authCompleteUrl = new URL("/auth/complete", request.url);
    authCompleteUrl.searchParams.set("token", customToken);
    
    console.log("Redirecting to auth complete with token:", customToken.substring(0, 50) + "...");
    
    return NextResponse.redirect(authCompleteUrl);
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(new URL("/api/auth/error?error=callback_error", request.url));
  }
}