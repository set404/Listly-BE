import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "../env";
import { prisma } from "../db";

// Optional — no-ops until FIREBASE_* env vars are set (a Firebase project
// has to exist first; see android/README or the setup notes in the repo).
let app: App | null = null;

function getFirebaseApp(): App | null {
  if (app) return app;
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) return null;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }
  app = initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      // Render (and most env-var UIs) store the key with literal "\n" —
      // turn those back into real newlines for the PEM to parse.
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
  return app;
}

export async function sendPushToUsers(
  userIds: string[],
  notification: { title: string; body: string; data?: Record<string, string> },
): Promise<void> {
  if (userIds.length === 0) return;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return;

  const tokens = await prisma.pushToken.findMany({ where: { userId: { in: userIds } } });
  if (tokens.length === 0) return;

  const messaging = getMessaging(firebaseApp);
  const result = await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title: notification.title, body: notification.body },
    data: notification.data,
  });

  // Prune tokens the device/OS has since invalidated (uninstalled app,
  // expired registration, etc.) so future sends don't keep retrying them.
  const deadTokens = result.responses
    .map((r, i) => (!r.success && isUnregisteredError(r.error?.code) ? tokens[i].token : null))
    .filter((t): t is string => t !== null);
  if (deadTokens.length > 0) {
    await prisma.pushToken.deleteMany({ where: { token: { in: deadTokens } } });
  }
}

function isUnregisteredError(code: string | undefined): boolean {
  return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token";
}
