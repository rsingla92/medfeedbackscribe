export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { sql } from "@/lib/db/client";
import { getProfile } from "@/lib/db/queries";
import { HomeClient } from "./home-client";
import { LandingContent } from "./_landing/content";

type SessionStatus =
  | "created"
  | "uploading"
  | "processing"
  | "ready"
  | "exported"
  | "processing_failed";

interface SessionRow {
  id: string;
  status: SessionStatus;
  created_at: string;
  date: string;
  preceptor_name: string | null;
  rotation_name: string | null;
}

export default async function HomePage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    return <LandingContent />;
  }

  const profile = await getProfile(user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  const rows = await sql<SessionRow[]>`
    select
      rs.id, rs.status, rs.created_at, rs.date,
      p.name as preceptor_name, r.name as rotation_name
    from recording_sessions rs
    left join preceptors p on p.id = rs.preceptor_id
    left join rotations r on r.id = rs.rotation_id
    where rs.user_id = ${user.id}
    order by rs.created_at desc
    limit 20
  `;

  const sessions = rows.map((r) => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    date: r.date,
    preceptor: r.preceptor_name ? { name: r.preceptor_name } : null,
    rotation: r.rotation_name ? { name: r.rotation_name } : null,
  }));

  return (
    <HomeClient
      initialSessions={sessions}
      userEmail={user.email ?? ""}
      userName={profile.full_name}
    />
  );
}
