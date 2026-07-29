import { Test, TestingModule } from '@nestjs/testing';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';

describe('PublishController', () => {
  let controller: PublishController;
  const service = {
    createTask: jest.fn(),
    getTasks: jest.fn(),
    retryTask: jest.fn(),
    cancelTask: jest.fn(),
  };
  const request = { user: { sub: 'user_1', tenantId: 'tenant_1' } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublishController],
      providers: [{ provide: PublishService, useValue: service }],
    }).compile();
    controller = module.get(PublishController);
  });

  it('passes authenticated tenant and user identifiers to task creation', async () => {
    const body = {
      contentId: 'content_1',
      platformAccountIds: ['account_1'],
      publishType: 'immediate',
    };
    service.createTask.mockResolvedValue([{ id: 'task_1' }]);

    await expect(controller.createTask(request, body)).resolves.toEqual([
      { id: 'task_1' },
    ]);
    expect(service.createTask).toHaveBeenCalledWith('tenant_1', 'user_1', body);
  });

  it('passes list filters to the service', async () => {
    service.getTasks.mockResolvedValue({ tasks: [], pagination: { total: 0 } });
    await controller.getTasks(request, 'queued', 2, 10);
    expect(service.getTasks).toHaveBeenCalledWith('tenant_1', {
      status: 'queued',
      page: 2,
      pageSize: 10,
    });
  });
});
