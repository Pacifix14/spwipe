import { z } from "zod";
import { protectedProcedure } from "@/server/api/trpc";

const PlaylistSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  images: z.array(z.object({
    url: z.string(),
    height: z.number().nullable(),
    width: z.number().nullable(),
  })).nullable(),
  tracks: z.object({
    total: z.number(),
  }),
  owner: z.object({
    id: z.string(),
    display_name: z.string().nullable(),
  }),
  public: z.boolean().nullable(),
  collaborative: z.boolean(),
  external_urls: z.object({
    spotify: z.string(),
  }).optional(),
});

const GetUserPlaylistsInputSchema = z.object({
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
});

const GetUserPlaylistsOutputSchema = z.object({
  playlists: z.array(PlaylistSchema),
  total: z.number(),
});

export const getUserPlaylists = protectedProcedure
  .input(GetUserPlaylistsInputSchema)
  .output(GetUserPlaylistsOutputSchema)
  .query(async ({ ctx, input }) => {
    const session = ctx.session;
    
    // Get Spotify access token from JWT session
    const accessToken = session.accessToken;
    
    if (!accessToken) {
      throw new Error("No Spotify access token found in session");
    }

    const params = new URLSearchParams({
      limit: input.limit.toString(),
      offset: input.offset.toString(),
    });

    const response = await fetch(
      `https://api.spotify.com/v1/me/playlists?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Spotify API error: ${error.error?.message || "Unknown error"}`);
    }

    const data = await response.json();
    
    console.log("Spotify playlists response:", JSON.stringify(data, null, 2));
    
    // Filter to only include playlists the user can modify
    const modifiablePlaylists = data.items.filter((playlist: any) => {
      return playlist.owner.id === session.providerAccountId || playlist.collaborative;
    });

    console.log("Filtered playlists:", JSON.stringify(modifiablePlaylists, null, 2));

    return {
      playlists: modifiablePlaylists,
      total: data.total,
    };
  });