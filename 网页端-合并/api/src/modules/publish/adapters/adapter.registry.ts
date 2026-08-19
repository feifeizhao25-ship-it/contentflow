import { Injectable, Logger } from '@nestjs/common';
import { PlatformAdapter } from './adapter.interface';

@Injectable()
export class AdapterRegistry {
    private readonly logger = new Logger(AdapterRegistry.name);
    private readonly adapters = new Map<string, PlatformAdapter>();

    register(adapter: PlatformAdapter) {
        this.logger.log(`Registering adapter for platform: ${adapter.platform}`);
        this.adapters.set(adapter.platform, adapter);
    }

    get(platform: string): PlatformAdapter {
        const a = this.adapters.get(platform);
        if (!a) {
            throw new Error(`Adapter not found for platform: ${platform}`);
        }
        return a;
    }

    list() {
        return [...this.adapters.keys()];
    }
}
