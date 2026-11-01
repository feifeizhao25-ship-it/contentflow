import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { ProvenanceService } from './provenance.service';

@Module({
  providers: [ProvenanceService],
  controllers: [MediaController],
  exports: [ProvenanceService],
})
export class ProvenanceModule {}
