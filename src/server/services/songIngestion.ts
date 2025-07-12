/**
 * Song Data Ingestion Pipeline
 * Fetches, processes, and stores songs with vector embeddings
 */

import { db } from "@/server/db";
import { embeddingService } from "./embedding";

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    release_date: string;
    images: Array<{ url: string }>;
  };
  popularity: number;
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
}

interface SpotifyAudioFeatures {
  id: string;
  acousticness: number;
  danceability: number;
  energy: number;
  instrumentalness: number;
  liveness: number;
  loudness: number;
  speechiness: number;
  tempo: number;
  valence: number;
  mode: number;
  key: number;
  time_signature: number;
}

interface SpotifyArtist {
  id: string;
  genres: string[];
}

export class SongIngestionService {
  private spotifyAccessToken: string | null = null;

  constructor(private clientId: string, private clientSecret: string) {}

  /**
   * Get Spotify access token for API calls
   */
  private async getSpotifyAccessToken(): Promise<string> {
    if (this.spotifyAccessToken) {
      return this.spotifyAccessToken;
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error('Failed to get Spotify access token');
    }

    const data = await response.json() as { access_token: string };
    this.spotifyAccessToken = data.access_token;
    return this.spotifyAccessToken;
  }

  /**
   * Fetch tracks from a Spotify playlist
   */
  async fetchPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
    const token = await this.getSpotifyAccessToken();
    const tracks: SpotifyTrack[] = [];
    let offset = 0;
    const limit = 50;

    while (true) {
      const response = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}&fields=items(track(id,name,artists(name),album(name,release_date,images),popularity,duration_ms,preview_url,external_urls))`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch playlist tracks: ${response.statusText}`);
      }

      const data = await response.json() as {
        items: Array<{ track: SpotifyTrack }>;
        next: string | null;
      };

      tracks.push(...data.items.map(item => item.track).filter(track => track?.id));

      if (!data.next) break;
      offset += limit;
    }

    return tracks;
  }

  /**
   * Fetch audio features for multiple tracks
   */
  async fetchAudioFeatures(trackIds: string[]): Promise<SpotifyAudioFeatures[]> {
    const token = await this.getSpotifyAccessToken();
    const features: SpotifyAudioFeatures[] = [];
    const batchSize = 100; // Spotify's maximum

    for (let i = 0; i < trackIds.length; i += batchSize) {
      const batch = trackIds.slice(i, i + batchSize);
      const response = await fetch(
        `https://api.spotify.com/v1/audio-features?ids=${batch.join(',')}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        console.error(`Failed to fetch audio features for batch: ${response.statusText}`);
        continue;
      }

      const data = await response.json() as {
        audio_features: (SpotifyAudioFeatures | null)[];
      };

      features.push(...data.audio_features.filter((f): f is SpotifyAudioFeatures => f !== null));
    }

    return features;
  }

  /**
   * Fetch artist information to get genres
   */
  async fetchArtists(artistIds: string[]): Promise<SpotifyArtist[]> {
    const token = await this.getSpotifyAccessToken();
    const artists: SpotifyArtist[] = [];
    const batchSize = 50; // Spotify's maximum for artists

    for (let i = 0; i < artistIds.length; i += batchSize) {
      const batch = artistIds.slice(i, i + batchSize);
      const response = await fetch(
        `https://api.spotify.com/v1/artists?ids=${batch.join(',')}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        console.error(`Failed to fetch artists for batch: ${response.statusText}`);
        continue;
      }

      const data = await response.json() as {
        artists: SpotifyArtist[];
      };

      artists.push(...data.artists);
    }

    return artists;
  }

  /**
   * Process and store a single song with vectors
   */
  async processSong(
    track: SpotifyTrack,
    audioFeatures: SpotifyAudioFeatures,
    genres: string[]
  ): Promise<void> {
    try {
      // Check if song already exists
      const existing = await db.song.findUnique({
        where: { spotifyId: track.id },
      });

      if (existing) {
        console.log(`Song ${track.name} already exists, skipping...`);
        return;
      }

      // Create embeddings
      const songMetadata = {
        track,
        audioFeatures,
        genres,
      };

      const audioFeatureVector = embeddingService.createAudioFeatureVector(audioFeatures);
      const genreVector = embeddingService.createGenreVector(genres);
      const combinedVector = embeddingService.createCombinedVector(songMetadata);

      // Parse release date
      let releaseDate: Date | null = null;
      try {
        releaseDate = new Date(track.album.release_date);
      } catch {
        // Invalid date, keep as null
      }

      // Store in database
      await db.song.create({
        data: {
          spotifyId: track.id,
          name: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          album: track.album.name,
          imageUrl: track.album.images[0]?.url ?? null,
          previewUrl: track.preview_url,
          externalUrls: track.external_urls,
          
          // Audio features
          acousticness: audioFeatures.acousticness,
          danceability: audioFeatures.danceability,
          energy: audioFeatures.energy,
          instrumentalness: audioFeatures.instrumentalness,
          liveness: audioFeatures.liveness,
          loudness: audioFeatures.loudness,
          speechiness: audioFeatures.speechiness,
          tempo: audioFeatures.tempo,
          valence: audioFeatures.valence,
          mode: audioFeatures.mode,
          key: audioFeatures.key,
          timeSignature: audioFeatures.time_signature,
          
          // Metadata
          popularity: track.popularity,
          releaseDate,
          durationMs: track.duration_ms,
          genres,
          
          // Vectors (stored as JSON arrays)
          audioFeatureVector: audioFeatureVector,
          genreVector: genreVector,
          combinedVector: combinedVector,
        },
      });

      console.log(`Processed and stored: ${track.name} by ${track.artists.map(a => a.name).join(', ')}`);
    } catch (error) {
      console.error(`Error processing song ${track.name}:`, error);
    }
  }

  /**
   * Process an entire playlist and store all songs
   */
  async ingestPlaylist(playlistId: string): Promise<{
    totalTracks: number;
    processedTracks: number;
    playlistAnalysis: unknown;
  }> {
    console.log(`Starting ingestion for playlist: ${playlistId}`);

    // Fetch playlist tracks
    const tracks = await this.fetchPlaylistTracks(playlistId);
    console.log(`Found ${tracks.length} tracks in playlist`);

    if (tracks.length === 0) {
      throw new Error('No tracks found in playlist');
    }

    // Fetch audio features
    const trackIds = tracks.map(t => t.id);
    const audioFeatures = await this.fetchAudioFeatures(trackIds);
    console.log(`Fetched audio features for ${audioFeatures.length} tracks`);

    // Get all unique artist IDs and fetch their genres
    const artistIds = [...new Set(tracks.flatMap(t => t.artists.map(a => a.name)))];
    const artistMap = new Map<string, string[]>();
    
    // For simplicity, we'll use a basic genre mapping for now
    // In production, you'd fetch actual artist data from Spotify
    for (const artistName of artistIds) {
      artistMap.set(artistName, this.inferGenresFromArtistName(artistName));
    }

    // Process each song
    let processedCount = 0;
    const audioFeaturesMap = new Map(audioFeatures.map(af => [af.id, af]));

    for (const track of tracks) {
      const trackAudioFeatures = audioFeaturesMap.get(track.id);
      if (!trackAudioFeatures) {
        console.warn(`No audio features found for track: ${track.name}`);
        continue;
      }

      const trackGenres = [...new Set(track.artists.flatMap(a => artistMap.get(a.name) ?? []))];
      
      await this.processSong(track, trackAudioFeatures, trackGenres);
      processedCount++;
    }

    // Create playlist analysis
    const playlistAnalysis = await this.createPlaylistAnalysis(playlistId, tracks, audioFeatures);

    console.log(`Ingestion complete: ${processedCount}/${tracks.length} tracks processed`);

    return {
      totalTracks: tracks.length,
      processedTracks: processedCount,
      playlistAnalysis,
    };
  }

  /**
   * Create aggregated playlist analysis
   */
  private async createPlaylistAnalysis(
    playlistId: string,
    tracks: SpotifyTrack[],
    audioFeatures: SpotifyAudioFeatures[]
  ) {
    if (audioFeatures.length === 0) {
      throw new Error('No audio features available for playlist analysis');
    }

    // Calculate averages
    const avgFeatures = {
      acousticness: audioFeatures.reduce((sum, af) => sum + af.acousticness, 0) / audioFeatures.length,
      danceability: audioFeatures.reduce((sum, af) => sum + af.danceability, 0) / audioFeatures.length,
      energy: audioFeatures.reduce((sum, af) => sum + af.energy, 0) / audioFeatures.length,
      instrumentalness: audioFeatures.reduce((sum, af) => sum + af.instrumentalness, 0) / audioFeatures.length,
      liveness: audioFeatures.reduce((sum, af) => sum + af.liveness, 0) / audioFeatures.length,
      loudness: audioFeatures.reduce((sum, af) => sum + af.loudness, 0) / audioFeatures.length,
      speechiness: audioFeatures.reduce((sum, af) => sum + af.speechiness, 0) / audioFeatures.length,
      tempo: audioFeatures.reduce((sum, af) => sum + af.tempo, 0) / audioFeatures.length,
      valence: audioFeatures.reduce((sum, af) => sum + af.valence, 0) / audioFeatures.length,
      popularity: tracks.reduce((sum, t) => sum + t.popularity, 0) / tracks.length,
    };

    // Find dominant characteristics
    const modes = audioFeatures.map(af => af.mode);
    const keys = audioFeatures.map(af => af.key);
    const timeSignatures = audioFeatures.map(af => af.time_signature);

    const dominantMode = this.getMostFrequent(modes);
    const dominantKey = this.getMostFrequent(keys);
    const dominantTimeSignature = this.getMostFrequent(timeSignatures);

    // Get all genres from tracks
    const allGenres = tracks.flatMap(t => 
      t.artists.flatMap(a => this.inferGenresFromArtistName(a.name))
    );
    const genreFreq = this.getFrequencyMap(allGenres);
    const dominantGenres = Object.entries(genreFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([genre]) => genre);

    // Create playlist vector by averaging song vectors
    const songVectors: number[][] = [];
    for (const track of tracks) {
      const audioFeature = audioFeatures.find(af => af.id === track.id);
      if (audioFeature) {
        const genres = track.artists.flatMap(a => this.inferGenresFromArtistName(a.name));
        const vector = embeddingService.createCombinedVector({
          track,
          audioFeatures: audioFeature,
          genres,
        });
        songVectors.push(vector);
      }
    }

    const playlistVector = embeddingService.createPlaylistVector(songVectors);

    // Store playlist analysis
    const analysis = await db.playlistAnalysis.upsert({
      where: { spotifyPlaylistId: playlistId },
      create: {
        spotifyPlaylistId: playlistId,
        name: `Playlist ${playlistId}`,
        avgAcousticness: avgFeatures.acousticness,
        avgDanceability: avgFeatures.danceability,
        avgEnergy: avgFeatures.energy,
        avgInstrumentalness: avgFeatures.instrumentalness,
        avgLiveness: avgFeatures.liveness,
        avgLoudness: avgFeatures.loudness,
        avgSpeechiness: avgFeatures.speechiness,
        avgTempo: avgFeatures.tempo,
        avgValence: avgFeatures.valence,
        avgPopularity: avgFeatures.popularity,
        dominantGenres,
        dominantKey,
        dominantMode,
        dominantTimeSignature,
        playlistVector: playlistVector,
        trackCount: tracks.length,
        totalDurationMs: BigInt(tracks.reduce((sum, t) => sum + t.duration_ms, 0)),
      },
      update: {
        avgAcousticness: avgFeatures.acousticness,
        avgDanceability: avgFeatures.danceability,
        avgEnergy: avgFeatures.energy,
        avgInstrumentalness: avgFeatures.instrumentalness,
        avgLiveness: avgFeatures.liveness,
        avgLoudness: avgFeatures.loudness,
        avgSpeechiness: avgFeatures.speechiness,
        avgTempo: avgFeatures.tempo,
        avgValence: avgFeatures.valence,
        avgPopularity: avgFeatures.popularity,
        dominantGenres,
        dominantKey,
        dominantMode,
        dominantTimeSignature,
        playlistVector: playlistVector,
        trackCount: tracks.length,
        totalDurationMs: BigInt(tracks.reduce((sum, t) => sum + t.duration_ms, 0)),
      },
    });

    return analysis;
  }

  /**
   * Basic genre inference from artist name (simplified)
   * In production, you'd use actual Spotify artist data
   */
  private inferGenresFromArtistName(artistName: string): string[] {
    const name = artistName.toLowerCase();
    
    // Very basic heuristics - in production, use actual Spotify artist genres
    if (name.includes('dj') || name.includes('electronic')) return ['electronic', 'dance'];
    if (name.includes('rock') || name.includes('metal')) return ['rock'];
    if (name.includes('rap') || name.includes('hip')) return ['hip hop', 'rap'];
    if (name.includes('jazz')) return ['jazz'];
    if (name.includes('classical')) return ['classical'];
    
    return ['pop']; // Default fallback
  }

  private getMostFrequent<T>(arr: T[]): T | null {
    if (arr.length === 0) return null;
    const freq = this.getFrequencyMap(arr);
    return Object.entries(freq).reduce((a, b) => (freq[a[0]] ?? 0) > (freq[b[0]] ?? 0) ? a : b)[0] as T;
  }

  private getFrequencyMap<T>(arr: T[]): Record<string, number> {
    const freq: Record<string, number> = {};
    for (const item of arr) {
      const key = String(item);
      freq[key] = (freq[key] ?? 0) + 1;
    }
    return freq;
  }
}

// Create service instance
export const songIngestionService = new SongIngestionService(
  process.env.SPOTIFY_CLIENT_ID!,
  process.env.SPOTIFY_CLIENT_SECRET!
);