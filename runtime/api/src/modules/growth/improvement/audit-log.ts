export interface AuditEntry {
  sequence: number;
  at: string;
  action: string;
  subject: string;
  detail: Record<string, unknown>;
}

/** 追加写。没有更新或删除。条目冻结，序号只增。 */
export class AppendOnlyAuditLog {
  private sequence = 0;
  private readonly rows: AuditEntry[] = [];

  append(input: { action: string; subject: string; detail?: Record<string, unknown>; at?: string }): AuditEntry {
    this.sequence += 1;
    const entry = Object.freeze({
      sequence: this.sequence,
      at: input.at ?? new Date().toISOString(),
      action: input.action,
      subject: input.subject,
      detail: Object.freeze({ ...(input.detail ?? {}) }),
    });
    this.rows.push(entry);
    return entry;
  }

  list(): readonly AuditEntry[] {
    return this.rows.slice();
  }
}
