import { Controller, Get, Header, Param, Res, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProvenanceService } from './provenance.service';

/**
 * Serves the signed (C2PA) copies of generated media. Public on purpose — the URL is rendered in an <img>/<video> tag —
 * and protected by an unguessable 128-bit name plus a retention TTL. The global throttler still applies.
 */
@ApiTags('ai')
@Controller('ai/media')
export class MediaController {
  constructor(private readonly provenance: ProvenanceService) {}

  @Get(':file')
  @ApiOperation({ summary: 'Signed generated media (carries C2PA Content Credentials)' })
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'public, max-age=86400, immutable')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async get(@Param('file') file: string, @Res() res: any) {
    const media = await this.provenance.mediaStore().get(file);
    if (!media) throw new NotFoundException();
    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Content-Length', String(media.buffer.length));
    res.setHeader('Content-Disposition', 'inline');
    res.end(media.buffer);
  }
}
