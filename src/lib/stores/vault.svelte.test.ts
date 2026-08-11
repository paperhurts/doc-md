import { describe, it, expect, beforeEach } from "vitest";
import { vaultStore } from "./vault.svelte";
import { resetMock, MOCK_VAULT_PATH } from "../services/mock";
import { readFile } from "../services/tauri";

beforeEach(async () => {
  resetMock();
  vaultStore.vault = null;
  vaultStore.openFiles = [];
  vaultStore.activeFilePath = null;
  await vaultStore.init(); // demo vault
});

describe("createNote", () => {
  it("creates at the vault root by default", async () => {
    await vaultStore.createNote("Root Note");
    const path = `${MOCK_VAULT_PATH}\\Root Note.md`;
    expect(vaultStore.activeFilePath).toBe(path);
    expect(await readFile(path)).toContain("Root Note");
  });

  it("creates inside the given subfolder", async () => {
    const folder = `${MOCK_VAULT_PATH}\\daily`;
    await vaultStore.createNote("Sub Note", undefined, folder);
    const path = `${folder}\\Sub Note.md`;
    expect(vaultStore.activeFilePath).toBe(path);
    expect(await readFile(path)).toContain("Sub Note");
  });
});
