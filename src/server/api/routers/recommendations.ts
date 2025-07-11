import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

// Spotify API client initialization
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

// Get Spotify access token (client credentials flow)
async function getSpotifyAccessToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to get Spotify access token');
  }

  const data = await response.json();
  return data.access_token;
}

// Track data structure
const TrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  artist: z.string(),
  album: z.string(),
  image: z.string(),
  genres: z.array(z.string()),
  year: z.number(),
  popularity: z.number(),
  external_urls: z.object({
    spotify: z.string(),
  }),
  similarity: z.number().optional(),
  duration_ms: z.number().optional(),
  smart_start_time: z.number().optional(), // Best part to start playing (in seconds)
  stream_url: z.string().optional(), // Direct streaming URL
  deezer_id: z.string().optional(), // Deezer track ID for full playback
  apple_music_id: z.string().optional(), // Apple Music ID
});

// Recommendation response structure
const RecommendationResponseSchema = z.object({
  tracks: z.array(TrackSchema),
  originalPlaylist: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    total_tracks: z.number(),
  }).optional(),
});

export const recommendationsRouter = createTRPCRouter({
  getByPlaylist: publicProcedure
    .input(z.object({
      playlistId: z.string(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .output(RecommendationResponseSchema)
    .query(async ({ input }) => {
      const accessToken = await getSpotifyAccessToken();
      
      // Step 1: Get original playlist tracks
      const playlistResponse = await fetch(
        `https://api.spotify.com/v1/playlists/${input.playlistId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!playlistResponse.ok) {
        throw new Error('Failed to fetch playlist');
      }

      const playlistData = await playlistResponse.json();
      
      // Step 2: Get detailed track information
      const seedTracks = await Promise.all(
        playlistData.tracks.items.slice(0, 20).map(async (item: any) => {
          const track = item.track;
          const artistResponse = await fetch(
            `https://api.spotify.com/v1/artists/${track.artists[0].id}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );

          const artistData = artistResponse.ok ? await artistResponse.json() : null;
          
          const smartStartTime = calculateSmartStartTime(track.duration_ms, track.popularity);
          
          return {
            id: track.id,
            name: track.name,
            artist: track.artists[0].name,
            artistId: track.artists[0].id,
            album: track.album.name,
            image: track.album.images[0]?.url || '',
            genres: artistData?.genres || [],
            year: parseInt(track.album.release_date.split('-')[0]),
            popularity: track.popularity,
            external_urls: track.external_urls,
            duration_ms: track.duration_ms,
            smart_start_time: smartStartTime,
            stream_url: undefined,
            deezer_id: undefined,
            apple_music_id: undefined,
          };
        })
      );

      // Step 3: Generate recommendations using our custom algorithm
      const recommendations = await generateCustomRecommendations(seedTracks, accessToken, input.limit);

      return {
        tracks: recommendations,
        originalPlaylist: {
          id: playlistData.id,
          name: playlistData.name,
          description: playlistData.description,
          total_tracks: playlistData.tracks.total,
        },
      };
    }),
});

// Custom recommendation algorithm
async function generateCustomRecommendations(seedTracks: any[], accessToken: string, limit: number) {
  const recommendations = [];
  const usedTrackIds = new Set(seedTracks.map(t => t.id));

  // Extract common patterns from seed tracks
  const genres = [...new Set(seedTracks.flatMap(t => t.genres))];
  const artists = [...new Set(seedTracks.map(t => t.artist))];
  const avgYear = Math.round(seedTracks.reduce((sum, t) => sum + t.year, 0) / seedTracks.length);
  const avgPopularity = Math.round(seedTracks.reduce((sum, t) => sum + t.popularity, 0) / seedTracks.length);

  // Generate search queries
  const searchQueries = generateSearchQueries(genres, artists, avgYear, avgPopularity);

  // Search for candidate tracks
  for (const query of searchQueries) {
    if (recommendations.length >= limit) break;

    try {
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!searchResponse.ok) continue;

      const searchData = await searchResponse.json();
      const tracks = searchData.tracks.items;

      // Process and score tracks
      for (const track of tracks) {
        if (usedTrackIds.has(track.id)) continue;
        if (recommendations.length >= limit) break;

        // Get artist data for genres
        const artistResponse = await fetch(
          `https://api.spotify.com/v1/artists/${track.artists[0].id}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        const artistData = artistResponse.ok ? await artistResponse.json() : null;
        const trackGenres = artistData?.genres || [];

        // Calculate similarity score
        const similarity = calculateSimilarity(
          {
            genres: trackGenres,
            artist: track.artists[0].name,
            year: parseInt(track.album.release_date.split('-')[0]),
            popularity: track.popularity,
          },
          {
            genres,
            artists,
            avgYear,
            avgPopularity,
          }
        );

        // Add track if similarity is above threshold
        if (similarity > 0.1) {
          const smartStartTime = calculateSmartStartTime(track.duration_ms, track.popularity);
          
          // Search for streaming sources
          const streamingSources = await findStreamingSources(track.name, track.artists[0].name);
          
          recommendations.push({
            id: track.id,
            name: track.name,
            artist: track.artists[0].name,
            album: track.album.name,
            image: track.album.images[0]?.url || '',
            genres: trackGenres,
            year: parseInt(track.album.release_date.split('-')[0]),
            popularity: track.popularity,
            external_urls: track.external_urls,
            similarity,
            duration_ms: track.duration_ms,
            smart_start_time: smartStartTime,
            stream_url: streamingSources.stream_url,
            deezer_id: streamingSources.deezer_id,
            apple_music_id: streamingSources.apple_music_id,
          });

          usedTrackIds.add(track.id);
        }
      }
    } catch (error) {
      console.error('Search query failed:', query, error);
    }
  }

  // Sort by similarity score and return
  return recommendations
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

// Generate diverse search queries
function generateSearchQueries(genres: string[], artists: string[], avgYear: number, avgPopularity: number) {
  const queries = [];

  // Genre-based searches
  genres.slice(0, 5).forEach(genre => {
    queries.push(`genre:"${genre}"`);
    queries.push(`genre:"${genre}" year:${avgYear-3}-${avgYear+3}`);
  });

  // Artist-based searches
  artists.slice(0, 5).forEach(artist => {
    queries.push(`artist:"${artist}"`);
  });

  // Year-based searches
  queries.push(`year:${avgYear-2}-${avgYear+2}`);
  queries.push(`year:${avgYear-5}-${avgYear+5}`);

  // Popularity-based searches
  if (avgPopularity > 70) {
    queries.push('tag:popular');
  } else if (avgPopularity < 30) {
    queries.push('tag:indie');
  }

  // Combined searches
  if (genres.length > 0) {
    queries.push(`genre:"${genres[0]}" year:${avgYear-3}-${avgYear+3}`);
  }

  return queries;
}

// Calculate similarity between a candidate track and seed patterns
function calculateSimilarity(candidate: any, patterns: any) {
  let score = 0;

  // Genre similarity (30% weight)
  const genreOverlap = candidate.genres.filter((g: string) => 
    patterns.genres.some((pg: string) => pg.toLowerCase().includes(g.toLowerCase()))
  ).length;
  score += (genreOverlap / Math.max(candidate.genres.length, 1)) * 0.3;

  // Artist similarity (20% weight)
  const artistMatch = patterns.artists.some((a: string) => 
    a.toLowerCase() === candidate.artist.toLowerCase()
  );
  score += artistMatch ? 0.2 : 0;

  // Year similarity (15% weight)
  const yearDiff = Math.abs(candidate.year - patterns.avgYear);
  const yearSimilarity = Math.max(0, 1 - yearDiff / 20); // 20-year max difference
  score += yearSimilarity * 0.15;

  // Popularity similarity (15% weight)
  const popularityDiff = Math.abs(candidate.popularity - patterns.avgPopularity);
  const popularitySimilarity = Math.max(0, 1 - popularityDiff / 100);
  score += popularitySimilarity * 0.15;

  // Randomness factor (20% weight) - for diversity
  score += Math.random() * 0.2;

  return score;
}

// Calculate smart start time for audio playback (find the best part/chorus)
function calculateSmartStartTime(durationMs: number, popularity: number): number {
  if (!durationMs || durationMs < 30000) return 0; // If less than 30 seconds, start at beginning
  
  const durationSeconds = durationMs / 1000;
  
  // Common music structure patterns
  // Most songs have chorus around 25-40% of the song
  const chorusStartPercent = 0.25 + (Math.random() * 0.15); // 25-40%
  
  // For popular songs, chorus tends to be earlier
  const popularityFactor = popularity / 100;
  const adjustedChorusPercent = chorusStartPercent - (popularityFactor * 0.1);
  
  // Calculate start time
  let startTime = Math.floor(durationSeconds * adjustedChorusPercent);
  
  // Ensure we don't start too late (leave at least 30 seconds to play)
  const maxStartTime = Math.max(0, durationSeconds - 30);
  startTime = Math.min(startTime, maxStartTime);
  
  // Ensure minimum start time of 10 seconds (skip intro)
  startTime = Math.max(10, startTime);
  
  return startTime;
}

// Find streaming sources for a track using multiple services
async function findStreamingSources(trackName: string, artistName: string): Promise<{
  stream_url?: string;
  deezer_id?: string;
  apple_music_id?: string;
}> {
  try {
    const query = `${trackName} ${artistName}`;
    
    // Try Deezer first (has free streaming)
    const deezerData = await searchDeezer(query);
    if (deezerData) {
      return {
        stream_url: deezerData.preview,
        deezer_id: deezerData.id,
      };
    }
    
    // Fallback to other services
    const appleData = await searchAppleMusic(query);
    if (appleData) {
      return {
        stream_url: appleData.previewUrl,
        apple_music_id: appleData.trackId,
      };
    }
    
    // Final fallback to a generic streaming service
    const genericStream = await searchGenericStreaming(query);
    if (genericStream) {
      return {
        stream_url: genericStream.url,
      };
    }
    
    return {};
  } catch (error) {
    console.error('Streaming search error:', error);
    return {};
  }
}

// Search Deezer for tracks (free 30-second previews)
async function searchDeezer(query: string): Promise<{id: string, preview: string} | null> {
  try {
    const searchUrl = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const track = data.data?.[0];
    
    if (!track || !track.preview) return null;
    
    return {
      id: track.id.toString(),
      preview: track.preview,
    };
  } catch (error) {
    console.error('Deezer search error:', error);
    return null;
  }
}

// Search Apple Music
async function searchAppleMusic(query: string): Promise<{trackId: string, previewUrl: string} | null> {
  try {
    // Note: Apple Music requires authentication, this is a placeholder
    // In production, you'd need Apple Music API credentials
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const track = data.results?.[0];
    
    if (!track || !track.previewUrl) return null;
    
    return {
      trackId: track.trackId.toString(),
      previewUrl: track.previewUrl,
    };
  } catch (error) {
    console.error('Apple Music search error:', error);
    return null;
  }
}

// Generic streaming service fallback
async function searchGenericStreaming(query: string): Promise<{url: string} | null> {
  try {
    // This would integrate with services like:
    // - AudioMack
    // - SoundCloud
    // - Jamendo
    // - Free Music Archive
    
    // For now, return null - you can implement specific services
    return null;
  } catch (error) {
    console.error('Generic streaming search error:', error);
    return null;
  }
}