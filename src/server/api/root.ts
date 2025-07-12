import { recommendationsRouter } from "@/server/api/routers/recommendations";
import { playlistsRouter } from "@/server/api/routers/playlists";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  recommendations: recommendationsRouter,
  playlists: playlistsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.recommendations.getByPlaylist();
 */
export const createCaller = createCallerFactory(appRouter);
