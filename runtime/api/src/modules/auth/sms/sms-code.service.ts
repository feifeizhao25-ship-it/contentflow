import { randomInt, timingSafeEqual } from 'node:crypto';
import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { maskPhone } from '../../../common/pii';
import { SMS_GATEWAY, SmsGateway, SmsPurpose } from './sms.types';
import { smsHmac, smsHmacSecret } from './sms-hash';

export interface SmsCodeRecord {
  phone_hash: string;
  purpose: string;
  code_hash: string;
  attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
  request_ip_hash: string | null;
  created_at: Date;
}

/** 验证码存储。每个写操作都是原子的（带条件的 updateMany），并发提交同一个验证码只会有一个成功。 */
export interface SmsCodeStore {
  countSince(filter: { phoneHash?: string; ipHash?: string; since: Date }): Promise<number>;
  latestCreatedAt(phoneHash: string, purpose: string): Promise<Date | null>;
  invalidateOpen(phoneHash: string, purpose: string, now: Date): Promise<void>;
  create(record: SmsCodeRecord): Promise<{ id: string }>;
  delete(id: string): Promise<void>;
  findOpen(phoneHash: string, purpose: string, now: Date): Promise<{ id: string; code_hash: string; attempts: number } | null>;
  bumpAttempts(id: string, max: number): Promise<boolean>;
  consume(id: string, now: Date): Promise<boolean>;
  deleteByPhoneHash(phoneHash: string): Promise<number>;
  purgeExpired(before: Date): Promise<void>;
}

/** Prisma 实现。这里集中做一次类型转换（模型随迁移新增）。 */
@Injectable()
export class PrismaSmsCodeStore implements SmsCodeStore {
  constructor(private readonly prisma: PrismaService) {}
  private get t(): any { return (this.prisma as any).smsVerificationCode; }

  countSince(f: { phoneHash?: string; ipHash?: string; since: Date }) {
    return this.t.count({ where: { created_at: { gte: f.since }, ...(f.phoneHash ? { phone_hash: f.phoneHash } : {}), ...(f.ipHash ? { request_ip_hash: f.ipHash } : {}) } });
  }
  async latestCreatedAt(phoneHash: string, purpose: string) {
    const row = await this.t.findFirst({ where: { phone_hash: phoneHash, purpose }, orderBy: { created_at: 'desc' }, select: { created_at: true } });
    return row?.created_at ?? null;
  }
  async invalidateOpen(phoneHash: string, purpose: string, now: Date) {
    await this.t.updateMany({ where: { phone_hash: phoneHash, purpose, consumed_at: null }, data: { consumed_at: now } });
  }
  async create(record: SmsCodeRecord) { const row = await this.t.create({ data: record }); return { id: row.id as string }; }
  async delete(id: string) { await this.t.deleteMany({ where: { id } }); }
  findOpen(phoneHash: string, purpose: string, now: Date) {
    return this.t.findFirst({ where: { phone_hash: phoneHash, purpose, consumed_at: null, expires_at: { gt: now } }, orderBy: { created_at: 'desc' }, select: { id: true, code_hash: true, attempts: true } });
  }
  async bumpAttempts(id: string, max: number) {
    const r = await this.t.updateMany({ where: { id, consumed_at: null, attempts: { lt: max } }, data: { attempts: { increment: 1 } } });
    return r.count === 1;
  }
  async consume(id: string, now: Date) {
    const r = await this.t.updateMany({ where: { id, consumed_at: null }, data: { consumed_at: now } });
    return r.count === 1;
  }
  async deleteByPhoneHash(phoneHash: string) { return (await this.t.deleteMany({ where: { phone_hash: phoneHash } })).count as number; }
  async purgeExpired(before: Date) { await this.t.deleteMany({ where: { expires_at: { lt: before } } }); }
}

export const SMS_CODE_STORE = 'SMS_CODE_STORE';

@Injectable()
export class SmsCodeService {
  private readonly logger = new Logger(SmsCodeService.name);

  constructor(
    @Inject(SMS_CODE_STORE) private readonly store: SmsCodeStore,
    @Inject(SMS_GATEWAY) private readonly gateway: SmsGateway,
    private readonly config: ConfigService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private num(key: string, fallback: number): number {
    const value = Number(this.config.get(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
  private get ttlSeconds() { return this.num('SMS_CODE_TTL_SECONDS', 300); }
  private get cooldownSeconds() { return this.num('SMS_RESEND_COOLDOWN_SECONDS', 60); }
  private get dailyPerPhone() { return this.num('SMS_DAILY_LIMIT_PER_PHONE', 10); }
  private get hourlyPerIp() { return this.num('SMS_HOURLY_LIMIT_PER_IP', 30); }
  private get maxAttempts() { return this.num('SMS_MAX_VERIFY_ATTEMPTS', 5); }
  private get production() { return this.config.get('NODE_ENV') === 'production'; }

  private secret(): string {
    const value = smsHmacSecret(this.config);
    if (!value) throw new ServiceUnavailableException('短信服务未配置，暂时无法发送验证码');
    return value;
  }
  private hmac(scope: string, value: string): string {
    return smsHmac(this.secret(), scope, value);
  }
  private phoneHash(phone: string) { return this.hmac('phone', phone); }
  private codeHash(phone: string, purpose: string, code: string) { return this.hmac('code', `${purpose}:${phone}:${code}`); }

  private tooMany(message: string): HttpException {
    return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
  }

  async send(phone: string, purpose: SmsPurpose, clientIp?: string): Promise<{ expiresInSeconds: number; resendAfterSeconds: number }> {
    const now = this.clock();
    const phoneHash = this.phoneHash(phone);
    const ipHash = clientIp ? this.hmac('ip', clientIp) : null;

    // 先限频，再发送：被限频的请求不产生任何费用
    const last = await this.store.latestCreatedAt(phoneHash, purpose);
    if (last) {
      const wait = this.cooldownSeconds - Math.floor((now.getTime() - last.getTime()) / 1000);
      if (wait > 0) throw this.tooMany(`获取验证码太频繁，请 ${wait} 秒后再试`);
    }
    if ((await this.store.countSince({ phoneHash, since: new Date(now.getTime() - 24 * 3600_000) })) >= this.dailyPerPhone) {
      throw this.tooMany('该手机号今天获取验证码次数过多，请明天再试');
    }
    if (ipHash && (await this.store.countSince({ ipHash, since: new Date(now.getTime() - 3600_000) })) >= this.hourlyPerIp) {
      throw this.tooMany('当前网络获取验证码次数过多，请稍后再试');
    }

    // 开发网关的固定验证码只在非生产环境生效；生产环境遇到开发网关一律当作未配置
    let code: string;
    if (this.gateway.fixedCodeForTesting) {
      if (this.production) throw new ServiceUnavailableException('短信服务未配置，暂时无法发送验证码');
      code = this.gateway.fixedCodeForTesting;
    } else {
      code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    }
    const codeHash = this.codeHash(phone, purpose, code); // 同时校验密钥已配置

    await this.store.purgeExpired(new Date(now.getTime() - 24 * 3600_000));
    await this.store.invalidateOpen(phoneHash, purpose, now);
    const created = await this.store.create({
      phone_hash: phoneHash, purpose, code_hash: codeHash, attempts: 0,
      expires_at: new Date(now.getTime() + this.ttlSeconds * 1000), consumed_at: null, request_ip_hash: ipHash, created_at: now,
    });
    try {
      await this.gateway.sendVerificationCode(phone, code, { purpose, ttlMinutes: Math.ceil(this.ttlSeconds / 60) });
    } catch (error) {
      // 发送失败：删掉这条记录，没有可用的验证码，也不占用冷却时间
      await this.store.delete(created.id);
      if (error instanceof HttpException) throw error;
      // 网关实现抛出的原始错误可能带着手机号：只记脱敏信息，对外一律是固定的中文提示
      this.logger.error(`短信网关发送失败 ${maskPhone(phone)} 用途=${purpose}`);
      throw new ServiceUnavailableException('短信发送失败，请稍后重试');
    }
    this.logger.log(`验证码已发送 ${maskPhone(phone)} 用途=${purpose}`);
    return { expiresInSeconds: this.ttlSeconds, resendAfterSeconds: this.cooldownSeconds };
  }

  /** 校验并消费验证码。成功后该验证码立即失效；失败按次数累计，达到上限整条作废。 */
  async verify(phone: string, purpose: SmsPurpose, code: string): Promise<void> {
    const now = this.clock();
    const open = await this.store.findOpen(this.phoneHash(phone), purpose, now);
    if (!open) throw new BadRequestException('验证码已过期或未获取，请重新获取');
    if (!(await this.store.bumpAttempts(open.id, this.maxAttempts))) {
      throw new BadRequestException('验证码错误次数过多，请重新获取');
    }
    const expected = Buffer.from(open.code_hash, 'hex');
    const actual = Buffer.from(this.codeHash(phone, purpose, String(code ?? '')), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new BadRequestException('验证码不正确');
    }
    if (!(await this.store.consume(open.id, now))) throw new BadRequestException('验证码已使用，请重新获取');
  }

  /** 注销账号时清除该手机号的全部验证码记录。 */
  async eraseForPhone(phone: string): Promise<number> {
    return this.store.deleteByPhoneHash(this.phoneHash(phone));
  }
}
