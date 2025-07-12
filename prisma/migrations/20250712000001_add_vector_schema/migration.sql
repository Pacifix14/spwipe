-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "spotifyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "album" TEXT NOT NULL,
    "imageUrl" TEXT,
    "previewUrl" TEXT,
    "externalUrls" JSONB NOT NULL,
    "acousticness" DOUBLE PRECISION NOT NULL,
    "danceability" DOUBLE PRECISION NOT NULL,
    "energy" DOUBLE PRECISION NOT NULL,
    "instrumentalness" DOUBLE PRECISION NOT NULL,
    "liveness" DOUBLE PRECISION NOT NULL,
    "loudness" DOUBLE PRECISION NOT NULL,
    "speechiness" DOUBLE PRECISION NOT NULL,
    "tempo" DOUBLE PRECISION NOT NULL,
    "valence" DOUBLE PRECISION NOT NULL,
    "mode" INTEGER NOT NULL,
    "key" INTEGER NOT NULL,
    "timeSignature" INTEGER NOT NULL,
    "popularity" INTEGER NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "durationMs" INTEGER NOT NULL,
    "genres" TEXT[],
    "audioFeatureVector" vector(12),
    "genreVector" vector(50),
    "combinedVector" vector(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistAnalysis" (
    "id" TEXT NOT NULL,
    "spotifyPlaylistId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avgAcousticness" DOUBLE PRECISION NOT NULL,
    "avgDanceability" DOUBLE PRECISION NOT NULL,
    "avgEnergy" DOUBLE PRECISION NOT NULL,
    "avgInstrumentalness" DOUBLE PRECISION NOT NULL,
    "avgLiveness" DOUBLE PRECISION NOT NULL,
    "avgLoudness" DOUBLE PRECISION NOT NULL,
    "avgSpeechiness" DOUBLE PRECISION NOT NULL,
    "avgTempo" DOUBLE PRECISION NOT NULL,
    "avgValence" DOUBLE PRECISION NOT NULL,
    "avgPopularity" DOUBLE PRECISION NOT NULL,
    "dominantGenres" TEXT[],
    "dominantKey" INTEGER,
    "dominantMode" INTEGER,
    "dominantTimeSignature" INTEGER,
    "playlistVector" vector(128),
    "trackCount" INTEGER NOT NULL,
    "totalDurationMs" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaylistAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimilarityCache" (
    "id" TEXT NOT NULL,
    "sourcePlaylistId" TEXT NOT NULL,
    "targetSongId" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimilarityCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Song_spotifyId_key" ON "Song"("spotifyId");

-- CreateIndex
CREATE INDEX "Song_spotifyId_idx" ON "Song"("spotifyId");

-- CreateIndex
CREATE INDEX "Song_artist_idx" ON "Song"("artist");

-- CreateIndex
CREATE INDEX "Song_genres_idx" ON "Song"("genres");

-- CreateIndex
CREATE INDEX "Song_popularity_idx" ON "Song"("popularity");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistAnalysis_spotifyPlaylistId_key" ON "PlaylistAnalysis"("spotifyPlaylistId");

-- CreateIndex
CREATE INDEX "PlaylistAnalysis_spotifyPlaylistId_idx" ON "PlaylistAnalysis"("spotifyPlaylistId");

-- CreateIndex
CREATE INDEX "PlaylistAnalysis_dominantGenres_idx" ON "PlaylistAnalysis"("dominantGenres");

-- CreateIndex
CREATE UNIQUE INDEX "SimilarityCache_sourcePlaylistId_targetSongId_key" ON "SimilarityCache"("sourcePlaylistId", "targetSongId");

-- CreateIndex
CREATE INDEX "SimilarityCache_sourcePlaylistId_similarityScore_idx" ON "SimilarityCache"("sourcePlaylistId", "similarityScore");

-- Create vector similarity indexes for fast searches
CREATE INDEX IF NOT EXISTS song_combined_vector_idx ON "Song" USING ivfflat ("combinedVector" vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS song_audio_vector_idx ON "Song" USING ivfflat ("audioFeatureVector" vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS playlist_vector_idx ON "PlaylistAnalysis" USING ivfflat ("playlistVector" vector_cosine_ops) WITH (lists = 50);