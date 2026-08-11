import { describe, it, expect, beforeEach } from "vitest";
import { vaultStore } from "./vault.svelte";
import { mockBackend, resetMock, MOCK_VAULT_PATH } from "../services/mock";
import { getDailyNotePath } from "../services/templates";

const WELCOME = `${MOCK_VAULT_PATH}\\Welcome.md`;

describe("vaultStore append primitives", () => {
  beforeEach(async () => {
    resetMock();
    vaultStore.vault = null;
    vaultStore.openFiles = [];
    vaultStore.activeFilePath = null;
    await vaultStore.init();
  });

  it("appends to a note that is not open", async () => {
    const before = await mockBackend.readFile(WELCOME);
    await vaultStore.appendToNote(WELCOME, "\nappended line\n");
    const after = await mockBackend.readFile(WELCOME);
    expect(after).toBe(before + "\nappended line\n");
    expect(vaultStore.openFiles).toHaveLength(0);
  });

  it("appends through an open dirty buffer, preserving unsaved edits", async () => {
    vaultStore.openFiles = [
      { path: WELCOME, name: "Welcome.md", content: "unsaved edit", dirty: true, lastSynced: "" },
    ];
    await vaultStore.appendToNote(WELCOME, "\nappended\n");

    const buffer = vaultStore.openFiles[0];
    expect(buffer.content).toBe("unsaved edit\nappended\n");
    expect(buffer.dirty).toBe(false); // appendToNote saves immediately
    // The write went through the buffer — unsaved edits survived
    expect(await mockBackend.readFile(WELCOME)).toBe("unsaved edit\nappended\n");
  });

  it("auto-creates the daily note when appending with none present", async () => {
    const { filePath } = getDailyNotePath(MOCK_VAULT_PATH, "daily");
    await expect(mockBackend.readFile(filePath)).rejects.toThrow();

    await vaultStore.appendToDailyNote("\ncaptured item\n");

    const content = await mockBackend.readFile(filePath);
    expect(content).toContain("captured item");
    // Templated (daily-note header), not just the appended text
    expect(content.length).toBeGreaterThan("\ncaptured item\n".length);
    // Never opens UI
    expect(vaultStore.openFiles).toHaveLength(0);
  });

  it("appends to an existing daily note without duplicating the template", async () => {
    const { filePath } = getDailyNotePath(MOCK_VAULT_PATH, "daily");
    await mockBackend.writeFile(filePath, "# Today\n");

    await vaultStore.appendToDailyNote("first\n");
    await vaultStore.appendToDailyNote("second\n");

    expect(await mockBackend.readFile(filePath)).toBe("# Today\nfirst\nsecond\n");
  });
});
