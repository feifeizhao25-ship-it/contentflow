import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { policyFromDefaultRegistry } from '../ai/growth-rag/policy';
import { StoredFunnelEvent, FunnelStore } from './events/funnel.service';
import { renderSkillDraft } from './skills/render';
import { TRAFFIC_SKILLS } from './skills/catalog';

interface EventDelegate {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
}

@Injectable()
export class GrowthTrafficService {
  private readonly funnel = new FunnelStore();

  constructor(private readonly prisma: PrismaService) {}

  listSkills() {
    return TRAFFIC_SKILLS.map((skill) => ({
      id: skill.id,
      version: skill.version,
      audience: skill.audience,
      title: skill.title,
      summary: skill.summary,
    }));
  }

  draft(skillId: string, input: Record<string, unknown>) {
    return renderSkillDraft(skillId, input);
  }

  ragStatus(env: NodeJS.ProcessEnv = process.env) {
    return policyFromDefaultRegistry(env);
  }

  recordPublicVisit(body: Record<string, unknown>) {
    if (body.event && body.event !== 'site_view') throw new Error('公开接口只记录访问');
    return this.remember({ event: 'site_view', visitor_id: String(body.visitorId ?? body.visitor_id ?? ''), body });
  }

  async recordForUser(user: { id?: string; tenantId?: string }, body: Record<string, unknown>) {
    const event = String(body.event ?? '');
    const stored = this.remember({
      event,
      visitor_id: String(body.visitorId ?? body.visitor_id ?? ''),
      tenant_id: user.tenantId,
      user_id: user.id,
      body,
    });
    const persisted = await this.persist(stored);
    return { ...stored, persisted };
  }

  funnelForTenant(tenantId: string) {
    return this.funnel.summary({ tenant_id: tenantId });
  }

  private remember(input: { event: string; visitor_id: string; tenant_id?: string; user_id?: string; body: Record<string, unknown> }): StoredFunnelEvent {
    return this.funnel.record(input);
  }

  private async persist(row: StoredFunnelEvent): Promise<boolean> {
    const delegate = (this.prisma as unknown as { growthEvent?: EventDelegate }).growthEvent;
    if (!delegate) return false;
    await delegate.create({
      data: {
        tenant_id: row.tenant_id ?? null,
        user_id: row.user_id ?? null,
        visitor_id: row.visitor_id,
        event: row.event,
        utm_source: row.utm_source ?? null,
        utm_medium: row.utm_medium ?? null,
        utm_campaign: row.utm_campaign ?? null,
        utm_content: row.utm_content ?? null,
        utm_term: row.utm_term ?? null,
        page_type: row.page_type ?? null,
      },
    });
    return true;
  }
}
