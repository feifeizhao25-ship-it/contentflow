/** 仅供测试：内存实现的验证码存储，保持与数据库实现一致的原子语义。 */
import { SmsCodeRecord, SmsCodeStore } from './sms-code.service';

export class MemoryStore implements SmsCodeStore {
  rows: Array<SmsCodeRecord & { id: string }> = [];
  private seq = 0;
  async countSince(f: { phoneHash?: string; ipHash?: string; since: Date }) {
    return this.rows.filter((r) => r.created_at >= f.since && (!f.phoneHash || r.phone_hash === f.phoneHash) && (!f.ipHash || r.request_ip_hash === f.ipHash)).length;
  }
  async latestCreatedAt(phoneHash: string, purpose: string) {
    const rows = this.rows.filter((r) => r.phone_hash === phoneHash && r.purpose === purpose).sort((a, b) => +b.created_at - +a.created_at);
    return rows[0]?.created_at ?? null;
  }
  async invalidateOpen(phoneHash: string, purpose: string, now: Date) {
    for (const r of this.rows) if (r.phone_hash === phoneHash && r.purpose === purpose && !r.consumed_at) r.consumed_at = now;
  }
  async create(rec: SmsCodeRecord) { const row = { ...rec, id: `r${++this.seq}` }; this.rows.push(row); return { id: row.id }; }
  async delete(id: string) { this.rows = this.rows.filter((r) => r.id !== id); }
  async findOpen(phoneHash: string, purpose: string, now: Date) {
    return this.rows.filter((r) => r.phone_hash === phoneHash && r.purpose === purpose && !r.consumed_at && r.expires_at > now).sort((a, b) => +b.created_at - +a.created_at)[0] ?? null;
  }
  async bumpAttempts(id: string, max: number) {
    const r = this.rows.find((x) => x.id === id);
    if (!r || r.consumed_at || r.attempts >= max) return false;
    r.attempts += 1; return true;
  }
  async consume(id: string, now: Date) {
    const r = this.rows.find((x) => x.id === id);
    if (!r || r.consumed_at) return false;
    r.consumed_at = now; return true;
  }
  async deleteByPhoneHash(h: string) { const n = this.rows.length; this.rows = this.rows.filter((r) => r.phone_hash !== h); return n - this.rows.length; }
  async purgeExpired(before: Date) { this.rows = this.rows.filter((r) => r.expires_at > before); }
}
