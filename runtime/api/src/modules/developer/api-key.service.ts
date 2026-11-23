import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

/** 只有显式打开时才允许创建开发者 API 密钥。未设置、false、1 都不算打开。 */
export function developerApiKeysEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.DEVELOPER_API_KEYS_ENABLED === 'true';
}

export const API_KEYS_CLOSED_MESSAGE = '开发者 API 密钥暂未开放，暂时不能创建';

@Injectable()
export class ApiKeyService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * 生成新的 API Key (只返回一次明文)
     * 默认关闭：页面已标明尚未开放，直接调创建接口也不能绕过。
     */
    async createKey(tenantId: string, name: string, scopes: string[] = ['content:read', 'content:write']) {
        if (!developerApiKeysEnabled()) {
            throw new ForbiddenException(API_KEYS_CLOSED_MESSAGE);
        }
        const rawKey = `sk_ff_${this.generateRandomString(32)}`;
        const hashedKey = this.hashKey(rawKey);

        const apiKey = await (this.prisma as any).apiKey.create({
            data: {
                tenant_id: tenantId,
                name,
                key_prefix: rawKey.slice(0, 10),
                key_hash: hashedKey,
                scopes,
            },
        });

        const { key_hash: _omit, ...safe } = apiKey;
        return {
            ...safe,
            secret: rawKey // 只有创建时返回明文
        };
    }

    /**
     * 验证 API Key
     */
    async validateKey(rawKey: string): Promise<any> {
        if (!rawKey.startsWith('sk_ff_')) {
            throw new UnauthorizedException('无效的 API Key 格式');
        }

        const hashedKey = this.hashKey(rawKey);
        const keyRecord = await (this.prisma as any).apiKey.findFirst({
            where: { key_hash: hashedKey },
        });

        if (!keyRecord) {
            throw new UnauthorizedException('API Key 不存在或已失效');
        }

        // 更新最后使用时间 (异步执行，不阻塞请求)
        (this.prisma as any).apiKey.update({
            where: { id: keyRecord.id },
            data: { last_used_at: new Date() }
        }).catch(() => { });

        return keyRecord;
    }

    async listKeys(tenantId: string) {
        // 模型是 ApiKey（prisma 客户端属性 apiKey）；原先写成 api_keys，列表恒 500（I-05）。永不返回 key_hash。
        const rows = await (this.prisma as any).apiKey.findMany({
            where: { tenant_id: tenantId },
            orderBy: { created_at: 'desc' },
        });
        return rows.map(({ key_hash: _omit, ...safe }: any) => safe);
    }

    private hashKey(key: string): string {
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    private generateRandomString(length: number): string {
        return crypto.randomBytes(length).toString('hex').substring(0, length);
    }
}
