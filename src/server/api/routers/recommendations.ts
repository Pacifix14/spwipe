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

  const data = await response.json() as { access_token: string };
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

// Search Deezer for track preview
async function searchDeezerTrack(trackName: string, artistName: string): Promise<{ id: string; preview: string } | null> {
  try {
    const query = encodeURIComponent(`${trackName} ${artistName}`);
    const response = await fetch(`https://api.deezer.com/search?q=${query}&limit=1`);
    
    if (!response.ok) return null;
    
    const data = await response.json() as { data: Array<{ id: string; preview: string }> };
    const track = data.data?.[0];
    
    if (track?.preview) {
      return {
        id: String(track.id),
        preview: track.preview,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Deezer search failed:', error);
    return null;
  }
}

export const recommendationsRouter = createTRPCRouter({
  getByPlaylist: publicProcedure
    .input(z.object({
      playlistId: z.string(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .output(RecommendationResponseSchema)
    .query(async ({ input }) => {
      const accessToken = await getSpotifyAccessToken();
      
      try {
        // Step 1: Analyze the input playlist to understand its characteristics
        const playlistAnalysis = await analyzePlaylistCharacteristics(input.playlistId, accessToken);
        
        // Step 2: Generate diverse search queries based on playlist analysis
        const searchQueries = generateSmartSearchQueries(playlistAnalysis);
        
        // Step 3: Search Spotify's catalog for similar songs
        const recommendations = await searchSpotifyForRecommendations(
          searchQueries, 
          accessToken, 
          input.limit,
          playlistAnalysis
        );

        return {
          tracks: recommendations,
          originalPlaylist: {
            id: playlistAnalysis.id,
            name: playlistAnalysis.name,
            description: playlistAnalysis.description,
            total_tracks: playlistAnalysis.total_tracks,
          },
        };

      } catch (error) {
        console.error('Smart recommendation failed:', error);
        throw new Error('Failed to generate recommendations: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }),
});

interface PlaylistTrack {
  track: {
    id: string;
    name: string;
    artists: Array<{ name: string; id: string }>;
    album: {
      name: string;
      release_date: string;
    };
    popularity: number;
  };
}

interface PlaylistData {
  id: string;
  name: string;
  description: string | null;
  tracks: {
    total: number;
    items: PlaylistTrack[];
  };
}

interface SpotifySearchTrack {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: {
    name: string;
    release_date: string;
    images: Array<{ url: string }>;
  };
  popularity: number;
  duration_ms: number;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifySearchTrack[];
  };
}

// Analyze a playlist to understand its musical characteristics
async function analyzePlaylistCharacteristics(playlistId: string, accessToken: string) {
  // Get playlist info and tracks
  const playlistResponse = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=id,name,description,tracks.total,tracks.items(track(id,name,artists(name,id),album(name,release_date),popularity))`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!playlistResponse.ok) {
    throw new Error('Failed to fetch playlist');
  }

  const playlistData = await playlistResponse.json() as PlaylistData;
  
  if (!playlistData.tracks?.items?.length) {
    throw new Error('No tracks found in playlist');
  }

  const allTracks = playlistData.tracks.items.filter(item => item.track?.id);

  if (allTracks.length === 0) {
    throw new Error('No valid tracks found in playlist');
  }

  // Get basic genres from first few artists only (reduce API calls)
  const firstFewArtists = [...new Set(allTracks.slice(0, 10).map(item => 
    item.track.artists[0]?.name ?? ''
  ))].filter(name => name);

  // Simplified analysis without heavy API calls
  const analysis = {
    id: playlistData.id,
    name: playlistData.name,
    description: playlistData.description,
    total_tracks: playlistData.tracks.total,
    
    // Basic metadata analysis
    avgPopularity: allTracks.reduce((sum: number, item) => sum + (item.track.popularity ?? 50), 0) / allTracks.length,
    avgYear: getAverageYear(allTracks),
    
    // Sample data for searches
    sampleTracks: allTracks.slice(0, 5).map(item => ({
      id: item.track.id,
      name: item.track.name,
      artist: item.track.artists[0]?.name ?? '',
    })),
    
    // Artist names for search queries
    topArtists: firstFewArtists.slice(0, 5),
    
    // Basic genre inference from track/artist names
    topGenres: inferGenresFromNames(allTracks),
  };

  return analysis;
}

// Generate smart search queries based on playlist analysis
function generateSmartSearchQueries(analysis: any) {
  const queries = [];

  // Genre-based searches
  for (const genre of analysis.topGenres.slice(0, 3)) {
    queries.push(`genre:"${genre}"`);
    queries.push(`genre:"${genre}" year:${analysis.avgYear - 3}-${analysis.avgYear + 3}`);
  }

  // Artist-based searches (similar artists)
  for (const artist of analysis.topArtists.slice(0, 2)) {
    queries.push(`artist:"${artist}"`);
  }

  // Year-based searches
  queries.push(`year:${analysis.avgYear - 2}-${analysis.avgYear + 2}`);
  
  // Popularity-based searches
  if (analysis.avgPopularity > 70) {
    queries.push('popular mainstream music');
  } else if (analysis.avgPopularity < 40) {
    queries.push('indie underground music');
  }

  // Genre-mood combinations
  for (const genre of analysis.topGenres.slice(0, 2)) {
    queries.push(`${genre} popular`);
    queries.push(`${genre} hits`);
  }

  // Sample track names for similar vibes
  for (const track of analysis.sampleTracks.slice(0, 2)) {
    queries.push(`"${track.name}" OR "${track.artist}"`);
  }

  return queries.slice(0, 12); // Limit number of queries to reduce API calls
}

// Search Spotify's catalog for recommendations
async function searchSpotifyForRecommendations(
  searchQueries: string[], 
  accessToken: string, 
  limit: number,
  analysis: any
) {
  const recommendations = [];
  const usedTrackIds = new Set();

  for (const query of searchQueries) {
    if (recommendations.length >= limit) break;

    try {
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!searchResponse.ok) continue;

      const searchData = await searchResponse.json() as SpotifySearchResponse;
      const tracks = searchData.tracks?.items ?? [];

      for (const track of tracks) {
        if (usedTrackIds.has(track.id) || recommendations.length >= limit) continue;

        // Calculate similarity score based on track characteristics
        const similarity = calculateSpotifyTrackSimilarity(track, analysis);
        
        if (similarity > 0.3) { // Threshold for inclusion
          const imageUrl = track.album.images?.[0]?.url ?? 'https://via.placeholder.com/300x300?text=No+Image';
          const releaseYear = track.album.release_date ? parseInt(track.album.release_date.split('-')[0] ?? String(new Date().getFullYear())) : new Date().getFullYear();
          
          // Try to get Deezer preview if Spotify doesn't have one
          let streamUrl = track.preview_url;
          let deezerId = undefined;
          
          if (!streamUrl) {
            const deezerData = await searchDeezerTrack(track.name, track.artists?.[0]?.name ?? '');
            if (deezerData) {
              streamUrl = deezerData.preview;
              deezerId = deezerData.id;
            }
          }
          
          recommendations.push({
            id: track.id,
            name: track.name,
            artist: track.artists?.[0]?.name ?? 'Unknown Artist',
            album: track.album.name,
            image: imageUrl,
            genres: [], // Would need separate artist API call for genres
            year: releaseYear,
            popularity: track.popularity ?? 0,
            external_urls: {
              spotify: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
            },
            similarity,
            duration_ms: track.duration_ms,
            smart_start_time: calculateSmartStartTime(track.duration_ms ?? 0, track.popularity ?? 0),
            stream_url: streamUrl ?? undefined,
            deezer_id: deezerId,
            apple_music_id: undefined,
          });

          usedTrackIds.add(track.id);
        }
      }
    } catch (error) {
      console.error('Search query failed:', query, error);
    }
  }

  // Sort by similarity and return
  return recommendations
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

// Calculate similarity between a track and playlist analysis
function calculateSpotifyTrackSimilarity(track: SpotifySearchTrack, analysis: any) {
  let score = 0;

  // Popularity similarity (30% weight)
  const popularityDiff = Math.abs(track.popularity - analysis.avgPopularity);
  const popularitySimilarity = Math.max(0, 1 - popularityDiff / 100);
  score += popularitySimilarity * 0.3;

  // Year similarity (20% weight)
  const trackYear = track.album.release_date ? parseInt(track.album.release_date.split('-')[0] ?? String(analysis.avgYear)) : analysis.avgYear;
  const yearDiff = Math.abs(trackYear - analysis.avgYear);
  const yearSimilarity = Math.max(0, 1 - yearDiff / 20);
  score += yearSimilarity * 0.2;

  // Artist diversity bonus (20% weight)
  const artistName = track.artists[0]?.name.toLowerCase() ?? '';
  const isNewArtist = !analysis.sampleTracks.some((sample: any) => 
    sample.artist.toLowerCase() === artistName
  );
  if (isNewArtist) score += 0.2;

  // Random factor for diversity (30% weight)
  score += Math.random() * 0.3;

  return Math.min(1, score);
}

// Helper functions
function getTopGenres(genres: string[]) {
  const genreCount: Record<string, number> = {};
  genres.forEach(genre => {
    genreCount[genre] = (genreCount[genre] || 0) + 1;
  });
  
  return Object.entries(genreCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([genre]) => genre);
}

function getAverageYear(tracks: PlaylistTrack[]) {
  const years = tracks
    .map(item => {
      const date = item.track.album.release_date;
      if (!date) return null;
      const yearStr = date.split('-')[0];
      if (!yearStr) return null;
      return parseInt(yearStr);
    })
    .filter((year): year is number => year !== null && year > 1950 && year <= new Date().getFullYear());
  
  return years.length > 0 
    ? Math.round(years.reduce((sum, year) => sum + year, 0) / years.length)
    : new Date().getFullYear();
}

function calculateSmartStartTime(durationMs: number, popularity: number): number {
  if (!durationMs || durationMs < 30000) return 0;
  
  const durationSeconds = durationMs / 1000;
  const chorusStartPercent = 0.25 + (Math.random() * 0.15);
  const popularityFactor = popularity / 100;
  const adjustedChorusPercent = chorusStartPercent - (popularityFactor * 0.1);
  
  let startTime = Math.floor(durationSeconds * adjustedChorusPercent);
  const maxStartTime = Math.max(0, durationSeconds - 30);
  startTime = Math.min(startTime, maxStartTime);
  startTime = Math.max(10, startTime);
  
  return startTime;
}

// Infer genres from track and artist names (basic heuristics)
function inferGenresFromNames(tracks: PlaylistTrack[]): string[] {
  const genreKeywords = new Map([
    ['electronic', ['electronic', 'edm', 'house', 'techno', 'dubstep']],
    ['rock', ['rock', 'metal', 'punk', 'grunge', 'alternative']],
    ['hip hop', ['hip hop', 'rap', 'trap', 'drill']],
    ['jazz', ['jazz', 'blues', 'swing']],
    ['classical', ['classical', 'orchestra', 'symphony']],
    ['country', ['country', 'folk', 'bluegrass']],
    ['reggae', ['reggae', 'ska', 'dub']],
    ['latin', ['latin', 'salsa', 'bachata', 'reggaeton']],
    ['funk', ['funk', 'soul', 'disco']],
    ['indie', ['indie', 'alternative', 'underground']],
    ['pop', ['pop', 'mainstream', 'commercial']],
  ]);

  const genreCount = new Map<string, number>();
  
  tracks.forEach(item => {
    const trackName = (item.track?.name ?? '').toLowerCase();
    const artistNames = (item.track?.artists ?? []).map(a => (a.name ?? '').toLowerCase()).join(' ');
    const combinedText = `${trackName} ${artistNames}`;
    
    genreKeywords.forEach((keywords, genre) => {
      const matches = keywords.filter(keyword => combinedText.includes(keyword)).length;
      if (matches > 0) {
        genreCount.set(genre, (genreCount.get(genre) || 0) + matches);
      }
    });
  });

  // Return top genres, defaulting to 'pop' if nothing matches
  const sortedGenres = Array.from(genreCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre);
    
  return sortedGenres.length > 0 ? sortedGenres : ['pop'];
}