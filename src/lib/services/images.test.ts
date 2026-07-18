import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  imageFileName,
  extForMime,
  markdownImageLink,
  savePastedImage,
  resolveImageSrc,
} from "./images";
import { renderMarkdown } from "../editor/markdown";
import { mockBackend, resetMock, MOCK_VAULT_PATH } from "./mock";

describe("image paste", () => {
  beforeEach(() => resetMock());

  it("generates timestamped filenames", () => {
    const d = new Date(2026, 6, 17, 9, 5, 3, 42);
    expect(imageFileName(d)).toBe("pasted-20260717-090503-042.png");
  });

  it("maps mime types to extensions", () => {
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("image/unknown")).toBe("png");
  });

  it("builds encoded markdown links", () => {
    expect(markdownImageLink("attachments/a b.png")).toBe("![](attachments/a%20b.png)");
    expect(markdownImageLink("attachments\\img.png")).toBe("![](attachments/img.png)");
  });

  it("saves a pasted blob into the vault attachments folder", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const now = new Date(2026, 6, 17, 10, 0, 0, 0);
    const { relPath, markdown } = await savePastedImage(
      blob,
      MOCK_VAULT_PATH,
      "attachments",
      now,
    );
    expect(relPath).toBe("attachments/pasted-20260717-100000-000.png");
    expect(markdown).toBe("![](attachments/pasted-20260717-100000-000.png)");
    const stored = mockBackend.getBinaryFile(
      `${MOCK_VAULT_PATH}\\attachments\\pasted-20260717-100000-000.png`,
    );
    expect(stored).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("passes absolute URLs through unchanged", () => {
    expect(resolveImageSrc("https://x.com/a.png", MOCK_VAULT_PATH)).toBe("https://x.com/a.png");
    expect(resolveImageSrc("data:image/png;base64,AAA", MOCK_VAULT_PATH)).toBe(
      "data:image/png;base64,AAA",
    );
  });

  it("resolves vault-relative paths to blob URLs in mock mode", async () => {
    const blob = new Blob([new Uint8Array([9])], { type: "image/png" });
    const now = new Date(2026, 6, 17, 11, 0, 0, 0);
    const { relPath } = await savePastedImage(blob, MOCK_VAULT_PATH, "attachments", now);

    const createObjectURL = vi.fn(() => "blob:mock-url-1");
    vi.stubGlobal("URL", Object.assign(Object.create(URL), URL, { createObjectURL }));
    try {
      const url = resolveImageSrc(relPath, MOCK_VAULT_PATH);
      expect(url).toBe("blob:mock-url-1");
      // cached on second call — no new object URL
      resolveImageSrc(relPath, MOCK_VAULT_PATH);
      expect(createObjectURL).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns null for unresolvable relative paths", () => {
    expect(resolveImageSrc("attachments/missing.png", MOCK_VAULT_PATH)).toBeNull();
    expect(resolveImageSrc("a.png", "")).toBeNull();
  });

  it("renderMarkdown rewrites image srcs via resolveImage", () => {
    const html = renderMarkdown("![alt](attachments/x.png)", {
      resolveImage: (src) => `asset://resolved/${src}`,
    });
    expect(html).toContain('src="asset://resolved/attachments/x.png"');
    expect(html).toContain('alt="alt"');
  });

  it("renderMarkdown leaves srcs alone when resolver returns null", () => {
    const html = renderMarkdown("![](attachments/x.png)", {
      resolveImage: () => null,
    });
    expect(html).toContain('src="attachments/x.png"');
  });
});
