import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  tenantId: string;
  role: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
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
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const { email, password, name, tenantName } = dto;

    // 检查邮箱是否已存在
    const existingUser = await this.prisma.user.findFirst({
      where: { email, status: 'active' },
    });

    if (existingUser) {
      throw new ConflictException('邮箱已被注册');
    }

    // 密码加密
    const passwordHash = await bcrypt.hash(password, 12);

    // 创建租户
    const tenant = await this.prisma.tenant.create({
      data: {
        name: tenantName || `${name}的工作室`,
        slug: email.split('@')[0] + '_' + Date.now().toString(36),
        limits: {
          max_accounts: 2,
          max_members: 1,
          max_publishes_monthly: 30,
          max_ai_calls_monthly: 20,
          max_storage_gb: 1,
        },
        usage_stats: {
          accounts_count: 0,
          members_count: 1,
          publishes_this_month: 0,
          ai_calls_this_month: 0,
          storage_used_mb: 0,
        },
      },
    });

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        tenant_id: tenant.id,
        email,
        password_hash: passwordHash,
        name,
        role: 'owner',
        email_verified: false,
      },
    });

    // 生成token
    const token = this.generateToken(user);
    const refreshToken = this.generateRefreshToken(user);

    this.logger.log(`User registered: ${email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role,
      },
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

    this.logger.log(`User logged in: ${email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role,
      },
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
