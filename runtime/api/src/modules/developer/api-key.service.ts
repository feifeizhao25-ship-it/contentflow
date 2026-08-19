import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * 生成新的 API Key (只返回一次明文)
     */
    async createKey(tenantId: string, name: string, scopes: string[] = ['content:read', 'content:write']) {
        const rawKey = `sk_ff_${this.generateRandomString(32)}`;
        const hashedKey = this.hashKey(rawKey);

        const apiKey = await (this.prisma as any).api_keys.create({
            data: {
                tenant_id: tenantId,
                name,
                key_hash: hashedKey,
                scopes,
                last_used_at: null,
            },
        });

        return {
            ...apiKey,
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
        const keyRecord = await (this.prisma as any).api_keys.findFirst({
            where: { key_hash: hashedKey },
        });

        if (!keyRecord) {
            throw new UnauthorizedException('API Key 不存在或已失效');
        }

        // 更新最后使用时间 (异步执行，不阻塞请求)
        (this.prisma as any).api_keys.update({
            where: { id: keyRecord.id },
            data: { last_used_at: new Date() }
        }).catch(() => { });

        return keyRecord;
    }

    async listKeys(tenantId: string) {
        return (this.prisma as any).api_keys.findMany({
            where: { tenant_id: tenantId },
            orderBy: { created_at: 'desc' },
        });
    }

    private hashKey(key: string): string {
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    private generateRandomString(length: number): string {
        return crypto.randomBytes(length).toString('hex').substring(0, length);
    }
}
