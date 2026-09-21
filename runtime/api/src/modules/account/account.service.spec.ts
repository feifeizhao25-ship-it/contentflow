import { ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { AccountService, PLATFORM_NAMES } from './account.service';

describe('platform account authorization', () => {
  const service = new AccountService({} as never);

  it.each(Object.keys(PLATFORM_NAMES))('%s says OAuth is not open yet instead of returning a broken URL', async (platform) => {
    await expect(service.getAuthUrl(platform)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects unknown platforms', async () => {
    await expect(service.getAuthUrl('xhs')).rejects.toBeInstanceOf(BadRequestException);
  });
});
