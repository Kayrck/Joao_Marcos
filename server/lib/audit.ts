import type { Queryable } from "../db/index.js";

export interface AuditEntry {
  adminId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary?: string;
  before?: unknown;
  after?: unknown;
}

/** Registra uma trilha de auditoria. Deve receber o mesmo `Queryable` da transação da operação. */
export async function audit(q: Queryable, e: AuditEntry): Promise<void> {
  await q.query(
    `insert into audit_logs (admin_id, action, entity, entity_id, summary, before, after)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
    [
      e.adminId,
      e.action,
      e.entity,
      e.entityId ?? null,
      e.summary ?? null,
      e.before === undefined ? null : JSON.stringify(e.before),
      e.after === undefined ? null : JSON.stringify(e.after),
    ],
  );
}
