"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import SwipeCard from "./_components/SwipeCard";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";
import { api } from "@/trpc/react";

interface Track {
  id: string;
  name: string;
  artists: { name: string; id: string }[];
  album: {
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
  popularity: number;
  duration_ms: number;
}

export default function RecommendPage() {
  const { data: session } = useSession();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [swipeStats, setSwipeStats] = useState({ likes: 0, passes: 0 });
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [lastAddedTrack, setLastAddedTrack] = useState<string | null>(null);
  const [spotifyData, setSpotifyData] = useState<any>(null);
  const spotifyPlayer = useSpotifyPlayer();

  // Check for Spotify auth data in localStorage
  useEffect(() => {
    const authData = localStorage.getItem('spotify-auth-data');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        setSpotifyData(parsed);
      } catch (error) {
        console.error("Error parsing Spotify auth data:", error);
      }
    }
  }, []);

  // Fetch recommendations
  const { data: recommendationsData, refetch: refetchRecommendations, isLoading: isLoadingRecommendations } = api.spotify.getRecommendations.useQuery({
    limit: 20,
  });

  // Add track to playlist mutation
  const addTrackMutation = api.spotify.addTrackToPlaylist.useMutation();

  // Load tracks when recommendations are fetched
  useEffect(() => {
    if (recommendationsData?.tracks) {
      setTracks(prev => {
        // If this is the first load, replace tracks
        if (prev.length === 0) {
          return recommendationsData.tracks;
        }
        // Otherwise, append new tracks, avoiding duplicates
        const newTracks = recommendationsData.tracks.filter(
          newTrack => !prev.some(existingTrack => existingTrack.id === newTrack.id)
        );
        return [...prev, ...newTracks];
      });
      
      // Only reset current track index if it's the first load
      if (tracks.length === 0) {
        setCurrentTrackIndex(0);
      }
    }
  }, [recommendationsData]);

  const currentTrack = tracks[currentTrackIndex];

  useEffect(() => {
    // Stop current audio first
    spotifyPlayer.stopTrack();
    
    // Auto-play track when card appears (only if Spotify player is ready)
    if (currentTrack && spotifyPlayer.isReady) {
      console.log(`Auto-playing track: ${currentTrack.name} by ${currentTrack.artists[0]?.name}`);
      const timer = setTimeout(() => {
        spotifyPlayer.playTrack(currentTrack);
      }, 800); // Slightly longer delay for better UX
      return () => clearTimeout(timer);
    } else if (currentTrack && !spotifyPlayer.isReady) {
      console.log(`Spotify player not ready for track: ${currentTrack.name} by ${currentTrack.artists[0]?.name}`);
    }
  }, [currentTrack, spotifyPlayer.isReady]); // Include isReady to trigger when player becomes available

  const handleSwipe = async (direction: "left" | "right") => {
    // Stop current audio
    spotifyPlayer.stopTrack();
    
    // Update stats
    setSwipeStats(prev => ({
      ...prev,
      [direction === "left" ? "passes" : "likes"]: prev[direction === "left" ? "passes" : "likes"] + 1
    }));

    // Add track to playlist if liked and playlist is selected
    if (direction === "right" && currentTrack && selectedPlaylistId) {
      try {
        await addTrackMutation.mutateAsync({
          playlistId: selectedPlaylistId,
          trackId: currentTrack.id,
        });
        setLastAddedTrack(currentTrack.name);
        setTimeout(() => setLastAddedTrack(null), 3000);
        console.log("Track added to playlist:", currentTrack.name);
      } catch (error) {
        console.error("Failed to add track to playlist:", error);
      }
    }

    // Move to next track
    setCurrentTrackIndex(prev => prev + 1);

    // Fetch more recommendations if we're running low (keep 5 tracks ahead)
    if (currentTrackIndex >= tracks.length - 5) {
      refetchRecommendations();
    }
  };

  const handlePlayPause = () => {
    if (currentTrack) {
      spotifyPlayer.togglePlayPause(currentTrack);
    }
  };

  if (!session) {
    return <div>Loading...</div>;
  }

  if (isLoadingRecommendations && tracks.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-lg">Loading your personalized recommendations...</p>
        </div>
      </div>
    );
  }

  // Show loading state if we're at the end and waiting for more tracks
  if (currentTrackIndex >= tracks.length && isLoadingRecommendations) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-lg">Loading more recommendations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-black">
      {/* Header */}
      <div className="flex justify-between items-center p-4 text-white border-b border-gray-800">
        <Link href="/dashboard" className="text-2xl font-bold text-green-400 hover:text-green-300 transition-colors">
          ← Spwipe
        </Link>
        <div className="flex gap-4 text-sm items-center">
          {/* Spotify Player Status */}
          <div className={`px-3 py-1 rounded-full text-xs ${
            spotifyPlayer.isReady 
              ? 'bg-green-500 text-white' 
              : 'bg-yellow-500 text-black'
          }`}>
            {spotifyPlayer.isReady ? '♪ Player Ready' : '⏳ Connecting...'}
          </div>
          <span className="bg-green-500 px-3 py-1 rounded-full">❤️ {swipeStats.likes}</span>
          <span className="bg-red-500 px-3 py-1 rounded-full">✖️ {swipeStats.passes}</span>
        </div>
      </div>

      {/* Success notification */}
      <AnimatePresence>
        {lastAddedTrack && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Added "{lastAddedTrack}" to playlist!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning for no playlist selected */}
      {!selectedPlaylistId && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40 bg-yellow-500 text-black px-4 py-2 rounded-lg shadow-lg">
          <p className="text-sm font-medium">⚠️ Select a playlist to save liked tracks!</p>
        </div>
      )}

      {/* Spotify Premium/Connection info */}
      {!spotifyPlayer.isReady && (
        <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-40 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg max-w-sm text-center">
          <p className="text-sm font-medium">
            {spotifyPlayer.deviceId ? 
              '🎵 Connecting to Spotify...' : 
              '🎵 Spotify Premium required for audio playback'
            }
          </p>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {currentTrack && (
              <SwipeCard
                key={currentTrack.id}
                track={currentTrack}
                onSwipe={handleSwipe}
                onPlayPause={handlePlayPause}
                isPlaying={spotifyPlayer.isCurrentTrack(currentTrack) && spotifyPlayer.isPlaying}
                selectedPlaylistId={selectedPlaylistId}
                onPlaylistSelect={setSelectedPlaylistId}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 text-center text-white border-t border-gray-800">
        <p className="text-sm text-gray-400">
          Track {currentTrackIndex + 1} • {tracks.length} loaded
          {currentTrackIndex >= tracks.length - 5 && !isLoadingRecommendations && (
            <span className="text-green-400 ml-2">• Loading more...</span>
          )}
        </p>
      </div>
    </div>
  );
}