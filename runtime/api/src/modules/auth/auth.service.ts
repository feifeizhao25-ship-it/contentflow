import { CN_PLANS, PLANS } from '../billing/plans.constant';
import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterPhoneDto } from './dto/phone.dto';
import { maskEmail, maskPhone } from '../../common/pii';
import { CONSENT_VERSION } from './consent';
import { placeholderEmail, publicEmail } from './phone-account';
import { normalizeChinaMobile } from './sms/phone';
import { SmsCodeService } from './sms/sms-code.service';

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  tenantId: string;
  role: string;
}

export interface AuthResponse {
  user: {
    id: string;
    /** 手机号注册的账号没有邮箱：为空字符串（占位邮箱不外露） */
    email: string;
    /** 脱敏后的手机号，如 138****5678 */
    phone?: string;
    name: string;
    role: string;
  };
  token: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly smsCodes: SmsCodeService,
  ) {}

  private freeLimits() {
    const freePlan = process.env.MARKET_REGION === 'global' ? PLANS[0] : CN_PLANS[0];
    return {
      limits: {
        max_accounts: freePlan.platformLimit,
        max_members: 1,
        max_publishes_monthly: freePlan.monthlyPostQuota,
        max_ai_tokens_monthly: 50000,
        max_storage_gb: 1,
      },
      usage_stats: {
        accounts_count: 0,
        members_count: 1,
        publishes_this_month: 0,
        ai_calls_this_month: 0,
        storage_used_mb: 0,
      },
    };
  }

  private authUser(user: any): AuthResponse['user'] {
    return {
      id: user.id,
      email: publicEmail(user.email),
      ...(user.phone ? { phone: maskPhone(user.phone) } : {}),
      name: user.name || '',
      role: user.role,
    };
  }

  private issue(user: any): AuthResponse {
    return { user: this.authUser(user), token: this.generateToken(user), refreshToken: this.generateRefreshToken(user) };
  }

  private mobile(raw: unknown): string {
    const phone = normalizeChinaMobile(raw);
    if (!phone) throw new BadRequestException('请输入正确的 11 位中国大陆手机号');
    return phone;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (error as { code?: string } | null)?.code === 'P2002';
  }

  private async findActiveByPhone(phone: string): Promise<any | null> {
    return (await this.prisma.user.findFirst({ where: { phone, status: 'active' } })) as any;
  }

  /** 注册 / 登录用的验证码（未登录）。 */
  async sendPublicSmsCode(rawPhone: string, purpose: 'register' | 'login', clientIp?: string) {
    const phone = this.mobile(rawPhone);
    const existing = await this.findActiveByPhone(phone);
    if (purpose === 'register' && existing) throw new ConflictException('该手机号已注册，请直接登录');
    if (purpose === 'login' && !existing) {
      // 不告诉对方「这个手机号没注册过」，也不为不存在的账号花短信费：响应与成功一致，但不发送
      return { expiresInSeconds: 300, resendAfterSeconds: 60 };
    }
    return this.smsCodes.send(phone, purpose, clientIp);
  }

  async registerWithPhone(dto: RegisterPhoneDto): Promise<AuthResponse> {
    const phone = this.mobile(dto.phone);
    if (await this.findActiveByPhone(phone)) throw new ConflictException('该手机号已注册，请直接登录');
    await this.smsCodes.verify(phone, 'register', dto.code);

    const id = randomUUID();
    const { limits, usage_stats } = this.freeLimits();
    const now = new Date();
    let user: any;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.tenantName || (dto.name ? `${dto.name}的工作室` : '我的工作室'),
            slug: `u_${id.slice(0, 8)}_${Date.now().toString(36)}`,
            limits,
            usage_stats,
          },
        });
        return tx.user.create({
          data: {
            id,
            tenant_id: tenant.id,
            email: placeholderEmail(id),
            phone,
            phone_verified: true,
            name: dto.name,
            role: 'owner',
            email_verified: false,
            consent_version: CONSENT_VERSION,
            consent_at: now,
            last_login_at: now,
            login_count: 1,
          } as any,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('该手机号已注册，请直接登录');
      throw error;
    }
    this.logger.log(`手机号用户注册 ${maskPhone(phone)}`);
    return this.issue(user);
  }

  async loginWithSms(rawPhone: string, code: string): Promise<AuthResponse> {
    const phone = this.mobile(rawPhone);
    await this.smsCodes.verify(phone, 'login', code);
    const user = await this.findActiveByPhone(phone);
    if (!user) throw new UnauthorizedException('账号不存在或已注销');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date(), login_count: { increment: 1 } },
    });
    this.logger.log(`手机号用户登录 ${maskPhone(phone)}`);
    return this.issue(user);
  }

  /** 已登录用户绑定手机号：先发验证码。 */
  async sendBindSmsCode(userId: string, rawPhone: string, clientIp?: string) {
    const phone = this.mobile(rawPhone);
    const owner = await this.findActiveByPhone(phone);
    if (owner && owner.id !== userId) throw new ConflictException('该手机号已被其他账号绑定');
    if (owner && owner.id === userId && owner.phone_verified) throw new BadRequestException('该手机号已绑定到当前账号');
    return this.smsCodes.send(phone, 'bind', clientIp);
  }

  async bindPhone(userId: string, rawPhone: string, code: string) {
    const phone = this.mobile(rawPhone);
    const owner = await this.findActiveByPhone(phone);
    if (owner && owner.id !== userId) throw new ConflictException('该手机号已被其他账号绑定');
    await this.smsCodes.verify(phone, 'bind', code);
    try {
      await this.prisma.user.update({ where: { id: userId }, data: { phone, phone_verified: true } });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('该手机号已被其他账号绑定');
      throw error;
    }
    this.logger.log(`绑定手机号 ${maskPhone(phone)}`);
    return { phone: maskPhone(phone), phone_verified: true };
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name, tenantName } = dto;
    const { limits, usage_stats } = this.freeLimits();

    // 检查邮箱是否已存在
    const existingUser = await this.prisma.user.findFirst({
      where: { email, status: 'active' },
    });

    if (existingUser) {
      throw new ConflictException('邮箱已被注册');
    }

    // 密码加密
    const passwordHash = await bcrypt.hash(password, 12);

    // 租户与用户在同一个事务里创建：失败不留下没有用户的空工作区
    const now = new Date();
    let user: any;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: tenantName || (name ? `${name}的工作室` : '我的工作室'),
            slug: email.split('@')[0] + '_' + Date.now().toString(36),
            limits,
            usage_stats,
          },
        });
        return tx.user.create({
          data: {
            tenant_id: tenant.id,
            email,
            password_hash: passwordHash,
            name,
            role: 'owner',
            email_verified: false,
            consent_version: CONSENT_VERSION,
            consent_at: now,
          } as any,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw new ConflictException('邮箱已被注册');
      throw error;
    }

    // 生成token
    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    this.logger.log(`User registered: ${maskEmail(email)}`);

    return {
      user: this.authUser(user),
      token,
      refreshToken,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const { email, password } = dto;

    // 查找用户
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        status: 'active',
      },
    }) as any;

    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 获取租户信息
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenant_id },
    }) as any;

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash || '');

    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 将租户信息添加到用户对象（用于 token 生成）
    user.tenant = tenant;

    // 更新登录信息
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        login_count: { increment: 1 },
      },
    });

    // 生成token
    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    this.logger.log(`User logged in: ${maskEmail(email)}`);

    return {
      user: this.authUser(user),
      token,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('无效的刷新令牌');
      }

      const newToken = this.generateToken(user);

      return { token: newToken };
    } catch {
      throw new UnauthorizedException('无效的刷新令牌');
    }
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    }) as any;
    
    if (!user) return null;
    
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenant_id },
    }) as any;
    
    user.tenant = tenant;
    return user;
  }

  private generateToken(user: any): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  private generateRefreshToken(user: any): string {
    const payload = {
      sub: user.id,
      type: 'refresh',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: '30d',
    });
  }
}
