import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

// For now, we'll need your Spotify account credentials
// You'll provide these when we set up the system
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

// This will be your personal refresh token (we'll get this from you)
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN!;

// Get your personal Spotify access token
async function getPersonalSpotifyAccessToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get personal Spotify access token');
  }

  const data = await response.json();
  return data.access_token;
}

// Playlist creation response
const PlaylistCreationResponseSchema = z.object({
  playlistId: z.string(),
  playlistUrl: z.string(),
  name: z.string(),
  trackCount: z.number(),
});

export const playlistsRouter = createTRPCRouter({
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(300).optional(),
      trackIds: z.array(z.string()).min(1).max(100),
    }))
    .output(PlaylistCreationResponseSchema)
    .mutation(async ({ input }) => {
      const accessToken = await getPersonalSpotifyAccessToken();
      
      // Step 1: Get your Spotify user ID
      const userResponse = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to get user info');
      }

      const userData = await userResponse.json();
      const userId = userData.id;

      // Step 2: Create a new collaborative playlist
      const playlistResponse = await fetch(
        `https://api.spotify.com/v1/users/${userId}/playlists`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: input.name,
            description: input.description || `AI-generated playlist with ${input.trackIds.length} tracks - Created by Spwipe`,
            public: false,
            collaborative: true,
          }),
        }
      );

      if (!playlistResponse.ok) {
        throw new Error('Failed to create playlist');
      }

      const playlistData = await playlistResponse.json();

      // Step 3: Add tracks to the playlist
      const trackUris = input.trackIds.map(id => `spotify:track:${id}`);
      
      // Add tracks in batches of 100 (Spotify API limit)
      const batchSize = 100;
      for (let i = 0; i < trackUris.length; i += batchSize) {
        const batch = trackUris.slice(i, i + batchSize);
        
        const addTracksResponse = await fetch(
          `https://api.spotify.com/v1/playlists/${playlistData.id}/tracks`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              uris: batch,
            }),
          }
        );

        if (!addTracksResponse.ok) {
          console.error('Failed to add tracks batch:', batch);
          throw new Error('Failed to add tracks to playlist');
        }
      }

      return {
        playlistId: playlistData.id,
        playlistUrl: playlistData.external_urls.spotify,
        name: playlistData.name,
        trackCount: input.trackIds.length,
      };
    }),

  // Get playlist info (for verification)
  getInfo: publicProcedure
    .input(z.object({
      playlistId: z.string(),
    }))
    .query(async ({ input }) => {
      const accessToken = await getPersonalSpotifyAccessToken();
      
      const response = await fetch(
        `https://api.spotify.com/v1/playlists/${input.playlistId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get playlist info');
      }

      const data = await response.json();
      
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        trackCount: data.tracks.total,
        url: data.external_urls.spotify,
        collaborative: data.collaborative,
        public: data.public,
      };
    }),
});