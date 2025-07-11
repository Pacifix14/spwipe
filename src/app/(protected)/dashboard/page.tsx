"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface SpotifyAuthData {
  user: {
    id: string;
    name: string;
    email?: string;
    image?: string;
  };
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    console.log("DASHBOARD: useEffect running...");
    // Clear any old manual auth data
    localStorage.removeItem('spotify-auth-data');
    setIsCheckingAuth(false);
  }, []);

  // Show loading while checking auth
  if (status === "loading" || isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }
  
  // If no session, redirect to login
  if (!session) {
    console.log("DASHBOARD: No authentication found, redirecting to homepage");
    window.location.href = "/";
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please log in to continue</h1>
          <Link
            href="/"
            className="bg-green-400 hover:bg-green-500 text-black px-6 py-3 rounded-full font-semibold transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Show user data from NextAuth session
  const currentUser = session?.user;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black">
      <div className="container max-w-4xl mx-auto px-4 py-16">
        <div className="text-center text-white mb-12">
          <h1 className="text-6xl font-extrabold tracking-tight mb-4">
            Welcome to <span className="text-green-400">Spwipe</span>
          </h1>
          <p className="text-xl mb-2">
            Hey {currentUser?.name}! 👋
          </p>
          <p className="text-lg text-gray-300 mb-8">
            Ready to discover your next favorite songs?
          </p>
          <p className="text-sm text-green-400 mb-4">
            ✅ Successfully connected to Spotify!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-xl border border-green-400/20">
            <div className="text-center">
              <div className="text-6xl mb-4">🎵</div>
              <h2 className="text-2xl font-bold mb-4 text-green-400">Start Swiping</h2>
              <p className="text-gray-300 mb-6">
                Discover personalized music recommendations based on your Spotify listening history
              </p>
              <Link
                href="/recommend"
                className="bg-green-400 hover:bg-green-500 text-black px-8 py-4 rounded-full text-lg font-semibold transition-colors inline-flex items-center gap-2"
              >
                <span>▶️</span>
                Start Discovering
              </Link>
            </div>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-sm p-8 rounded-xl border border-green-400/20">
            <div className="text-center">
              <div className="text-6xl mb-4">📊</div>
              <h2 className="text-2xl font-bold mb-4 text-green-400">Your Stats</h2>
              <p className="text-gray-300 mb-6">
                Track your swiping activity and music discovery progress
              </p>
              <button
                disabled
                className="bg-gray-600 text-gray-400 px-8 py-4 rounded-full text-lg font-semibold cursor-not-allowed inline-flex items-center gap-2"
              >
                <span>📈</span>
                Coming Soon
              </button>
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="bg-gray-900/30 backdrop-blur-sm p-6 rounded-xl border border-green-400/10 mb-8">
            <h3 className="text-xl font-semibold text-green-400 mb-4">How to use Spwipe</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl mb-2">👉</div>
                <p className="text-gray-300">Swipe right to like a song</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">👈</div>
                <p className="text-gray-300">Swipe left to pass</p>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-2">📱</div>
                <p className="text-gray-300">Liked songs get saved to your playlist</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/api/auth/signout"
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-full font-semibold transition-colors"
            >
              Sign Out
            </Link>
            <p className="text-gray-400 text-sm">
              Connected to Spotify as {currentUser?.email || currentUser?.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}