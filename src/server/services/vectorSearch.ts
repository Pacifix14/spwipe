/**
 * Vector Similarity Search Engine
 * Performs efficient similarity searches using PostgreSQL + pgvector
 */

import { db } from "@/server/db";
import { embeddingService } from "./embedding";

export interface SimilaritySearchOptions {
  limit?: number;
  threshold?: number; // Minimum similarity score (0-1)
  excludeIds?: string[]; // Song IDs to exclude from results
  genreFilter?: string[]; // Only include songs with these genres
  popularityMin?: number; // Minimum popularity (0-100)
  popularityMax?: number; // Maximum popularity (0-100)
  yearMin?: number; // Minimum release year
  yearMax?: number; // Maximum release year
}

export interface SimilarSong {
  id: string;
  spotifyId: string;
  name: string;
  artist: string;
  album: string;
  imageUrl: string | null;
  previewUrl: string | null;
  externalUrls: unknown;
  popularity: number;
  genres: string[];
  similarity: number; // Cosine similarity score (0-1)
  durationMs: number;
  releaseDate: Date | null;
}

export class VectorSearchService {
  
  /**
   * Find similar songs using combined vector similarity
   */
  async findSimilarSongs(
    queryVector: number[],
    options: SimilaritySearchOptions = {}
  ): Promise<SimilarSong[]> {
    const {
      limit = 50,
      threshold = 0.0,
      excludeIds = [],
      genreFilter,
      popularityMin,
      popularityMax,
      yearMin,
      yearMax,
    } = options;

    // For now, use basic filtering since vector search is complex to set up
    // This is a fallback until we get pgvector properly configured
    
    let whereClause: any = {
      combinedVector: { not: null },
    };

    if (excludeIds.length > 0) {
      whereClause.spotifyId = { notIn: excludeIds };
    }

    if (genreFilter && genreFilter.length > 0) {
      whereClause.genres = { hasSome: genreFilter };
    }

    if (popularityMin !== undefined) {
      whereClause.popularity = { ...whereClause.popularity, gte: popularityMin };
    }

    if (popularityMax !== undefined) {
      whereClause.popularity = { ...whereClause.popularity, lte: popularityMax };
    }

    if (yearMin !== undefined || yearMax !== undefined) {
      whereClause.releaseDate = {};
      if (yearMin) {
        whereClause.releaseDate.gte = new Date(`${yearMin}-01-01`);
      }
      if (yearMax) {
        whereClause.releaseDate.lte = new Date(`${yearMax}-12-31`);
      }
    }

    const songs = await db.song.findMany({
      where: whereClause,
      take: Math.min(limit * 2, 200), // Get more candidates for similarity calculation
    });

    // Calculate similarity using embeddings service
    const songsWithSimilarity = songs
      .map(song => {
        const songVector = Array.isArray(song.combinedVector) 
          ? song.combinedVector as number[]
          : JSON.parse(song.combinedVector as string) as number[];
        
        const similarity = embeddingService.calculateCosineSimilarity(queryVector, songVector);
        
        return {
          id: song.id,
          spotifyId: song.spotifyId,
          name: song.name,
          artist: song.artist,
          album: song.album,
          imageUrl: song.imageUrl,
          previewUrl: song.previewUrl,
          externalUrls: song.externalUrls,
          popularity: song.popularity,
          genres: song.genres,
          similarity,
          durationMs: song.durationMs,
          releaseDate: song.releaseDate,
        };
      })
      .filter(song => song.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return songsWithSimilarity;
  }

  /**
   * Find songs similar to a playlist using playlist vector
   */
  async findSongsForPlaylist(
    playlistId: string,
    options: SimilaritySearchOptions = {}
  ): Promise<SimilarSong[]> {
    // Get playlist analysis
    const playlist = await db.playlistAnalysis.findUnique({
      where: { spotifyPlaylistId: playlistId },
    });

    if (!playlist?.playlistVector) {
      throw new Error('Playlist analysis not found or vector not computed');
    }

    // Convert JSON to number array
    const vector = Array.isArray(playlist.playlistVector) 
      ? playlist.playlistVector as number[]
      : JSON.parse(playlist.playlistVector as string) as number[];

    return this.findSimilarSongs(vector, options);
  }

  /**
   * Find songs similar to a specific song
   */
  async findSongsLikeSong(
    songId: string,
    options: SimilaritySearchOptions = {}
  ): Promise<SimilarSong[]> {
    const song = await db.song.findUnique({
      where: { spotifyId: songId },
      select: { combinedVector: true },
    });

    if (!song?.combinedVector) {
      throw new Error('Song not found or vector not computed');
    }

    // Convert JSON to number array
    const vector = Array.isArray(song.combinedVector) 
      ? song.combinedVector as number[]
      : JSON.parse(song.combinedVector as string) as number[];

    // Exclude the source song itself
    const excludeIds = [songId, ...(options.excludeIds ?? [])];

    return this.findSimilarSongs(vector, { ...options, excludeIds });
  }

  /**
   * Hybrid search: Combine vector similarity with popularity and genre matching
   */
  async hybridSearch(
    queryVector: number[],
    options: SimilaritySearchOptions & {
      popularityWeight?: number; // 0-1, how much to weight popularity
      genreBoost?: number; // Boost score for genre matches
    } = {}
  ): Promise<SimilarSong[]> {
    const {
      popularityWeight = 0.2,
      genreBoost = 0.1,
      ...searchOptions
    } = options;

    const results = await this.findSimilarSongs(queryVector, searchOptions);

    // Apply hybrid scoring
    return results.map(song => {
      let hybridScore = song.similarity * (1 - popularityWeight);
      
      // Add popularity component
      hybridScore += (song.popularity / 100) * popularityWeight;
      
      // Boost for genre matches if genreFilter is provided
      if (searchOptions.genreFilter && genreBoost > 0) {
        const genreMatches = song.genres.filter(genre => 
          searchOptions.genreFilter!.some(filterGenre => 
            genre.toLowerCase().includes(filterGenre.toLowerCase())
          )
        ).length;
        
        if (genreMatches > 0) {
          hybridScore += genreBoost * (genreMatches / Math.max(song.genres.length, 1));
        }
      }

      return {
        ...song,
        similarity: Math.max(0, Math.min(1, hybridScore)),
      };
    }).sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Get diverse recommendations by ensuring variety in results
   */
  async getDiverseRecommendations(
    queryVector: number[],
    options: SimilaritySearchOptions & {
      diversityWeight?: number; // 0-1, how much to prioritize diversity
    } = {}
  ): Promise<SimilarSong[]> {
    const {
      diversityWeight = 0.3,
      limit = 50,
      ...searchOptions
    } = options;

    // Get more candidates than needed
    const candidates = await this.findSimilarSongs(queryVector, {
      ...searchOptions,
      limit: Math.min(limit * 3, 200), // Get 3x more candidates
    });

    if (candidates.length <= limit) {
      return candidates;
    }

    // Select diverse subset using simple clustering
    const selected: SimilarSong[] = [];
    const remaining = [...candidates];

    // Always include the top result
    if (remaining.length > 0) {
      selected.push(remaining[0]!);
      remaining.splice(0, 1);
    }

    // Select remaining songs to maximize diversity
    while (selected.length < limit && remaining.length > 0) {
      let bestIndex = 0;
      let bestScore = -1;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i]!;
        
        // Calculate diversity score (minimum similarity to already selected)
        let minSimilarity = 1;
        for (const selectedSong of selected) {
          // Use simple artist/genre diversity as proxy
          const artistMatch = candidate.artist === selectedSong.artist ? 1 : 0;
          const genreOverlap = candidate.genres.filter(g => 
            selectedSong.genres.includes(g)
          ).length / Math.max(candidate.genres.length, 1);
          
          const similarity = (artistMatch + genreOverlap) / 2;
          minSimilarity = Math.min(minSimilarity, similarity);
        }

        // Combine original similarity with diversity
        const diversityScore = 1 - minSimilarity;
        const combinedScore = candidate.similarity * (1 - diversityWeight) + 
                            diversityScore * diversityWeight;

        if (combinedScore > bestScore) {
          bestScore = combinedScore;
          bestIndex = i;
        }
      }

      selected.push(remaining[bestIndex]!);
      remaining.splice(bestIndex, 1);
    }

    return selected;
  }

  /**
   * Cache similarity results for faster subsequent searches
   */
  async cacheSimilarityScores(
    sourcePlaylistId: string,
    results: SimilarSong[]
  ): Promise<void> {
    // Simplified caching - just log for now
    console.log(`Would cache ${results.length} results for playlist ${sourcePlaylistId}`);
  }

  /**
   * Get cached similarity results if available
   */
  async getCachedSimilarities(
    sourcePlaylistId: string,
    limit = 50
  ): Promise<SimilarSong[] | null> {
    // No caching for now
    return null;
  }
}

export const vectorSearchService = new VectorSearchService();