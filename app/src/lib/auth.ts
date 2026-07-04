import NextAuth, { type NextAuthConfig, type Session } from "next-auth";
import Google from "next-auth/providers/google";
import PostgresAdapter from "@auth/pg-adapter";
import { pool } from "@/lib/db/pool";
import { sql } from "@/lib/db/client";
import { sendMagicLinkEmail } from "@/lib/auth/send-magic-link";

const DEV_BYPASS_USER_ID = "00000000-0000-0000-0000-000000000001";

// Fail-closed: in production, AUTH_URL must be pinned so Auth.js can reject
// host-header spoofing (attacker sends Host: evil.com, magic-link email then
// points at evil.com and exfiltrates the token on click).
if (process.env.NODE_ENV === "production" && !process.env.AUTH_URL) {
  throw new Error(
    "AUTH_URL must be set in production to prevent host-header spoofing on magic-link emails",
  );
}

const config: NextAuthConfig = {
  adapter: PostgresAdapter(pool),
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: "/auth",
    verifyRequest: "/auth/check-email",
    error: "/auth/error",
  },
  // Permissive in dev (preview URLs, tunnels, etc.), strict in prod where
  // Auth.js will then match requests against AUTH_URL's host.
  trustHost: process.env.NODE_ENV !== "production",
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Explicit: Auth.js v5 default is false, but pinning it here prevents a
      // future copy-paste from silently enabling same-email cross-provider
      // account linking (account takeover vector).
      allowDangerousEmailAccountLinking: false,
    }),
    {
      id: "email",
      name: "Email",
      type: "email",
      maxAge: 24 * 60 * 60,
      from: process.env.SES_FROM_EMAIL ?? "noreply@med-student-feedback-scribe.dev",
      server: {},
      sendVerificationRequest: sendMagicLinkEmail,
      options: {},
    },
  ],
  callbacks: {
    session({ session, user }) {
      if (session.user && user?.id) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      await sql`
        insert into profiles (id, full_name, email)
        values (${user.id}, ${user.name ?? user.email ?? "Resident"}, ${user.email ?? null})
        on conflict (id) do update set
          email = excluded.email,
          updated_at = now()
      `;
    },
  },
};

const nextAuth = NextAuth(config);

// Double-gate: explicit positive match on NODE_ENV === "development" so an
// unset NODE_ENV fails closed (the previous `!== "production"` check treated
// undefined as dev).
const devBypassEnabled =
  process.env.DEV_BYPASS_AUTH === "true" &&
  process.env.NODE_ENV === "development";

async function bypassAuth(): Promise<Session> {
  return {
    user: {
      id: DEV_BYPASS_USER_ID,
      email: "dev@example.com",
      name: "Dev User",
    },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  } as Session;
}

export const { handlers, signIn, signOut } = nextAuth;
export const auth = devBypassEnabled
  ? (bypassAuth as typeof nextAuth.auth)
  : nextAuth.auth;
export { DEV_BYPASS_USER_ID };
