import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  agentName: string;   // nickname (used as sheet tab suffix)
  fullName: string;
  agentCode: string;   // tele-[nickname]
  team: string;
  isLoggedIn: boolean;
}

export const sessionOptions = {
  password: process.env.SESSION_SECRET ?? "fallback-secret-please-set-env-32chars",
  cookieName: "mydesk-session",
  cookieOptions: { secure: process.env.NODE_ENV === "production" },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
