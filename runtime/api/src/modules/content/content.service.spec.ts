import { NotFoundException } from "@nestjs/common";
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

describe("ContentService.delete", () => {
  const findFirst = jest.fn();
  const update = jest.fn();
  const service = new ContentService({ content: { findFirst, update } } as any);

  beforeEach(() => {
    findFirst.mockReset();
    update.mockReset();
  });

  it("soft-deletes content owned by this workspace", async () => {
    findFirst.mockResolvedValue({ id: "c-1" });
    update.mockResolvedValue({ id: "c-1", status: "deleted" });

    await expect(service.delete("c-1", "tenant-1")).resolves.toMatchObject({ status: "deleted" });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "c-1", tenant_id: "tenant-1" },
      select: { id: true },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: { status: "deleted" },
    });
  });

  it.each(["other tenant", "missing id"])("returns 404 when the content is not owned (%s)", async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.delete("c-other", "tenant-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it("turns a Prisma not-found on update into 404 instead of 500", async () => {
    findFirst.mockResolvedValue({ id: "c-1" });
    update.mockRejectedValue(Object.assign(new Error("record not found"), { code: "P2025" }));
    await expect(service.delete("c-1", "tenant-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
