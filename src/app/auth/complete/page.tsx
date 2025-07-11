"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

export default function AuthCompletePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [authProcessing, setAuthProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processAuth = async () => {
      try {
        console.log("Processing auth...");
        
        // Get the Spotify token data from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const tokenData = urlParams.get('token');

        console.log("Token data found:", !!tokenData);

        if (!tokenData) {
          // Check if we're coming from the GitHub bridge with auth code
          const code = urlParams.get('code');
          
          if (code) {
            console.log("Found auth code in URL, redirecting to callback...");
            // Redirect to the manual callback with the code
            window.location.href = `/api/auth/callback/spotify-manual${window.location.search}`;
            return;
          }
          
          setError("No authentication data found - please try logging in again");
          return;
        }

        console.log("Decoding token data...");
        // Base64 decode the token data
        const decoded = JSON.parse(atob(tokenData));
        const { user, accessToken, refreshToken, accessTokenExpires } = decoded;

        console.log("User data:", user);

        // Store user data in localStorage temporarily
        localStorage.setItem('spotify-auth-data', JSON.stringify({
          user,
          accessToken,
          refreshToken,
          accessTokenExpires
        }));

        console.log("Redirecting to dashboard...");
        // Use window.location.href to ensure full page reload
        window.location.href = '/dashboard?auth=spotify';
        
      } catch (error) {
        console.error("Auth processing error:", error);
        setError("Authentication failed: " + (error as Error).message);
      } finally {
        setAuthProcessing(false);
      }
    };

    processAuth();
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-400">Authentication Failed</h1>
          <p className="mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-green-400 hover:bg-green-500 text-black px-6 py-3 rounded-full font-semibold transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold mb-2 text-green-400">Authentication Successful!</h1>
        <p className="text-gray-300">Setting up your account...</p>
      </div>
    </div>
  );
}