// backend/src/lib/auth/auditLog.ts
// STATUS: CREATE — structured security audit trail

export type AuditEventType =
  | "LOGIN_SUCCESS" | "LOGIN_FAILED" | "LOGIN_BLOCKED"
  | "LOGOUT" | "LOGOUT_ALL_DEVICES"
  | "TOKEN_REFRESHED" | "TOKEN_REVOKED" | "TOKEN_EXPIRED"
  | "TOKEN_VERSION_MISMATCH" | "TOKEN_REPLAY_DETECTED"
  | "EXCHANGE_SUCCESS" | "EXCHANGE_FAILED"
  | "SSE_CONNECTED" | "SSE_DISCONNECTED"
  | "ACCOUNT_LOCKED" | "PERMISSION_DENIED" | "EMAIL_NOT_VERIFIED";

interface AuditEvent {
  event: AuditEventType; userId?: string; email?: string;
  ip?: string; userAgent?: string; sessionId?: string;
  jti?: string; reason?: string; meta?: Record<string, unknown>;
  timestamp: string; severity: "info" | "warn" | "critical";
}

const SEVERITY: Record<AuditEventType, AuditEvent["severity"]> = {
  LOGIN_SUCCESS: "info", LOGIN_FAILED: "warn", LOGIN_BLOCKED: "warn",
  LOGOUT: "info", LOGOUT_ALL_DEVICES: "info",
  TOKEN_REFRESHED: "info", TOKEN_REVOKED: "info", TOKEN_EXPIRED: "info",
  TOKEN_VERSION_MISMATCH: "warn", TOKEN_REPLAY_DETECTED: "critical",
  EXCHANGE_SUCCESS: "info", EXCHANGE_FAILED: "warn",
  SSE_CONNECTED: "info", SSE_DISCONNECTED: "info",
  ACCOUNT_LOCKED: "critical", PERMISSION_DENIED: "warn", EMAIL_NOT_VERIFIED: "warn",
};

export function auditLog(event: AuditEventType, data: Omit<AuditEvent, "event" | "timestamp" | "severity">): void {
  const entry: AuditEvent = { event, severity: SEVERITY[event], timestamp: new Date().toISOString(), ...data };
  const output = JSON.stringify(entry);
  if (entry.severity === "critical") console.error(`[AUDIT:CRITICAL] ${output}`);
  else if (entry.severity === "warn")  console.warn(`[AUDIT:WARN] ${output}`);
  else                                 console.log(`[AUDIT:INFO] ${output}`);
  // Production: await prisma.auditLog.create({ data: entry });
}
