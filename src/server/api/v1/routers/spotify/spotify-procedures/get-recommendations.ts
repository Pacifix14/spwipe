import { z } from "zod";
import { protectedProcedure } from "@/server/api/trpc";

// Force Node.js runtime for this API route
export const runtime = 'nodejs';

const SpotifyTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  artists: z.array(z.object({
    name: z.string(),
    id: z.string(),
  })),
  album: z.object({
    name: z.string(),
    images: z.array(z.object({
      url: z.string(),
      height: z.number(),
      width: z.number(),
    })),
  }),
  preview_url: z.string().nullable(),
  external_urls: z.object({
    spotify: z.string(),
  }),
  popularity: z.number(),
  duration_ms: z.number(),
});

const GetRecommendationsInputSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  market: z.string().default("US"),
  seed_artists: z.array(z.string()).optional(),
  seed_genres: z.array(z.string()).optional(),
  seed_tracks: z.array(z.string()).optional(),
});

const GetRecommendationsOutputSchema = z.object({
  tracks: z.array(SpotifyTrackSchema),
  seeds: z.array(z.object({
    initialPoolSize: z.number(),
    afterFilteringSize: z.number(),
    afterRelinkingSize: z.number(),
    id: z.string(),
    type: z.string(),
    href: z.string(),
  })),
});

export const getRecommendations = protectedProcedure
  .input(GetRecommendationsInputSchema)
  .output(GetRecommendationsOutputSchema)
  .query(async ({ ctx, input }) => {
    const session = ctx.session;
    
    // Get Spotify access token from JWT session
    const accessToken = session.accessToken;
    
    if (!accessToken) {
      throw new Error("No Spotify access token found in session");
    }

    // If no seeds provided, get user's top tracks and artists
    let seedTracks = input.seed_tracks || [];
    let seedArtists = input.seed_artists || [];

    if (seedTracks.length === 0 && seedArtists.length === 0) {
      // Get user's top tracks
      const topTracksResponse = await fetch(
        "https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=medium_term",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (topTracksResponse.ok) {
        const topTracks = await topTracksResponse.json();
        seedTracks = topTracks.items.slice(0, 2).map((track: any) => track.id);
      }

      // Get user's top artists
      const topArtistsResponse = await fetch(
        "https://api.spotify.com/v1/me/top/artists?limit=5&time_range=medium_term",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (topArtistsResponse.ok) {
        const topArtists = await topArtistsResponse.json();
        seedArtists = topArtists.items.slice(0, 2).map((artist: any) => artist.id);
      }
    }

    // WORKAROUND: Since /recommendations is restricted, we'll use alternative approach
    // 1. Get user's top tracks (different time ranges for variety)
    // 2. Get user's top artists and their albums
    // 3. Get tracks from those albums
    // 4. Mix with user's saved tracks for diversity

    const allTracks: any[] = [];
    const usedTrackIds = new Set<string>();

    try {
      // Strategy 1: Get user's top tracks (different time ranges for variety)
      const timeRanges = ['short_term', 'medium_term', 'long_term'];
      
      for (const timeRange of timeRanges) {
        const topTracksResponse = await fetch(
          `https://api.spotify.com/v1/me/top/tracks?limit=20&time_range=${timeRange}&market=${input.market}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (topTracksResponse.ok) {
          const topTracks = await topTracksResponse.json();
          // Add tracks we haven't seen yet
          for (const track of topTracks.items) {
            if (!usedTrackIds.has(track.id)) {
              allTracks.push(track);
              usedTrackIds.add(track.id);
            }
          }
        }
      }

      // Strategy 2: Get user's top artists and their albums
      const topArtistsResponse = await fetch(
        `https://api.spotify.com/v1/me/top/artists?limit=10&time_range=medium_term&market=${input.market}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (topArtistsResponse.ok) {
        const topArtists = await topArtistsResponse.json();
        
        // For each top artist, get their albums
        for (const artist of topArtists.items.slice(0, 3)) { // Limit to 3 artists to avoid too many requests
          const albumsResponse = await fetch(
            `https://api.spotify.com/v1/artists/${artist.id}/albums?limit=5&include_groups=album,single&market=${input.market}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (albumsResponse.ok) {
            const albums = await albumsResponse.json();
            
            // Get tracks from each album
            for (const album of albums.items.slice(0, 2)) { // Limit to 2 albums per artist
              const albumTracksResponse = await fetch(
                `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=20&market=${input.market}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                }
              );

              if (albumTracksResponse.ok) {
                const albumTracks = await albumTracksResponse.json();
                
                // Add tracks we haven't seen yet
                for (const track of albumTracks.items) {
                  if (!usedTrackIds.has(track.id)) {
                    // Convert album track format to full track format
                    const fullTrack = {
                      ...track,
                      album: {
                        name: album.name,
                        images: album.images
                      },
                      popularity: 50 // Default popularity since we can't get it from album tracks
                    };
                    allTracks.push(fullTrack);
                    usedTrackIds.add(track.id);
                  }
                }
              }
            }
          }
        }
      }

      // Strategy 3: Get user's liked tracks for more variety
      const likedTracksResponse = await fetch(
        `https://api.spotify.com/v1/me/tracks?limit=50&market=${input.market}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (likedTracksResponse.ok) {
        const likedTracks = await likedTracksResponse.json();
        for (const item of likedTracks.items) {
          if (!usedTrackIds.has(item.track.id)) {
            allTracks.push(item.track);
            usedTrackIds.add(item.track.id);
          }
        }
      }

      // Shuffle and limit the results
      const shuffled = allTracks.sort(() => Math.random() - 0.5);
      const limitedTracks = shuffled.slice(0, input.limit);

      console.log(`Found ${limitedTracks.filter(t => t.preview_url).length} out of ${limitedTracks.length} tracks with Spotify preview URLs`);

      return {
        tracks: limitedTracks,
        seeds: [] // No seeds since we're not using the recommendations endpoint
      };

    } catch (error) {
      console.error("Error getting alternative recommendations:", error);
      
      // Fallback: Return empty with helpful error
      throw new Error("Unable to get recommendations. This may be due to Spotify API restrictions for new applications.");
    }
  });