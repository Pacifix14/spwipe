"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/trpc/react";

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  images: Array<{
    url: string;
    height: number | null;
    width: number | null;
  }> | null;
  tracks: {
    total: number;
  };
  owner: {
    id: string;
    display_name: string;
  };
}

interface PlaylistPickerProps {
  selectedPlaylistId: string | null;
  onPlaylistSelect: (playlistId: string) => void;
}

export default function PlaylistPicker({ selectedPlaylistId, onPlaylistSelect }: PlaylistPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const { data: playlistsData, isLoading, error } = api.spotify.getUserPlaylists.useQuery({
    limit: 50,
  });

  const playlists = playlistsData?.playlists || [];
  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);

  const handlePlaylistSelect = (playlistId: string) => {
    onPlaylistSelect(playlistId);
    setIsOpen(false);
  };

  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500 rounded-lg p-3">
        <p className="text-red-400 text-sm">Failed to load playlists</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-left transition-colors"
        disabled={isLoading}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {selectedPlaylist ? (
              <>
                <img
                  src={selectedPlaylist.images?.[0]?.url || "/placeholder-playlist.jpg"}
                  alt={selectedPlaylist.name}
                  className="w-8 h-8 rounded object-cover"
                />
                <div>
                  <p className="text-white font-medium">{selectedPlaylist.name}</p>
                  <p className="text-gray-400 text-sm">{selectedPlaylist.tracks.total} tracks</p>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-600 rounded"></div>
                <div>
                  <p className="text-gray-400">
                    {isLoading ? "Loading playlists..." : "Select a playlist"}
                  </p>
                </div>
              </div>
            )}
          </div>
          <motion.svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 z-50 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {playlists.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                <p>No playlists found</p>
                <p className="text-sm mt-1">Create a playlist in Spotify first</p>
              </div>
            ) : (
              playlists.map((playlist) => (
                <motion.button
                  key={playlist.id}
                  onClick={() => handlePlaylistSelect(playlist.id)}
                  className={`w-full p-3 text-left hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-b-0 ${
                    selectedPlaylistId === playlist.id ? "bg-gray-700" : ""
                  }`}
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.1 }}
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={playlist.images?.[0]?.url || "/placeholder-playlist.jpg"}
                      alt={playlist.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{playlist.name}</p>
                      <p className="text-gray-400 text-sm">
                        {playlist.tracks.total} tracks • {playlist.owner.display_name}
                      </p>
                      {playlist.description && (
                        <p className="text-gray-500 text-xs truncate mt-1">
                          {playlist.description}
                        </p>
                      )}
                    </div>
                    {selectedPlaylistId === playlist.id && (
                      <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </motion.button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}