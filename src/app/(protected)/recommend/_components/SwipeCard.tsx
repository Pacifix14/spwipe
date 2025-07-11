"use client";

import { useState, useRef } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import PlaylistPicker from "./PlaylistPicker";

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string }[];
  };
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}

interface SwipeCardProps {
  track: Track;
  onSwipe: (direction: "left" | "right") => void;
  onPlayPause: () => void;
  isPlaying: boolean;
  selectedPlaylistId: string | null;
  onPlaylistSelect: (playlistId: string) => void;
}

export default function SwipeCard({ track, onSwipe, onPlayPause, isPlaying, selectedPlaylistId, onPlaylistSelect }: SwipeCardProps) {
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-30, 30]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    const { offset, velocity } = info;
    
    if (offset.x > threshold || velocity.x > 500) {
      setExitDirection("right");
      onSwipe("right");
    } else if (offset.x < -threshold || velocity.x < -500) {
      setExitDirection("left");
      onSwipe("left");
    }
  };

  const handleButtonSwipe = (direction: "left" | "right") => {
    setExitDirection(direction);
    onSwipe(direction);
  };

  const cardVariants = {
    initial: { scale: 0.8, opacity: 0, y: 50 },
    animate: { scale: 1, opacity: 1, y: 0 },
    exit: {
      x: exitDirection === "left" ? -1000 : 1000,
      opacity: 0,
      scale: 0.8,
      rotate: exitDirection === "left" ? -30 : 30,
      transition: { duration: 0.3 }
    }
  };

  return (
    <motion.div
      ref={cardRef}
      className="relative w-full max-w-sm mx-auto"
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border-2 border-gray-700 relative">
        {/* Swipe indicators */}
        <motion.div
          className="absolute top-6 left-6 z-10 bg-red-500 text-white px-4 py-2 rounded-full font-bold text-lg shadow-lg"
          style={{ opacity: useTransform(x, [-100, 0], [1, 0]) }}
        >
          PASS
        </motion.div>
        <motion.div
          className="absolute top-6 right-6 z-10 bg-green-500 text-white px-4 py-2 rounded-full font-bold text-lg shadow-lg"
          style={{ opacity: useTransform(x, [0, 100], [0, 1]) }}
        >
          LIKE
        </motion.div>

        {/* Album artwork */}
        <div className="relative aspect-square">
          <img
            src={track.album.images[0]?.url || "/placeholder-album.jpg"}
            alt={track.album.name}
            className="w-full h-full object-cover"
          />
          
          {/* Play/Pause button overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <motion.button
              onClick={onPlayPause}
              className="bg-white/90 backdrop-blur-sm rounded-full p-4 shadow-lg hover:bg-white transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {isPlaying ? (
                <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </motion.button>
          </div>
        </div>

        {/* Track info */}
        <div className="p-6 bg-gradient-to-b from-gray-900 to-gray-800">
          <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
            {track.name}
          </h3>
          <p className="text-green-400 mb-4 line-clamp-1">
            {track.artists.map(artist => artist.name).join(", ")}
          </p>
          <p className="text-sm text-gray-400 mb-4 line-clamp-1">
            {track.album.name}
          </p>

          {/* Playlist picker */}
          <div className="mb-4">
            <PlaylistPicker 
              selectedPlaylistId={selectedPlaylistId}
              onPlaylistSelect={onPlaylistSelect}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 justify-center">
            <motion.button
              onClick={() => handleButtonSwipe("left")}
              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-3 shadow-lg transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </motion.button>
            
            <motion.button
              onClick={() => handleButtonSwipe("right")}
              className="bg-green-500 hover:bg-green-600 text-white rounded-full p-3 shadow-lg transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}