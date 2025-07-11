"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string };
  external_urls: { spotify: string };
}

interface SpotifyPlayerState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      id: string;
      name: string;
      artists: { name: string }[];
      album: { name: string };
    };
  };
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayer;
    };
  }
}

interface SpotifyPlayer {
  addListener: (event: string, callback: (data: any) => void) => void;
  removeListener: (event: string, callback?: (data: any) => void) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  getCurrentState: () => Promise<SpotifyPlayerState | null>;
  getVolume: () => Promise<number>;
  nextTrack: () => Promise<void>;
  pause: () => Promise<void>;
  previousTrack: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (position: number) => Promise<void>;
  setName: (name: string) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  togglePlay: () => Promise<void>;
}

export function useSpotifyPlayer() {
  const { data: session } = useSession();
  const [player, setPlayer] = useState<SpotifyPlayer | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const playerRef = useRef<SpotifyPlayer | null>(null);

  useEffect(() => {
    if (!session?.accessToken) {
      console.log('No access token available');
      return;
    }

    console.log('Initializing Spotify Web Playback SDK...');
    console.log('Session:', { 
      hasAccessToken: !!session.accessToken, 
      accessToken: session.accessToken?.substring(0, 20) + '...' 
    });

    let isComponentMounted = true;

    // Load Spotify SDK script if not already loaded
    const loadSpotifySDK = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.Spotify) {
          console.log('Spotify SDK already loaded');
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.onload = () => {
          console.log('Spotify SDK script loaded');
          resolve();
        };
        script.onerror = (error) => {
          console.error('Failed to load Spotify SDK script:', error);
          reject(error);
        };
        document.head.appendChild(script);
      });
    };

    const initializePlayer = () => {
      const token = session.accessToken;
      if (!token) {
        console.error('No token available for player initialization');
        return;
      }

      console.log('Creating Spotify Player instance...');
      const spotifyPlayer = new window.Spotify.Player({
        name: 'Spwipe Player',
        getOAuthToken: (cb) => {
          console.log('OAuth token requested by SDK');
          cb(token);
        },
        volume: 0.5
      });

      playerRef.current = spotifyPlayer;

      // Error handling
      spotifyPlayer.addListener('initialization_error', ({ message }) => {
        console.error('Spotify Player initialization error:', message);
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        console.error('Spotify Player authentication error:', message);
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        console.error('Spotify Player account error:', message);
      });

      spotifyPlayer.addListener('playback_error', ({ message }) => {
        console.error('Spotify Player playback error:', message);
      });

      // Playback status updates
      spotifyPlayer.addListener('player_state_changed', (state) => {
        if (!state) return;

        setIsPlaying(!state.paused);
        
        if (state.track_window?.current_track) {
          setCurrentTrack({
            id: state.track_window.current_track.id,
            name: state.track_window.current_track.name,
            artists: state.track_window.current_track.artists,
            album: state.track_window.current_track.album,
            external_urls: { spotify: `https://open.spotify.com/track/${state.track_window.current_track.id}` }
          });
        }
      });

      // Ready
      spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Spotify Player ready with Device ID:', device_id);
        if (isComponentMounted) {
          setDeviceId(device_id);
          setIsReady(true);
          setPlayer(spotifyPlayer);
        }
      });

      // Not Ready
      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('Spotify Player not ready with Device ID:', device_id);
        if (isComponentMounted) {
          setIsReady(false);
        }
      });

      // Connect to the player
      spotifyPlayer.connect().then((success) => {
        if (success) {
          console.log('Successfully connected to Spotify Player');
        } else {
          console.error('Failed to connect to Spotify Player');
        }
      });
    };

    // Load SDK and initialize player
    const setupPlayer = async () => {
      try {
        await loadSpotifySDK();
        
        // Wait for SDK to be ready
        if (window.Spotify) {
          console.log('Spotify SDK available, initializing player...');
          initializePlayer();
        } else {
          console.log('Waiting for Spotify SDK to be ready...');
          window.onSpotifyWebPlaybackSDKReady = () => {
            console.log('Spotify SDK ready via callback, initializing player...');
            initializePlayer();
          };
        }
      } catch (error) {
        console.error('Failed to load Spotify SDK:', error);
      }
    };

    setupPlayer();

    return () => {
      isComponentMounted = false;
      if (playerRef.current) {
        playerRef.current.disconnect();
      }
    };
  }, [session?.accessToken]);

  const playTrack = useCallback(async (track: Track) => {
    if (!session?.accessToken || !deviceId) {
      console.error('No access token or device ID available');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          uris: [`spotify:track:${track.id}`]
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Play track error:', response.status, errorText);
        
        if (response.status === 403) {
          console.error('Spotify Premium required for Web Playback SDK');
        }
      } else {
        console.log(`Started playing: ${track.name}`);
      }
    } catch (error) {
      console.error('Error playing track:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.accessToken, deviceId]);

  const pauseTrack = useCallback(async () => {
    if (!player) return;
    
    try {
      await player.pause();
    } catch (error) {
      console.error('Error pausing track:', error);
    }
  }, [player]);

  const resumeTrack = useCallback(async () => {
    if (!player) return;
    
    try {
      await player.resume();
    } catch (error) {
      console.error('Error resuming track:', error);
    }
  }, [player]);

  const stopTrack = useCallback(async () => {
    if (!player) return;
    
    try {
      await player.pause();
      setCurrentTrack(null);
    } catch (error) {
      console.error('Error stopping track:', error);
    }
  }, [player]);

  const togglePlayPause = useCallback(async (track: Track) => {
    if (currentTrack?.id === track.id && isPlaying) {
      await pauseTrack();
    } else if (currentTrack?.id === track.id && !isPlaying) {
      await resumeTrack();
    } else {
      await playTrack(track);
    }
  }, [currentTrack, isPlaying, pauseTrack, resumeTrack, playTrack]);

  return {
    player,
    deviceId,
    isReady,
    isPlaying,
    currentTrack,
    isLoading,
    playTrack,
    pauseTrack,
    resumeTrack,
    stopTrack,
    togglePlayPause,
    isCurrentTrack: (track: Track) => currentTrack?.id === track.id,
  };
}