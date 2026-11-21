import type { Request } from "express";
import { getRequestIpAddress, writeAuditLog } from "./audit-log";
import { formatAuditMetadata } from "./audit-metadata";
import {
  SECURITY_AUDIT_THROTTLE_MS,
  isSensitiveAdminPath,
  sanitizeAuditPath,
  shouldWriteThrottledAudit,
} from "./security-red-flag";

/** บันทึก security.rate-limit แบบ throttle ต่อ IP+scope */
export async function writeRateLimitSecurityAudit(input: {
  req: Request;
  scope: string;
}): Promise<void> {
  const ip = getRequestIpAddress(input.req) || "unknown";
  const throttleKey = `rate:${input.scope}:${ip}`;
  if (!shouldWriteThrottledAudit(throttleKey, SECURITY_AUDIT_THROTTLE_MS)) {
    return;
  }

  try {
    await writeAuditLog({
      actorUserId: input.req.user?.userId ?? null,
      action: "security.rate-limit",
      entityType: "Security",
      description: formatAuditMetadata({
        scope: input.scope,
        path: sanitizeAuditPath(input.req.originalUrl || input.req.path || "/"),
        method: input.req.method,
      }),
      ipAddress: ip === "unknown" ? null : ip,
    });
  } catch (error) {
    console.error("[security-audit] rate-limit write failed", error);
  }
}

/** บันทึก privilege-probe เมื่อบัญชีที่มีสิทธิ์ต่ำยิงโซนแอดมิน/ผู้บริหาร */
export async function writePrivilegeProbeSecurityAudit(input: {
  req: Request;
}): Promise<void> {
  const path = sanitizeAuditPath(input.req.originalUrl || input.req.path || "/");
  if (!isSensitiveAdminPath(path)) {
    return;
  }

  const userId = input.req.user?.userId || "anon";
  const throttleKey = `priv:${userId}:${path}`;
  if (!shouldWriteThrottledAudit(throttleKey, SECURITY_AUDIT_THROTTLE_MS)) {
    return;
  }

  try {
    await writeAuditLog({
      actorUserId: input.req.user?.userId ?? null,
      action: "security.privilege-probe",
      entityType: "Security",
      entityId: input.req.user?.userId ?? null,
      description: formatAuditMetadata({
        path,
        method: input.req.method,
        role: input.req.user?.role,
      }),
      ipAddress: getRequestIpAddress(input.req),
    });
  } catch (error) {
    console.error("[security-audit] privilege-probe write failed", error);
  }
}
