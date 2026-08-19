import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PersonaService {
    private readonly logger = new Logger(PersonaService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll(tenantId: string) {
        return this.prisma.persona.findMany({
            where: {
                OR: [
                    { tenant_id: tenantId },
                    { is_system: true }
                ],
            },
            orderBy: { created_at: 'desc' },
        });
    }

    async findOne(tenantId: string, id: string) {
        return this.prisma.persona.findFirst({
            where: {
                id,
                OR: [
                    { tenant_id: tenantId },
                    { is_system: true }
                ],
            },
        });
    }

    async create(tenantId: string, data: any) {
        return this.prisma.persona.create({
            data: {
                ...data,
                tenant_id: tenantId,
                is_system: false,
            },
        });
    }

    async update(tenantId: string, id: string, data: any) {
        return this.prisma.persona.updateMany({
            where: { id, tenant_id: tenantId },
            data,
        });
    }

    async remove(tenantId: string, id: string) {
        return this.prisma.persona.deleteMany({
            where: { id, tenant_id: tenantId },
        });
    }
}
