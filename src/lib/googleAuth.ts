import { OAuth2Client } from "google-auth-library";
import { env } from "../env";
import { ValidationError, UnauthorizedError } from "./errors";

const client = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  if (!client) throw new ValidationError("Google sign-in is not configured on this server");

  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
  } catch {
    throw new UnauthorizedError("Invalid Google token");
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new UnauthorizedError("Invalid Google token");

  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified ?? false,
    name: payload.name ?? payload.email.split("@")[0],
  };
}
