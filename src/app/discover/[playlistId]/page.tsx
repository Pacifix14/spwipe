"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { api } from "@/trpc/react";

interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  image: string;
  genres: string[];
  year: number;
  popularity: number;
  external_urls: {
    spotify: string;
  };
  similarity?: number;
  duration_ms?: number;
  smart_start_time?: number;
  stream_url?: string;
  deezer_id?: string;
  apple_music_id?: string;
}

interface SwipeStats {
  likes: number;
  passes: number;
  total: number;
}

// Liquid Glass Background Component for Discover Page
function DiscoverLiquidBackground() {
  const [mounted, setMounted] = useState(false);
  const { scrollYProgress } = useScroll();
  
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 180]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Main liquid glass orbs */}
      <motion.div
        style={{ y: y1, rotate }}
        className="absolute -top-32 -right-32 w-64 h-64 rounded-full"
      >
        <div className="w-full h-full bg-gradient-to-br from-green-400/20 via-emerald-500/15 to-teal-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute inset-4 bg-gradient-to-tr from-white/5 to-transparent rounded-full backdrop-blur-xl border border-white/10" />
      </motion.div>
      
      <motion.div
        style={{ y: y2 }}
        className="absolute -bottom-32 -left-32 w-72 h-72 rounded-full"
      >
        <div className="w-full h-full bg-gradient-to-tl from-purple-400/20 via-pink-500/15 to-rose-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
        <div className="absolute inset-4 bg-gradient-to-bl from-white/5 to-transparent rounded-full backdrop-blur-xl border border-white/10" />
      </motion.div>

      {/* Floating particles */}
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-green-400/30 rounded-full backdrop-blur-sm"
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() * 20 - 10, 0],
            scale: [0, 1, 0],
            opacity: [0, 0.6, 0]
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 4,
            ease: "easeInOut"
          }}
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`
          }}
        />
      ))}
    </div>
  );
}

// Enhanced Loading Animation Component
function LoadingAnimation() {
  return (
    <div className="relative">
      {/* Main loading spinner with glass effect */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="relative w-24 h-24 mx-auto mb-8"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400/30 to-emerald-500/30 blur-xl" />
        <div className="absolute inset-2 rounded-full bg-white/5 backdrop-blur-xl border border-white/20" />
        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 opacity-20" />
        
        {/* Spinning border */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="70 30"
            className="opacity-80"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>

      {/* Pulsing dots */}
      <div className="flex justify-center space-x-2 mb-6">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="w-3 h-3 bg-green-400 rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const params = useParams();
  const router = useRouter();
  const playlistId = params.playlistId as string;
  
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [swipeStats, setSwipeStats] = useState<SwipeStats>({ likes: 0, passes: 0, total: 0 });
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [isGeneratingPlaylist, setIsGeneratingPlaylist] = useState(false);
  const [generatedPlaylistUrl, setGeneratedPlaylistUrl] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [currentPlaybackType, setCurrentPlaybackType] = useState<'deezer' | 'apple' | 'generic' | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch recommendations based on playlist
  const { data: recommendations, isLoading, error } = api.recommendations.getByPlaylist.useQuery({
    playlistId,
    limit: 50
  });

  const tracks = recommendations?.tracks || [];
  const currentTrack = tracks[currentTrackIndex];

  // Audio playback functions
  const stopCurrentAudio = () => {
    // Stop both ref and state audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioRef.current.removeEventListener('ended', handleAudioEnded);
      audioRef.current.removeEventListener('error', handleAudioError);
      audioRef.current.removeEventListener('play', handleAudioPlay);
      audioRef.current.removeEventListener('pause', handleAudioPause);
      audioRef.current = null;
    }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio.removeEventListener('timeupdate', handleTimeUpdate);
      currentAudio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      currentAudio.removeEventListener('ended', handleAudioEnded);
      currentAudio.removeEventListener('error', handleAudioError);
      currentAudio.removeEventListener('play', handleAudioPlay);
      currentAudio.removeEventListener('pause', handleAudioPause);
    }
    setIsPlaying(false);
    setCurrentPlaybackType(null);
    setCurrentTime(0);
    setDuration(0);
    setCurrentAudio(null);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current || currentAudio;
    if (audio && !isDragging) {
      setCurrentTime(audio.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current || currentAudio;
    if (audio) {
      setDuration(audio.duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleAudioError = (e: any) => {
    console.error('Audio error:', e);
    setAudioError("Audio playback failed");
    setIsPlaying(false);
  };

  const handleAudioPlay = () => {
    setIsPlaying(true);
  };

  const handleAudioPause = () => {
    setIsPlaying(false);
  };

  const playTrack = (track: Track) => {
    console.log('Playing track:', track.name, 'Stream URL:', track.stream_url);
    
    if (!track.stream_url) {
      console.log('No stream URL available for track:', track.name);
      setAudioError("No streaming source available for this track");
      return;
    }

    // CRITICAL: Always stop current audio first
    stopCurrentAudio();
    setAudioError(null);

    const audio = new Audio();
    
    // Set the ref immediately
    audioRef.current = audio;
    
    // Add all event listeners before setting src
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleAudioEnded);
    audio.addEventListener('error', handleAudioError);
    audio.addEventListener('play', handleAudioPlay);
    audio.addEventListener('pause', handleAudioPause);
    
    // Set start time to the smart start time (chorus/best part)
    audio.addEventListener('loadeddata', () => {
      if (track.smart_start_time) {
        audio.currentTime = track.smart_start_time;
      }
    });

    audio.addEventListener('canplaythrough', () => {
      // Only play if this is still the current audio
      if (audioRef.current === audio) {
        audio.play().catch(error => {
          console.error('Audio play failed:', error);
          setAudioError("Could not play audio - " + error.message);
        });
      }
    });

    // Set the source AFTER adding event listeners
    audio.src = track.stream_url;
    audio.load();

    // Determine playback type based on available IDs
    if (track.deezer_id) {
      setCurrentPlaybackType('deezer');
    } else if (track.apple_music_id) {
      setCurrentPlaybackType('apple');
    } else {
      setCurrentPlaybackType('generic');
    }

    setCurrentAudio(audio);
  };

  const togglePlayPause = () => {
    if (!currentTrack) return;
    
    const audio = audioRef.current || currentAudio;
    
    if (isPlaying && audio) {
      audio.pause();
    } else if (audio && !isPlaying) {
      audio.play().catch(error => {
        console.error('Audio play failed:', error);
        setAudioError("Could not play audio");
      });
    } else {
      playTrack(currentTrack);
    }
  };

  const handleSeek = (seekTime: number) => {
    const audio = audioRef.current || currentAudio;
    if (audio) {
      audio.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const handleSeekWithDragging = (seekTime: number, dragging: boolean) => {
    handleSeek(seekTime);
    setIsDragging(dragging);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Auto-play when track changes
  useEffect(() => {
    if (currentTrack) {
      // First, ensure any existing audio is stopped
      stopCurrentAudio();
      
      // Small delay to let the card animation complete AND ensure cleanup
      const timer = setTimeout(() => {
        // Double check the track hasn't changed during the delay
        if (currentTrack && tracks[currentTrackIndex]?.id === currentTrack.id) {
          playTrack(currentTrack);
        }
      }, 800);
      
      return () => {
        clearTimeout(timer);
        // Also stop audio when effect cleans up
        stopCurrentAudio();
      };
    }
  }, [currentTrack, currentTrackIndex]);

  // Cleanup audio on component unmount
  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, []);

  // Handle swipe actions
  const handleSwipe = (direction: "left" | "right") => {
    // CRITICAL: Stop current audio immediately
    stopCurrentAudio();
    
    const liked = direction === "right";
    
    if (liked && currentTrack) {
      setLikedTracks(prev => [...prev, currentTrack]);
    }
    
    setSwipeStats(prev => ({
      ...prev,
      [liked ? "likes" : "passes"]: prev[liked ? "likes" : "passes"] + 1,
      total: prev.total + 1
    }));
    
    // Move to next track - allow going beyond 50 tracks
    if (currentTrackIndex < tracks.length - 1) {
      setCurrentTrackIndex(prev => prev + 1);
    } else {
      // If we're at the end, generate more recommendations
      setCurrentTrackIndex(prev => prev + 1); // This will trigger the completion screen
    }
  };

  // Generate playlist mutation
  const generatePlaylist = api.playlists.create.useMutation({
    onSuccess: (data) => {
      setGeneratedPlaylistUrl(data.playlistUrl);
      setIsGeneratingPlaylist(false);
    },
    onError: (error) => {
      console.error("Failed to generate playlist:", error);
      setIsGeneratingPlaylist(false);
    }
  });

  const handleGeneratePlaylist = () => {
    if (likedTracks.length === 0) {
      alert("Please like at least one track first!");
      return;
    }
    
    setIsGeneratingPlaylist(true);
    generatePlaylist.mutate({
      name: `Spwipe Discovery - ${new Date().toLocaleDateString()}`,
      trackIds: likedTracks.map(track => track.id),
      description: `Generated from ${recommendations?.originalPlaylist?.name || "playlist"} with ${likedTracks.length} liked tracks`
    });
  };

  const handleOpenInSpotify = (url: string) => {
    window.open(url, '_blank');
  };

  // Enhanced Loading state with liquid glass effect
  if (isLoading) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white overflow-hidden">
        <DiscoverLiquidBackground />
        
        <div className="relative z-20 flex min-h-screen items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
            className="text-center"
          >
            {/* Glass card container */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-12 border border-white/10 shadow-2xl max-w-md mx-auto relative overflow-hidden">
              {/* Glass shine effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-50" />
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              
              <div className="relative z-10">
                <LoadingAnimation />
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <h2 className="text-2xl md:text-3xl font-bold mb-4 bg-gradient-to-r from-white via-green-200 to-white bg-clip-text text-transparent">
                    🎵 Analyzing Your Playlist
                  </h2>
                  
                  <motion.p
                    className="text-gray-300 text-lg mb-6"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    Our AI is discovering tracks that match your vibe...
                  </motion.p>
                  
                  {/* Progress steps */}
                  <div className="space-y-4">
                    {[
                      { text: "🔍 Scanning playlist tracks", delay: 0 },
                      { text: "🧠 Analyzing musical patterns", delay: 0.5 },
                      { text: "✨ Finding perfect matches", delay: 1 }
                    ].map((step, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: step.delay + 1 }}
                        className="flex items-center justify-center text-sm text-gray-400"
                      >
                        <motion.span
                          animate={{ 
                            scale: [1, 1.1, 1],
                            opacity: [0.5, 1, 0.5]
                          }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity, 
                            delay: step.delay + 1.5 
                          }}
                        >
                          {step.text}
                        </motion.span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Enhanced Error state with liquid glass effect
  if (error) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white overflow-hidden">
        <DiscoverLiquidBackground />
        
        <div className="relative z-20 flex min-h-screen items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
            className="text-center"
          >
            {/* Glass card container */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-12 border border-white/10 shadow-2xl max-w-md mx-auto relative overflow-hidden">
              {/* Glass shine effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-50" />
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              
              <div className="relative z-10">
                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-6xl mb-6"
                >
                  ⚠️
                </motion.div>
                
                <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-red-400 via-orange-300 to-red-400 bg-clip-text text-transparent">
                  Oops! Something went wrong
                </h1>
                
                <p className="text-gray-300 mb-8 text-lg leading-relaxed">
                  {error.message}
                </p>
                
                <motion.button
                  onClick={() => router.push("/")}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-black font-bold py-4 px-8 rounded-2xl transition-all duration-300 text-lg overflow-hidden"
                >
                  {/* Button glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300" />
                  
                  <span className="relative z-10">
                    🏠 Back to Home
                  </span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Enhanced Completed state with liquid glass
  if (currentTrackIndex >= tracks.length || generatedPlaylistUrl) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white overflow-hidden">
        <DiscoverLiquidBackground />
        
        <div className="relative z-20 flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-5xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ 
                duration: 0.8, 
                type: "spring",
                stiffness: 100,
                damping: 15
              }}
              className="text-center mb-8"
            >
              {/* Celebration Icon with Animation */}
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="text-8xl mb-6"
              >
                {generatedPlaylistUrl ? "🎊" : "🎉"}
              </motion.div>
              
              {/* Enhanced Title */}
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-5xl md:text-6xl font-black mb-6 bg-gradient-to-r from-white via-green-200 to-white bg-clip-text text-transparent"
              >
                {generatedPlaylistUrl ? "🎵 Playlist Created!" : "✨ Discovery Complete!"}
              </motion.h1>
            </motion.div>
              
            {/* Enhanced Stats Card */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white/10 backdrop-blur-2xl p-8 rounded-3xl mb-8 border border-white/20 shadow-2xl relative overflow-hidden"
              >
                {/* Glass shine effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-50" />
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold mb-6 text-green-400 text-center">🎯 Your Discovery Stats</h2>
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
                      className="bg-green-500/10 backdrop-blur-xl p-4 rounded-2xl border border-green-400/30"
                    >
                      <motion.div 
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                        className="text-4xl font-black text-green-400 mb-2"
                      >
                        {swipeStats.likes}
                      </motion.div>
                      <div className="text-sm font-medium text-gray-300">❤️ Loved</div>
                    </motion.div>
                    
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
                      className="bg-red-500/10 backdrop-blur-xl p-4 rounded-2xl border border-red-400/30"
                    >
                      <motion.div 
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                        className="text-4xl font-black text-red-400 mb-2"
                      >
                        {swipeStats.passes}
                      </motion.div>
                      <div className="text-sm font-medium text-gray-300">✖️ Passed</div>
                    </motion.div>
                    
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.9, type: "spring", stiffness: 200 }}
                      className="bg-blue-500/10 backdrop-blur-xl p-4 rounded-2xl border border-blue-400/30"
                    >
                      <motion.div 
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
                        className="text-4xl font-black text-blue-400 mb-2"
                      >
                        {swipeStats.total}
                      </motion.div>
                      <div className="text-sm font-medium text-gray-300">🎵 Total</div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>

            {/* Enhanced Liked Songs List */}
            {likedTracks.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="bg-white/10 backdrop-blur-2xl p-6 rounded-3xl mb-8 border border-white/20 shadow-2xl relative overflow-hidden"
              >
                {/* Glass shine effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-50" />
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                
                <div className="relative z-10">
                  <motion.h2 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.2 }}
                    className="text-2xl font-bold mb-6 text-green-400"
                  >
                    🎵 Your Curated Tracks ({likedTracks.length})
                  </motion.h2>
                  
                  <div className="max-h-80 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                    {likedTracks.map((track, index) => (
                      <motion.div 
                        key={track.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.3 + index * 0.1 }}
                        whileHover={{ scale: 1.02, x: 5 }}
                        className="flex items-center gap-4 p-4 bg-white/5 backdrop-blur-xl rounded-2xl hover:bg-white/10 transition-all duration-300 border border-white/10 hover:border-white/20 group"
                      >
                        <div className="relative">
                          <img
                            src={track.image}
                            alt={track.album}
                            className="w-14 h-14 rounded-xl object-cover shadow-lg group-hover:shadow-xl transition-shadow duration-300"
                          />
                          <div className="absolute -top-1 -left-1 bg-green-400 text-black text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                            {index + 1}
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate text-white group-hover:text-green-200 transition-colors">
                            {track.name}
                          </div>
                          <div className="text-sm text-gray-400 truncate group-hover:text-gray-300 transition-colors">
                            {track.artist}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {track.year} • {track.popularity}% popular
                          </div>
                        </div>
                        
                        <motion.button
                          onClick={() => window.open(track.external_urls.spotify, '_blank')}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          className="bg-green-500/20 hover:bg-green-500/40 text-green-400 hover:text-green-300 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-xl border border-green-400/30 hover:border-green-400/50 shadow-lg"
                          title="Open in Spotify"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.84-.179-.84-.6 0-.359.24-.66.54-.78 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.242 1.021zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                          </svg>
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Enhanced Action Buttons */}
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              className="flex flex-col gap-6"
            >
              {generatedPlaylistUrl ? (
                <div className="space-y-6">
                  {/* Success Card */}
                  <motion.div 
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="bg-green-500/10 backdrop-blur-2xl p-8 rounded-3xl border border-green-400/30 shadow-2xl relative overflow-hidden"
                  >
                    {/* Success glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 via-transparent to-transparent opacity-50" />
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-green-400/40 to-transparent" />
                    
                    <div className="relative z-10 text-center">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-4xl mb-4"
                      >
                        🎊
                      </motion.div>
                      <h3 className="text-2xl font-bold text-green-400 mb-3">Playlist Ready!</h3>
                      <p className="text-gray-300 mb-6 text-lg leading-relaxed">
                        Your collaborative playlist with <span className="text-green-400 font-semibold">{likedTracks.length} curated tracks</span> is ready to share with the world!
                      </p>
                      
                      <motion.button
                        onClick={() => handleOpenInSpotify(generatedPlaylistUrl)}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        className="group relative w-full bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-black font-bold py-4 px-8 rounded-2xl transition-all duration-300 text-lg overflow-hidden shadow-xl"
                      >
                        {/* Button glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300" />
                        
                        <span className="relative z-10 flex items-center justify-center gap-3">
                          🎧 Open Playlist in Spotify
                        </span>
                      </motion.button>
                    </div>
                  </motion.div>
                  
                  <motion.button
                    onClick={() => router.push("/")}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white py-4 px-6 rounded-2xl transition-all duration-300 border border-white/20 hover:border-white/40 font-medium"
                  >
                    🔄 Discover More Music
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-6">
                  <motion.button
                    onClick={handleGeneratePlaylist}
                    disabled={isGeneratingPlaylist || likedTracks.length === 0}
                    whileHover={{ scale: isGeneratingPlaylist || likedTracks.length === 0 ? 1 : 1.02, y: isGeneratingPlaylist || likedTracks.length === 0 ? 0 : -2 }}
                    whileTap={{ scale: isGeneratingPlaylist || likedTracks.length === 0 ? 1 : 0.98 }}
                    className="group relative w-full bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-black font-bold py-5 px-8 rounded-2xl transition-all duration-300 text-xl overflow-hidden shadow-xl"
                  >
                    {/* Button glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300" />
                    
                    <span className="relative z-10">
                      {isGeneratingPlaylist ? (
                        <div className="flex items-center justify-center gap-3">
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="rounded-full h-6 w-6 border-b-2 border-black"
                          />
                          ✨ Creating Your Playlist...
                        </div>
                      ) : (
                        `🎵 Create Playlist (${likedTracks.length} tracks)`
                      )}
                    </span>
                  </motion.button>
                  
                  <motion.button
                    onClick={() => router.push("/")}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white py-4 px-6 rounded-2xl transition-all duration-300 border border-white/20 hover:border-white/40 font-medium"
                  >
                    🏠 Start Over
                  </motion.button>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // Main swipe interface with liquid glass enhancement
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white overflow-hidden">
      <DiscoverLiquidBackground />
      
      <div className="relative z-20 flex min-h-screen flex-col">
        {/* Enhanced Header with Glass Effect */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex justify-between items-center p-6 bg-white/5 backdrop-blur-xl border-b border-white/10"
        >
          <motion.button
            onClick={() => router.push("/")}
            whileHover={{ scale: 1.05, x: -5 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 text-green-400 hover:text-green-300 text-xl font-medium transition-all duration-200 group"
          >
            <motion.span
              animate={{ x: [-2, 0, -2] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ←
            </motion.span>
            <span className="group-hover:text-white transition-colors">Spwipe</span>
          </motion.button>
          
          <div className="flex gap-3 items-center">
            <motion.div 
              className="bg-white/10 backdrop-blur-xl px-5 py-2 rounded-full border border-white/20 shadow-lg"
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-green-400 text-sm font-semibold">❤️ {swipeStats.likes}</span>
            </motion.div>
            
            <motion.div 
              className="bg-white/10 backdrop-blur-xl px-5 py-2 rounded-full border border-white/20 shadow-lg"
              whileHover={{ scale: 1.05 }}
            >
              <span className="text-red-400 text-sm font-semibold">✖️ {swipeStats.passes}</span>
            </motion.div>
            
            <motion.button
              onClick={() => setCurrentTrackIndex(tracks.length)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-blue-500/20 hover:bg-blue-500/30 backdrop-blur-xl px-5 py-2 rounded-full border border-blue-400/30 hover:border-blue-400/50 transition-all duration-200 shadow-lg"
              title="Skip to playlist creation"
            >
              <span className="text-blue-400 text-sm font-semibold">⏭️ Skip to Playlist</span>
            </motion.button>
            
            {likedTracks.length > 0 && (
              <motion.button
                onClick={() => setCurrentTrackIndex(tracks.length)}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-green-500/20 hover:bg-green-500/30 backdrop-blur-xl px-5 py-2 rounded-full border border-green-400/30 hover:border-green-400/50 transition-all duration-200 shadow-lg"
              >
                <span className="text-green-400 text-sm font-semibold">🎵 {likedTracks.length} ready</span>
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Enhanced Progress Bar with Glass Effect */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="px-6 mb-6"
        >
          <div className="relative w-full bg-white/10 backdrop-blur-xl h-2 rounded-full border border-white/20 shadow-lg overflow-hidden">
            <motion.div 
              className="bg-gradient-to-r from-green-400 to-emerald-500 h-full rounded-full relative"
              initial={{ width: 0 }}
              animate={{ width: `${(currentTrackIndex / tracks.length) * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 blur-sm opacity-50" />
            </motion.div>
          </div>
          
          <div className="flex justify-between text-sm text-gray-400 mt-3 font-medium">
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Track {currentTrackIndex + 1}
            </motion.span>
            <span>{tracks.length} total</span>
          </div>
        </motion.div>

        {/* Enhanced Main Content Area */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-lg">
            <AnimatePresence mode="wait">
              {currentTrack && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <SwipeCard
                    key={currentTrack.id}
                    track={currentTrack}
                    onSwipe={handleSwipe}
                    isPlaying={isPlaying}
                    onTogglePlay={togglePlayPause}
                    audioError={audioError}
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={handleSeekWithDragging}
                    formatTime={formatTime}
                    isDragging={isDragging}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Enhanced Footer with Glass Effect */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-6 text-center bg-white/5 backdrop-blur-xl border-t border-white/10"
        >
          <motion.p
            className="text-sm text-gray-300 mb-2 font-medium"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            🎵 Based on: <span className="text-green-400">{recommendations?.originalPlaylist?.name}</span>
          </motion.p>
          <p className="text-xs text-gray-500">
            ✨ AI-powered recommendations
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// Swipe Card Component
function SwipeCard({ 
  track, 
  onSwipe, 
  isPlaying, 
  onTogglePlay, 
  audioError,
  currentTime,
  duration,
  onSeek,
  formatTime,
  isDragging
}: { 
  track: Track; 
  onSwipe: (direction: "left" | "right") => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  audioError: string | null;
  currentTime: number;
  duration: number;
  onSeek: (time: number, dragging: boolean) => void;
  formatTime: (time: number) => string;
  isDragging: boolean;
}) {
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);

  const handleSwipe = (direction: "left" | "right") => {
    setExitDirection(direction);
    setTimeout(() => onSwipe(direction), 150);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ 
        opacity: 0, 
        scale: 0.8, 
        x: exitDirection === "left" ? -300 : exitDirection === "right" ? 300 : 0,
        y: exitDirection ? 20 : 50,
        rotate: exitDirection === "left" ? -15 : exitDirection === "right" ? 15 : 0
      }}
      transition={{ 
        duration: 0.4, 
        ease: [0.25, 0.46, 0.45, 0.94],
        type: "spring",
        stiffness: 100
      }}
      whileHover={{ scale: 1.02, y: -5 }}
      className="relative bg-white/10 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border border-white/20 overflow-hidden group"
    >
      {/* Enhanced glass shine effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="absolute -top-10 -right-10 w-20 h-20 bg-gradient-to-br from-green-400/30 to-emerald-500/20 rounded-full blur-xl opacity-50 group-hover:opacity-70 transition-opacity duration-300" />
      
      <div className="relative z-10">
      {/* Album Art with Spotify Link */}
      <div className="relative mb-6">
        <motion.div 
          className="aspect-square rounded-2xl overflow-hidden shadow-2xl cursor-pointer relative group"
          onClick={() => window.open(track.external_urls.spotify, '_blank')}
          whileHover={{ scale: 1.02 }}
          transition={{ duration: 0.2 }}
        >
          <motion.img
            src={track.image}
            alt={track.album}
            className="w-full h-full object-cover transition-all duration-300 group-hover:blur-sm group-hover:scale-105"
          />
          {/* Spotify Icon Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30">
            <div className="bg-green-500 p-4 rounded-full shadow-xl transform scale-0 group-hover:scale-100 transition-transform duration-300">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.84-.179-.84-.6 0-.359.24-.66.54-.78 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.242 1.021zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </div>
          </div>
        </motion.div>
        {track.similarity && (
          <div className="absolute -top-2 -right-2 bg-green-400 text-black px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            {Math.round(track.similarity * 100)}%
          </div>
        )}
      </div>

      {/* Track Info */}
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold mb-2 leading-tight">{track.name}</h3>
        <p className="text-gray-300 text-lg mb-1">{track.artist}</p>
        <p className="text-gray-500 text-sm">{track.album}</p>
        
        {/* Genres - Only show if available */}
        {track.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {track.genres.slice(0, 2).map((genre, index) => (
              <span 
                key={index} 
                className="text-xs bg-white/10 px-3 py-1 rounded-full text-gray-300 backdrop-blur-sm"
              >
                {genre}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Enhanced Audio Player with Liquid Glass */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 mb-6 border border-white/20 shadow-xl relative overflow-hidden group">
        {/* Player lighter glow effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/5 group-hover:to-white/5 transition-all duration-300" />
        <div className="relative z-10">
          {/* Enhanced Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center gap-3 text-sm text-gray-400 mb-2">
              <span className="text-xs w-10 text-right font-medium">{formatTime(currentTime)}</span>
              <div className="flex-1 relative">
                <div className="h-2 bg-white/20 backdrop-blur-sm rounded-full border border-white/10 overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full relative"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    transition={{ duration: 0.1 }}
                  >
                    {/* Progress glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 blur-sm opacity-50" />
                  </motion.div>
                </div>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={(e) => {
                  const seekTime = parseFloat(e.target.value);
                  onSeek(seekTime, true);
                }}
                onMouseUp={(e) => {
                  const seekTime = parseFloat(e.currentTarget.value);
                  onSeek(seekTime, false);
                }}
                className="absolute inset-0 w-full h-1 opacity-0 cursor-pointer"
                disabled={!track.stream_url}
              />
            </div>
              <span className="text-xs w-10 font-medium">{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Enhanced Control Buttons with Glass Effect */}
        <div className="flex justify-center items-center gap-6 relative z-10">
          <motion.button
            onClick={() => handleSwipe("left")}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white/10 hover:bg-red-500/30 text-white w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-xl border border-white/20 hover:border-red-400/50 shadow-xl group relative overflow-hidden"
          >
            {/* Button glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-400/0 to-red-500/0 group-hover:from-red-400/20 group-hover:to-red-500/20 rounded-full transition-all duration-300" />
            <svg className="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
          
          <motion.button
            onClick={onTogglePlay}
            whileHover={{ scale: track.stream_url ? 1.1 : 1, y: track.stream_url ? -2 : 0 }}
            whileTap={{ scale: track.stream_url ? 0.95 : 1 }}
            className={`text-white w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl border-2 relative overflow-hidden group ${
              track.stream_url
                ? 'bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/40 backdrop-blur-xl' 
                : 'bg-gray-600/20 cursor-not-allowed border-gray-600/50 backdrop-blur-xl'
            }`}
            disabled={!track.stream_url}
          >
            {/* Play button subtle glow effect */}
            {track.stream_url && (
              <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/10 group-hover:to-white/10 rounded-full transition-all duration-300" />
            )}
            <div className="relative z-10 flex items-center justify-center w-full h-full">
              {!track.stream_url ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                </svg>
              ) : isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" style={{ marginLeft: '2px' }}>
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </div>
          </motion.button>
          
          <motion.button
            onClick={() => handleSwipe("right")}
            whileHover={{ scale: 1.1, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white/10 hover:bg-green-500/30 text-white w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-xl border border-white/20 hover:border-green-400/50 shadow-xl group relative overflow-hidden"
          >
            {/* Like button glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-400/0 to-emerald-500/0 group-hover:from-green-400/20 group-hover:to-emerald-500/20 rounded-full transition-all duration-300" />
            <svg className="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </motion.button>
        </div>

          {/* Audio Error */}
          {audioError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 text-xs text-red-400 text-center bg-red-500/10 backdrop-blur-xl px-4 py-3 rounded-xl border border-red-400/20"
            >
              {audioError}
            </motion.div>
          )}
        </div>

        {/* Enhanced Track Details */}
        <div className="flex justify-center gap-4 text-xs text-gray-400 font-medium">
          <span>{track.year}</span>
          <span>•</span>
          <span>{track.popularity}% popular</span>
          {track.deezer_id && <span>• 🎵 Deezer</span>}
          {track.apple_music_id && <span>• 🍎 Apple Music</span>}
        </div>
      </div>

    </motion.div>
  );
}

function handleOpenInSpotify(url: string) {
  window.open(url, '_blank');
}