import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ContentService, DELETE_OTHERS_FORBIDDEN } from "./content.service";

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
  const owner = { sub: "user-owner", role: "owner" };
  const admin = { sub: "user-admin", role: "admin" };
  const editor = { sub: "user-editor", role: "editor" };

  beforeEach(() => {
    findFirst.mockReset();
    update.mockReset();
  });

  it("soft-deletes content owned by this workspace when the actor is an owner", async () => {
    findFirst.mockResolvedValue({ id: "c-1", created_by: "someone-else" });
    update.mockResolvedValue({ id: "c-1", status: "deleted" });

    await expect(service.delete("c-1", "tenant-1", owner)).resolves.toMatchObject({ status: "deleted" });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "c-1", tenant_id: "tenant-1" },
      select: { id: true, created_by: true },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "c-1" },
      data: { status: "deleted" },
    });
  });

  it.each(["owner", "admin"])("%s can delete another member's content", async (role) => {
    findFirst.mockResolvedValue({ id: "c-1", created_by: "user-editor" });
    update.mockResolvedValue({ id: "c-1", status: "deleted" });
    await expect(service.delete("c-1", "tenant-1", role === "owner" ? owner : admin)).resolves.toMatchObject({ status: "deleted" });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("editor can delete content they created", async () => {
    findFirst.mockResolvedValue({ id: "c-own", created_by: "user-editor" });
    update.mockResolvedValue({ id: "c-own", status: "deleted" });
    await expect(service.delete("c-own", "tenant-1", editor)).resolves.toMatchObject({ status: "deleted" });
  });

  it("editor cannot delete content created by the owner", async () => {
    findFirst.mockResolvedValue({ id: "c-owner", created_by: "user-owner" });
    await expect(service.delete("c-owner", "tenant-1", editor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.delete("c-owner", "tenant-1", editor)).rejects.toThrow(DELETE_OTHERS_FORBIDDEN);
    expect(update).not.toHaveBeenCalled();
  });

  it("editor cannot delete content with no creator", async () => {
    findFirst.mockResolvedValue({ id: "c-anon", created_by: null });
    await expect(service.delete("c-anon", "tenant-1", editor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["other tenant", "missing id"])("returns 404 when the content is not owned (%s)", async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.delete("c-other", "tenant-1", owner)).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it("turns a Prisma not-found on update into 404 instead of 500", async () => {
    findFirst.mockResolvedValue({ id: "c-1", created_by: "user-owner" });
    update.mockRejectedValue(Object.assign(new Error("record not found"), { code: "P2025" }));
    await expect(service.delete("c-1", "tenant-1", owner)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("batch delete checks each row and totals success and failure without deleting forbidden rows", async () => {
    findFirst.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "c-own") return { id: "c-own", created_by: "user-editor" };
      if (where.id === "c-owner") return { id: "c-owner", created_by: "user-owner" };
      return null;
    });
    update.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id, status: "deleted" }));

    const summary = await service.deleteMany(["c-owner", "c-own", "c-own", "c-missing", ""], "tenant-1", editor);

    expect(summary).toEqual({
      succeeded: 1,
      failed: 2,
      failures: [
        { id: "c-owner", message: DELETE_OTHERS_FORBIDDEN },
        { id: "c-missing", message: "内容不存在" },
      ],
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ where: { id: "c-own" }, data: { status: "deleted" } });
  });

  it("batch delete rejects an empty selection", async () => {
    await expect(service.deleteMany(["  ", ""], "tenant-1", owner)).rejects.toThrow(/请选择要删除的内容/);
    expect(update).not.toHaveBeenCalled();
  });
});
