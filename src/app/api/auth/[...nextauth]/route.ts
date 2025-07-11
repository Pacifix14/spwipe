import { handlers } from "@/server/auth";

// Force Node.js runtime for auth
export const runtime = 'nodejs';

export const { GET, POST } = handlers;
