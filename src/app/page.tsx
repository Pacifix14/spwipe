"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";

// Liquid Glass Background Component
function LiquidGlassBackground() {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 360]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Liquid Glass Orbs */}
      <motion.div
        style={{ y: y1, rotate }}
        className="absolute -top-48 -left-48 w-96 h-96 rounded-full"
      >
        <div className="w-full h-full bg-gradient-to-br from-green-400/30 via-blue-500/20 to-purple-600/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute inset-4 bg-gradient-to-tr from-white/10 to-transparent rounded-full backdrop-blur-xl border border-white/20" />
      </motion.div>
      
      <motion.div
        style={{ y: y2 }}
        className="absolute -bottom-48 -right-48 w-80 h-80 rounded-full"
      >
        <div className="w-full h-full bg-gradient-to-tl from-pink-400/30 via-purple-500/20 to-indigo-600/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-4 bg-gradient-to-bl from-white/10 to-transparent rounded-full backdrop-blur-xl border border-white/20" />
      </motion.div>
      
      <motion.div
        animate={{
          x: [0, 100, 0],
          y: [0, -50, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full"
      >
        <div className="w-full h-full bg-gradient-to-r from-cyan-400/20 via-emerald-500/20 to-teal-600/20 rounded-full blur-2xl" />
        <div className="absolute inset-6 bg-gradient-to-l from-white/5 to-transparent rounded-full backdrop-blur-lg border border-white/10" />
      </motion.div>

      {/* Floating Particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-white/20 rounded-full backdrop-blur-sm"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
            scale: 0
          }}
          animate={{
            y: [null, -20, -40, -20, 0],
            x: [null, Math.random() * 20 - 10, Math.random() * 20 - 10],
            scale: [0, 1, 0.5, 1, 0],
            opacity: [0, 1, 0.7, 1, 0]
          }}
          transition={{
            duration: 4 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 3,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
}

// Enhanced Floating Music Elements
function FloatingMusicElements() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const musicElements = ['🎵', '🎶', '🎼', '🎤', '🎧', '🎸'];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-lg opacity-10 text-green-400"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
            y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 50,
            rotate: 0,
            scale: 0.5
          }}
          animate={{
            y: -100,
            rotate: [0, 180, 360],
            scale: [0.5, 1, 0.5],
            x: [null, Math.random() * 100 - 50, Math.random() * 100 - 50]
          }}
          transition={{
            duration: 12 + Math.random() * 6,
            repeat: Infinity,
            delay: Math.random() * 8,
            ease: "easeInOut"
          }}
        >
          {musicElements[i % musicElements.length]}
        </motion.div>
      ))}
    </div>
  );
}

// Glass Card Component
function GlassCard({ children, className = "", delay = 0, ...props }: { children: React.ReactNode; className?: string; delay?: number; [key: string]: unknown }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.8, 
        delay,
        type: "spring",
        stiffness: 100,
        damping: 15
      }}
      whileHover={{ 
        scale: 1.02,
        y: -5,
        transition: { duration: 0.2 }
      }}
      className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl relative overflow-hidden ${className}`}
      {...props}
    >
      {/* Glass shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-50" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

export default function HomePage() {
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });
  
  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const titleY = useSpring(useTransform(scrollYProgress, [0, 0.5], [0, -50]), springConfig);
  const titleScale = useSpring(useTransform(scrollYProgress, [0, 0.5], [1, 0.8]), springConfig);

  const validateSpotifyUrl = (url: string) => {
    const spotifyPlaylistRegex = /^https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)(\?.*)?$/;
    return spotifyPlaylistRegex.test(url);
  };

  const extractPlaylistId = (url: string) => {
    const match = /playlist\/([a-zA-Z0-9]+)/.exec(url);
    return match ? match[1] : null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!validateSpotifyUrl(playlistUrl)) {
        throw new Error("Please enter a valid Spotify playlist URL");
      }

      const playlistId = extractPlaylistId(playlistUrl);
      if (!playlistId) {
        throw new Error("Could not extract playlist ID from URL");
      }

      // Navigate to the discover page with the playlist ID
      router.push(`/discover/${playlistId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = () => {
    setPlaylistUrl("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M");
  };

  return (
    <main ref={containerRef} className="relative min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white overflow-hidden">
      {/* Liquid Glass Background */}
      <LiquidGlassBackground />
      
      {/* Main Content */}
      <div className="relative z-20 flex min-h-screen flex-col items-center justify-center">
        <div className="container flex flex-col items-center justify-center gap-10 px-4 py-16  max-w-6xl">
          {/* Hero Section with Liquid Glass Effect */}
          <motion.div
            style={{ y: titleY, scale: titleScale }}
            className="text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: 1.2, 
                type: "spring",
                stiffness: 100,
                damping: 15
              }}
              className="relative"
            >
              <motion.h1 
                className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tight mb-6 relative"
                onHoverStart={() => setIsHovered(true)}
                onHoverEnd={() => setIsHovered(false)}
              >
                <motion.span 
                  className="relative inline-block"
                  animate={isHovered ? { 
                    textShadow: "0 0 20px rgba(34, 197, 94, 0.5)",
                    scale: 1.05
                  } : {}}
                  transition={{ duration: 0.3 }}
                >
                  Sp
                  <motion.span 
                    className="text-green-400 relative"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  >
                    wipe
                    {/* Liquid glow effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 opacity-20 blur-xl"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.2, 0.4, 0.2]
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  </motion.span>
                </motion.span>
              </motion.h1>
              
              {/* Animated subtitle with glass effect */}
              <GlassCard className="p-6 mx-auto max-w-2xl" delay={0.5}>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                  className="text-xl md:text-2xl text-gray-200 leading-relaxed"
                >
                  Discover new music through 
                  <motion.span 
                    className="text-green-400 font-semibold"
                    animate={{ 
                      color: ["#4ade80", "#10b981", "#059669", "#4ade80"]
                    }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    AI-powered recommendations
                  </motion.span>
                  {" "}and intuitive swiping
                </motion.p>
              </GlassCard>
            </motion.div>
          </motion.div>

          {/* Main Input Section with Liquid Glass */}
          <GlassCard className="w-full max-w-2xl p-8" delay={1}>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-4">
                <motion.label
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 }}
                  htmlFor="playlist-url"
                  className="block text-lg font-medium text-gray-200 mb-3"
                >
                  🎵 Spotify Playlist URL
                </motion.label>
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.3 }}
                  className="relative group"
                >
                  <input
                    type="url"
                    id="playlist-url"
                    value={playlistUrl}
                    onChange={(e) => setPlaylistUrl(e.target.value)}
                    placeholder="https://open.spotify.com/playlist/..."
                    className="w-full px-6 py-4 bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400/50 focus:border-green-400/50 transition-all duration-300 text-lg group-hover:bg-white/10"
                    required
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-emerald-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </motion.div>
              </div>

              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                    animate={{ opacity: 1, height: "auto", scale: 1 }}
                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                    className="bg-red-500/10 backdrop-blur-xl border border-red-400/30 rounded-2xl p-4"
                  >
                    <p className="text-red-300 text-center">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: isLoading ? 1 : 1.02, y: isLoading ? 0 : -2 }}
                whileTap={{ scale: 0.98 }}
                className="group relative w-full bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-black font-bold py-4 px-8 rounded-2xl transition-all duration-300 text-xl overflow-hidden"
              >
                {/* Button glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-300" />
                
                <span className="relative z-10">
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="rounded-full h-6 w-6 border-b-2 border-black mr-3"
                      />
                      Analyzing Magic...
                    </div>
                  ) : (
                    "🚀 Discover Music"
                  )}
                </span>
              </motion.button>
            </form>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="mt-8 text-center space-y-3"
            >
              <p className="text-gray-400 text-base">Don&apos;t have a playlist ready?</p>
              <motion.button
                onClick={handleExampleClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/20 hover:border-green-400/30 text-green-400 hover:text-green-300 px-6 py-3 rounded-xl transition-all duration-300 font-medium"
              >
                ✨ Try with Today&apos;s Top Hits
              </motion.button>
            </motion.div>
          </GlassCard>
        
          {/* How It Works Section with Advanced Glass Cards */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.8 }}
            className="text-center w-full"
          >
            <motion.h2 
              className="text-4xl md:text-5xl font-bold mb-12 bg-gradient-to-r from-white via-green-200 to-white bg-clip-text text-transparent"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 2 }}
            >
              ✨ How the Magic Works
            </motion.h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
              {[
                { 
                  emoji: "🔗", 
                  title: "Paste & Analyze", 
                  desc: "Share any Spotify playlist URL - no login required! Our AI immediately starts analyzing your musical taste.",
                  gradient: "from-blue-400/20 to-cyan-500/20"
                },
                { 
                  emoji: "🤖", 
                  title: "AI Recommendation", 
                  desc: "Our advanced algorithm discovers songs that match your playlist's vibe, energy, and genre preferences.",
                  gradient: "from-purple-400/20 to-pink-500/20"
                },
                { 
                  emoji: "💫", 
                  title: "Swipe & Create", 
                  desc: "Swipe through curated recommendations and get a personalized collaborative playlist instantly.",
                  gradient: "from-green-400/20 to-emerald-500/20"
                }
              ].map((item, index) => (
                <GlassCard
                  key={index}
                  className={`p-8 group cursor-pointer hover:scale-105 transition-all duration-500 bg-gradient-to-br ${item.gradient} hover:shadow-2xl hover:shadow-green-500/10`}
                  delay={2.2 + index * 0.2}
                >
                  <motion.div 
                    className="text-6xl mb-6"
                    whileHover={{ 
                      scale: 1.3, 
                      rotate: 10,
                      y: -10
                    }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 300,
                      damping: 10
                    }}
                  >
                    {item.emoji}
                  </motion.div>
                  
                  <motion.h3 
                    className="font-bold mb-4 text-xl text-green-400 group-hover:text-green-300 transition-colors"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.5 + index * 0.2 }}
                  >
                    {item.title}
                  </motion.h3>
                  
                  <motion.p 
                    className="text-gray-300 leading-relaxed group-hover:text-white transition-colors"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.7 + index * 0.2 }}
                  >
                    {item.desc}
                  </motion.p>
                  
                  {/* Hover glow effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-green-400/0 to-emerald-500/0 group-hover:from-green-400/5 group-hover:to-emerald-500/5 rounded-3xl transition-all duration-500"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                  />
                </GlassCard>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Enhanced Floating Music Elements */}
      <FloatingMusicElements />
      
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
    </main>
  );
}
