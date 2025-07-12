/**
 * Song Embedding Service
 * Converts song metadata and audio features into high-dimensional vectors
 * for similarity search and recommendation
 */

interface SpotifyAudioFeatures {
  acousticness: number;
  danceability: number;
  energy: number;
  instrumentalness: number;
  liveness: number;
  loudness: number;
  speechiness: number;
  tempo: number;
  valence: number;
  mode: number; // 0 = minor, 1 = major
  key: number; // 0-11
  time_signature: number;
}

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

interface SongMetadata {
  track: SpotifyTrack;
  audioFeatures: SpotifyAudioFeatures;
  genres: string[];
}

// Genre embeddings mapping common genres to vectors
const GENRE_EMBEDDINGS: Record<string, number[]> = {
  // Pop and mainstream
  'pop': [1.0, 0.8, 0.6, 0.5, 0.7, 0.0, 0.0, 0.0, 0.0, 0.0],
  'dance pop': [1.0, 0.9, 0.8, 0.6, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0],
  'electropop': [0.9, 0.8, 0.7, 0.8, 0.9, 0.0, 0.0, 0.0, 0.0, 0.0],
  
  // Rock
  'rock': [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.8, 0.6, 0.5, 0.7],
  'alternative rock': [0.0, 0.0, 0.0, 0.0, 0.0, 0.9, 0.8, 0.7, 0.6, 0.6],
  'indie rock': [0.0, 0.0, 0.0, 0.0, 0.0, 0.8, 0.9, 0.8, 0.7, 0.5],
  'hard rock': [0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.7, 0.5, 0.9, 0.8],
  
  // Electronic
  'electronic': [0.2, 0.9, 0.8, 1.0, 0.7, 0.0, 0.0, 0.0, 0.0, 0.0],
  'house': [0.3, 1.0, 0.9, 0.9, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0],
  'techno': [0.1, 0.9, 0.8, 1.0, 0.6, 0.0, 0.0, 0.0, 0.0, 0.0],
  'edm': [0.4, 1.0, 1.0, 0.8, 0.9, 0.0, 0.0, 0.0, 0.0, 0.0],
  
  // Hip-hop
  'hip hop': [0.3, 0.8, 0.7, 0.2, 0.6, 0.0, 0.0, 0.0, 0.0, 0.0],
  'rap': [0.2, 0.7, 0.6, 0.1, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0],
  'trap': [0.4, 0.9, 0.8, 0.3, 0.7, 0.0, 0.0, 0.0, 0.0, 0.0],
  
  // R&B and Soul
  'r&b': [0.6, 0.7, 0.6, 0.3, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0],
  'soul': [0.7, 0.6, 0.7, 0.2, 0.9, 0.0, 0.0, 0.0, 0.0, 0.0],
  'funk': [0.8, 0.9, 0.8, 0.4, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0],
  
  // Default for unknown genres
  'unknown': [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
};

export class EmbeddingService {
  
  /**
   * Create normalized audio feature vector (12 dimensions)
   */
  createAudioFeatureVector(audioFeatures: SpotifyAudioFeatures): number[] {
    return [
      audioFeatures.acousticness,
      audioFeatures.danceability,
      audioFeatures.energy,
      audioFeatures.instrumentalness,
      audioFeatures.liveness,
      this.normalizeLoudness(audioFeatures.loudness), // Normalize -60 to 0 dB
      audioFeatures.speechiness,
      this.normalizeTempo(audioFeatures.tempo), // Normalize 50-200 BPM
      audioFeatures.valence,
      audioFeatures.mode, // 0 or 1
      audioFeatures.key / 11, // Normalize 0-11 to 0-1
      audioFeatures.time_signature / 7, // Normalize common time signatures
    ];
  }

  /**
   * Create genre embedding vector (50 dimensions)
   */
  createGenreVector(genres: string[]): number[] {
    if (genres.length === 0) {
      return new Array(50).fill(0);
    }

    // Start with zeros
    const vector = new Array(50).fill(0);
    
    // For each genre, add its embedding
    for (const genre of genres) {
      const genreKey = genre.toLowerCase();
      const genreEmbedding = GENRE_EMBEDDINGS[genreKey] ?? GENRE_EMBEDDINGS['unknown']!;
      
      // Add genre embedding to appropriate positions in vector
      for (let i = 0; i < Math.min(genreEmbedding.length, 50); i++) {
        vector[i] += (genreEmbedding[i] ?? 0) / genres.length; // Average if multiple genres
      }
    }

    return this.normalizeVector(vector);
  }

  /**
   * Create combined feature vector (128 dimensions)
   * Combines audio features, genre, and metadata into single vector
   */
  createCombinedVector(songMetadata: SongMetadata): number[] {
    const audioVector = this.createAudioFeatureVector(songMetadata.audioFeatures);
    const genreVector = this.createGenreVector(songMetadata.genres);
    
    // Additional metadata features
    const metadataFeatures = [
      songMetadata.track.popularity / 100, // Normalize 0-100 to 0-1
      this.normalizeYear(songMetadata.track.album.release_date),
      this.normalizeDuration(songMetadata.track.duration_ms),
      songMetadata.track.preview_url ? 1.0 : 0.0, // Has preview
    ];

    // Combine all vectors
    const combined = [
      ...audioVector, // 12 dimensions
      ...genreVector.slice(0, 20), // 20 dimensions (truncated genre vector)
      ...metadataFeatures, // 4 dimensions
    ];

    // Pad to 128 dimensions with derived features
    while (combined.length < 128) {
      // Add some derived features
      const audioEnergy = audioVector[2] ?? 0; // energy
      const danceability = audioVector[1] ?? 0; // danceability
      const valence = audioVector[8] ?? 0; // valence
      
      combined.push(
        audioEnergy * danceability, // Energy-dance interaction
        valence * audioEnergy, // Mood-energy interaction
        (audioVector[0] ?? 0) * (audioVector[3] ?? 0), // Acoustic-instrumental
        0 // Padding
      );
    }

    return this.normalizeVector(combined.slice(0, 128));
  }

  /**
   * Calculate similarity between two vectors using cosine similarity
   */
  calculateCosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += (vectorA[i] ?? 0) * (vectorB[i] ?? 0);
      normA += (vectorA[i] ?? 0) * (vectorA[i] ?? 0);
      normB += (vectorB[i] ?? 0) * (vectorB[i] ?? 0);
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Create playlist vector by averaging song vectors
   */
  createPlaylistVector(songVectors: number[][]): number[] {
    if (songVectors.length === 0) {
      return new Array(128).fill(0);
    }

    const dimensions = songVectors[0]?.length ?? 128;
    const avgVector = new Array(dimensions).fill(0);

    for (const vector of songVectors) {
      for (let i = 0; i < dimensions; i++) {
        avgVector[i] += (vector[i] ?? 0) / songVectors.length;
      }
    }

    return this.normalizeVector(avgVector);
  }

  // Utility functions for normalization
  private normalizeLoudness(loudness: number): number {
    // Spotify loudness is typically -60 to 0 dB
    return Math.max(0, Math.min(1, (loudness + 60) / 60));
  }

  private normalizeTempo(tempo: number): number {
    // Typical tempo range 50-200 BPM
    return Math.max(0, Math.min(1, (tempo - 50) / 150));
  }

  private normalizeYear(releaseDate: string): number {
    try {
      const year = new Date(releaseDate).getFullYear();
      const currentYear = new Date().getFullYear();
      // Normalize with more weight to recent years
      return Math.max(0, Math.min(1, (year - 1950) / (currentYear - 1950)));
    } catch {
      return 0.5; // Default for invalid dates
    }
  }

  private normalizeDuration(durationMs: number): number {
    // Typical song duration 1-10 minutes
    const durationMinutes = durationMs / 60000;
    return Math.max(0, Math.min(1, (durationMinutes - 1) / 9));
  }

  private normalizeVector(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vector;
    return vector.map(val => val / norm);
  }
}

export const embeddingService = new EmbeddingService();