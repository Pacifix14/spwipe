import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json({ error: `Authorization failed: ${error}` }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'No authorization code received' }, { status: 400 });
  }

  // Exchange the authorization code for tokens
  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'https://a2f283186914.ngrok-free.app/api/auth/callback/spotify',
        client_id: process.env.SPOTIFY_CLIENT_ID || 'a3487cb7d344422099cb989fbd64e917',
        client_secret: process.env.SPOTIFY_CLIENT_SECRET || 'e95bc58387ed4a66a4f0520f777b8271',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return NextResponse.json({ error: `Token exchange failed: ${errorText}` }, { status: 400 });
    }

    const tokenData = await tokenResponse.json();

    // Return the tokens (including refresh_token)
    return NextResponse.json({
      message: 'Success! Copy this refresh_token to your environment variables:',
      refresh_token: tokenData.refresh_token,
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
    });

  } catch (error) {
    return NextResponse.json({ error: `Server error: ${error}` }, { status: 500 });
  }
}