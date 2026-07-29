import { SystemController } from './system.controller';

describe('SystemController', () => {
  it('returns a healthy response for container probes', () => {
    const response = new SystemController().healthCheck();
    expect(response).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'fenfa-ai-api',
      }),
    );
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });
});
