import { ContentService } from "./content.service";

describe("ContentService", () => {
  const create = jest.fn();
  const prisma = { content: { create } } as any;
  const service = new ContentService(prisma);

  beforeEach(() => {
    create.mockReset();
  });

  it("persists generated content as an AI draft with generation metadata", async () => {
    create.mockResolvedValue({ id: "content-1" });

    await service.create("tenant-1", "user-1", {
      title: "测试标题",
      body: "测试正文",
      content_type: "script",
      tags: ["短视频"],
      source: "ai",
      ai_model: "model-1",
      ai_params: { topic: "测试主题" },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: "tenant-1",
        created_by: "user-1",
        status: "draft",
        source: "ai",
        ai_model: "model-1",
        ai_params: { topic: "测试主题" },
      }),
    });
  });

  it("does not let clients persist an arbitrary source value", async () => {
    create.mockResolvedValue({ id: "content-2" });

    await service.create("tenant-1", "user-1", {
      content_type: "article",
      source: "external-admin",
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ source: "manual" }),
    });
  });
});
