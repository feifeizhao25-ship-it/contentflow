/**
 * 创作页 /studio 调用 GET / POST /contents/:id/assets，后端原来没有这两个接口（404 被前端吞掉，
 * 脚本和封面存不上、也读不回）。这里补上：素材就是内容自己的字段（body / cover_url / media_urls），
 * 写入走 update()，状态、AI 标识、白名单规则照旧。
 */
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ContentService, normalizeAssets } from "./content.service";

function setup(row: Record<string, unknown> | null) {
  const findFirst = jest.fn().mockResolvedValue(row);
  const update = jest.fn().mockImplementation(async ({ data }) => {
    Object.assign(row ?? {}, data);
    return row;
  });
  const service = new ContentService({ content: { findFirst, update } } as any);
  return { service, findFirst, update };
}

describe("ContentService assets", () => {
  it("lists script, cover and media from the content itself", async () => {
    const { service, findFirst } = setup({
      id: "c1", tenant_id: "t1", status: "draft", body: "正文", cover_url: "https://cdn.example/cover.png",
      media_urls: ["https://cdn.example/cover.png", "https://cdn.example/a.jpg", "https://cdn.example/v.mp4"],
    });
    const { assets } = await service.listAssets("c1", "t1");
    expect(findFirst).toHaveBeenCalledWith({ where: { id: "c1", tenant_id: "t1" } });
    expect(assets).toEqual([
      { type: "script", url: "", label: "正文脚本", meta: { content: "正文" } },
      { type: "cover", url: "https://cdn.example/cover.png", label: "封面图" },
      { type: "image", url: "https://cdn.example/a.jpg", label: "配图" },
      { type: "video", url: "https://cdn.example/v.mp4", label: "视频" },
    ]);
  });

  it("is 404 for another workspace or a deleted content", async () => {
    await expect(setup(null).service.listAssets("c1", "other")).rejects.toBeInstanceOf(NotFoundException);
    await expect(setup({ id: "c1", status: "deleted" }).service.listAssets("c1", "t1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("saves the studio payload into body, cover_url and media_urls through update()", async () => {
    const row = { id: "c1", tenant_id: "t1", status: "draft", source: "manual", body: "旧", cover_url: null, media_urls: [] };
    const { service, update } = setup(row);
    const out = await service.appendAssets("c1", "t1", "u1", [
      { type: "script", url: "", label: "正文脚本", meta: { content: "新脚本" } },
      { type: "cover", url: "https://cdn.example/c.png", label: "封面图" },
    ]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].data).toEqual(expect.objectContaining({
      body: "新脚本", cover_url: "https://cdn.example/c.png", media_urls: ["https://cdn.example/c.png"],
    }));
    expect(out.assets.map((a) => a.type)).toEqual(["script", "cover"]);
  });

  it("does not write when nothing changed", async () => {
    const { service, update } = setup({ id: "c1", status: "draft", body: "同", cover_url: "https://x/c.png", media_urls: ["https://x/c.png"] });
    await service.appendAssets("c1", "t1", "u1", [
      { type: "script", url: "", meta: { content: "同" } },
      { type: "cover", url: "https://x/c.png" },
    ]);
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps the edit rules: approved content cannot be changed", async () => {
    const { service } = setup({ id: "c1", status: "approved", body: "旧", media_urls: [] });
    await expect(
      service.appendAssets("c1", "t1", "u1", [{ type: "script", url: "", meta: { content: "改" } }]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("keeps the AI label on AI content", async () => {
    const row = { id: "c1", status: "draft", source: "ai", body: "旧", media_urls: [] };
    const { service, update } = setup(row);
    await service.appendAssets("c1", "t1", "u1", [{ type: "script", url: "", meta: { content: "模型写的脚本" } }]);
    expect(String(update.mock.calls[0][0].data.body)).toContain("AI");
  });

  it("rejects bad items with a readable reason", () => {
    expect(() => normalizeAssets([{ type: "exe", url: "https://x" }])).toThrow(BadRequestException);
    expect(() => normalizeAssets([{ type: "cover", url: "javascript:alert(1)" }])).toThrow(/第 1 个素材（封面图）的地址不对/);
    expect(() => normalizeAssets([{ type: "script", url: "" }])).toThrow(/缺少内容/);
    expect(() => normalizeAssets(["x"])).toThrow(/格式不对/);
  });
});
