import { createTRPCRouter } from "@/server/api/trpc";
import { getRecommendations } from "./spotify-procedures/get-recommendations";
import { getUserPlaylists } from "./spotify-procedures/get-user-playlists";
import { addTrackToPlaylist } from "./spotify-procedures/add-track-to-playlist";

export const spotifyRouter = createTRPCRouter({
  getRecommendations,
  getUserPlaylists,
  addTrackToPlaylist,
});