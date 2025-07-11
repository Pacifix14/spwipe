"use client";

import { useState, useEffect, useRef } from "react";

interface Track {
  id: string;
  preview_url: string | null;
}

export function useSpotifyPreview() {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const play = async (track: Track) => {
    if (!track.preview_url) {
      console.warn("No preview URL available for track:", track.id);
      return;
    }

    setIsLoading(true);

    try {
      // Stop current audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }

      // Create new audio element
      const audio = new Audio(track.preview_url);
      audioRef.current = audio;

      // Set up event listeners
      audio.addEventListener("canplaythrough", () => {
        setIsLoading(false);
        setCurrentTrack(track);
        setIsPlaying(true);
      });

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setCurrentTrack(null);
      });

      audio.addEventListener("error", (e) => {
        console.error("Audio playback error:", e);
        setIsLoading(false);
        setIsPlaying(false);
        setCurrentTrack(null);
      });

      // Set volume to 60%
      audio.volume = 0.6;

      // Preload the audio
      audio.preload = "auto";

      // Start playback
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Playback failed:", error);
          setIsLoading(false);
          setIsPlaying(false);
          setCurrentTrack(null);
        });
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsLoading(false);
      setIsPlaying(false);
      setCurrentTrack(null);
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTrack(null);
    setIsLoading(false);
  };

  const togglePlayPause = (track: Track) => {
    if (currentTrack?.id === track.id && isPlaying) {
      pause();
    } else {
      play(track);
    }
  };

  return {
    currentTrack,
    isPlaying,
    isLoading,
    play,
    pause,
    stop,
    togglePlayPause,
    isCurrentTrack: (track: Track) => currentTrack?.id === track.id,
  };
}