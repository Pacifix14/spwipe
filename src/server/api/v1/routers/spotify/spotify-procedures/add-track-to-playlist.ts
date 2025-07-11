import { z } from "zod";
import { protectedProcedure } from "@/server/api/trpc";

const AddTrackToPlaylistInputSchema = z.object({
  playlistId: z.string(),
  trackId: z.string(),
  position: z.number().optional(),
});

const AddTrackToPlaylistOutputSchema = z.object({
  snapshot_id: z.string(),
  success: z.boolean(),
});

export const addTrackToPlaylist = protectedProcedure
  .input(AddTrackToPlaylistInputSchema)
  .output(AddTrackToPlaylistOutputSchema)
  .mutation(async ({ ctx, input }) => {
    const session = ctx.session;
    
    // Get Spotify access token from JWT session
    const accessToken = session.accessToken;
    
    if (!accessToken) {
      throw new Error("No Spotify access token found in session");
    }

    const body: any = {
      uris: [`spotify:track:${input.trackId}`],
    };

    if (input.position !== undefined) {
      body.position = input.position;
    }

    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${input.playlistId}/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Spotify API error: ${error.error?.message || "Unknown error"}`);
    }

    const data = await response.json();
    
    return {
      snapshot_id: data.snapshot_id,
      success: true,
    };
  });