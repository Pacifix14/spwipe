import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  console.log("=== SIGNIN ROUTE CALLED ===");
  const isDev = process.env.NODE_ENV === "development";
  
  console.log("Environment:", { isDev, NODE_ENV: process.env.NODE_ENV });
  
  if (isDev) {
    // For development, redirect to Spotify with GitHub page as callback
    const spotifyAuthUrl = new URL("https://accounts.spotify.com/authorize");
    spotifyAuthUrl.searchParams.set("client_id", process.env.SPOTIFY_CLIENT_ID!);
    spotifyAuthUrl.searchParams.set("response_type", "code");
    spotifyAuthUrl.searchParams.set("redirect_uri", process.env.SPOTIFY_REDIRECT_URI!);
    spotifyAuthUrl.searchParams.set("scope", "user-read-private user-top-read playlist-read-private playlist-modify-public playlist-modify-private");
    spotifyAuthUrl.searchParams.set("state", `dev-${Date.now()}`);
    
    console.log("Redirecting to Spotify:", spotifyAuthUrl.toString());
    return NextResponse.redirect(spotifyAuthUrl.toString());
  } else {
    // For production, use the normal NextAuth flow
    console.log("Redirecting to NextAuth Spotify");
    return NextResponse.redirect(new URL("/api/auth/signin/spotify", request.url));
  }
}