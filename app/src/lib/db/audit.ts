import { sql } from "./client";
import type { NextRequest } from "next/server";

export type AuditResult = "ok" | "forbidden" | "error";

interface AuditEntry {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  result: AuditResult;
  request?: NextRequest | Request;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const ip =
      entry.request?.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      entry.request?.headers.get("x-real-ip") ??
      null;
    const userAgent =
      entry.request?.headers.get("user-agent")?.substring(0, 500) ?? null;

    await sql`
      insert into audit_log
        (actor_user_id, action, target_type, target_id, result, ip, user_agent, metadata)
      values (
        ${entry.actorUserId},
        ${entry.action},
        ${entry.targetType},
        ${entry.targetId ?? null},
        ${entry.result},
        ${ip},
        ${userAgent},
        ${entry.metadata ? sql.json(entry.metadata as never) : null}
      )
    `;
  } catch (err) {
    // Audit failure must NOT take down the request. Log and move on.
    console.error("audit_log insert failed:", err instanceof Error ? err.message : err);
  }
}
