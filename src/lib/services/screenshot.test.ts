import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  toPhysicalRect,
  saveCapturedImage,
  triggerCapture,
  initScreenshots,
  MOCK_PNG_BASE64,
} from "./screenshot";
import { mockBackend, resetMock, MOCK_VAULT_PATH } from "./mock";
import { vaultStore } from "../stores/vault.svelte";
import { editorBridge } from "../stores/editorBridge.svelte";
import { getDailyNotePath } from "./templates";

function resetVaultStore() {
  vaultStore.vault = null;
  vaultStore.openFiles = [];
  vaultStore.activeFilePath = null;
}

describe("toPhysicalRect", () => {
  it("is identity at dpr 1", () => {
    expect(toPhysicalRect({ x: 10, y: 20, width: 30, height: 40 }, 1)).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    });
  });

  it("scales and rounds at dpr 1.25 (common Windows laptop scaling)", () => {
    expect(toPhysicalRect({ x: 10, y: 21, width: 30, height: 41 }, 1.25)).toEqual({
      x: 13, // 12.5 rounds up
      y: 26, // 26.25 rounds down
      width: 38, // 37.5 rounds up
      height: 51, // 51.25 rounds down
    });
  });

  it("doubles at dpr 2", () => {
    expect(toPhysicalRect({ x: 5, y: 6, width: 7, height: 8 }, 2)).toEqual({
      x: 10,
      y: 12,
      width: 14,
      height: 16,
    });
  });
});

describe("screenshot capture (mock mode)", () => {
  beforeEach(() => {
    resetMock();
    resetVaultStore();
    editorBridge.insertAtCursor = null;
  });

  it("saves captures with deterministic screenshot- filenames", async () => {
    const now = new Date(2026, 6, 30, 14, 30, 5, 7);
    const { relPath, markdown } = await saveCapturedImage(
      MOCK_PNG_BASE64,
      MOCK_VAULT_PATH,
      "attachments",
      now,
    );
    expect(relPath).toBe("attachments/screenshot-20260730-143005-007.png");
    expect(markdown).toBe("![](attachments/screenshot-20260730-143005-007.png)");
    const stored = mockBackend.getBinaryFile(
      `${MOCK_VAULT_PATH}\\attachments\\screenshot-20260730-143005-007.png`,
    );
    expect(stored).toBeDefined();
    expect(stored!.length).toBeGreaterThan(0);
  });

  it("routes to the daily note when no editor is active", async () => {
    await vaultStore.init(); // demo vault
    await initScreenshots();

    await triggerCapture(new Date(2026, 6, 30, 15, 0, 0, 0));

    const { filePath } = getDailyNotePath(MOCK_VAULT_PATH, "daily");
    await vi.waitFor(async () => {
      const content = await mockBackend.readFile(filePath);
      expect(content).toContain("![](attachments/screenshot-20260730-150000-000.png)");
    });
  });

  it("inserts at the cursor when an editor is registered for the active note", async () => {
    await vaultStore.init();
    await initScreenshots();

    vaultStore.openFiles = [
      { path: `${MOCK_VAULT_PATH}\\Welcome.md`, name: "Welcome.md", content: "hi", dirty: false },
    ];
    vaultStore.activeFilePath = `${MOCK_VAULT_PATH}\\Welcome.md`;
    const insert = vi.fn(() => true);
    editorBridge.insertAtCursor = insert;

    await triggerCapture(new Date(2026, 6, 30, 16, 0, 0, 0));

    await vi.waitFor(() => {
      expect(insert).toHaveBeenCalledWith(
        "![](attachments/screenshot-20260730-160000-000.png)",
      );
    });
    // Daily note must not have been created on this path
    const { filePath } = getDailyNotePath(MOCK_VAULT_PATH, "daily");
    await expect(mockBackend.readFile(filePath)).rejects.toThrow();
  });

  it("falls back to the daily note when the editor bridge declines", async () => {
    await vaultStore.init();
    await initScreenshots();

    vaultStore.openFiles = [
      { path: `${MOCK_VAULT_PATH}\\Welcome.md`, name: "Welcome.md", content: "hi", dirty: false },
    ];
    vaultStore.activeFilePath = `${MOCK_VAULT_PATH}\\Welcome.md`;
    editorBridge.insertAtCursor = vi.fn(() => false); // stale handler, no live view

    await triggerCapture(new Date(2026, 6, 30, 17, 0, 0, 0));

    const { filePath } = getDailyNotePath(MOCK_VAULT_PATH, "daily");
    await vi.waitFor(async () => {
      const content = await mockBackend.readFile(filePath);
      expect(content).toContain("screenshot-20260730-170000-000.png");
    });
  });
});
