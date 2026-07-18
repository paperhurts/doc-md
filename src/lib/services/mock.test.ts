import { describe, it, expect, beforeEach } from "vitest";
import { mockBackend, resetMock, MOCK_VAULT_PATH } from "./mock";

describe("mock backend", () => {
  beforeEach(() => resetMock());

  it("returns the demo vault", async () => {
    const vault = await mockBackend.getCurrentVault();
    expect(vault).toEqual({ path: MOCK_VAULT_PATH, name: "demo-vault" });
  });

  it("lists seeded files including directories", async () => {
    const tree = await mockBackend.listFiles(MOCK_VAULT_PATH);
    const names = tree.map((e) => e.name);
    expect(names).toContain("Welcome.md");
    expect(names).toContain("Project Board.md");
    const daily = tree.find((e) => e.name === "daily");
    expect(daily?.is_dir).toBe(true);
  });

  it("reads and writes files", async () => {
    const path = `${MOCK_VAULT_PATH}\\New.md`;
    await mockBackend.writeFile(path, "# New");
    expect(await mockBackend.readFile(path)).toBe("# New");
  });

  it("throws on missing file", async () => {
    await expect(mockBackend.readFile("C:\\nope.md")).rejects.toThrow("File not found");
  });

  it("renames files", async () => {
    const a = `${MOCK_VAULT_PATH}\\A.md`;
    const b = `${MOCK_VAULT_PATH}\\B.md`;
    await mockBackend.writeFile(a, "x");
    await mockBackend.renameFile(a, b);
    expect(await mockBackend.readFile(b)).toBe("x");
    await expect(mockBackend.readFile(a)).rejects.toThrow();
  });

  it("deletes files", async () => {
    const path = `${MOCK_VAULT_PATH}\\Welcome.md`;
    await mockBackend.deleteFile(path);
    await expect(mockBackend.readFile(path)).rejects.toThrow();
  });

  it("writes and reads back binary files", async () => {
    const path = `${MOCK_VAULT_PATH}\\attachments\\img.png`;
    const base64 = btoa("PNGDATA");
    await mockBackend.writeBinaryFile(path, base64);
    const bin = mockBackend.getBinaryFile(path);
    expect(bin).toBeDefined();
    expect(new TextDecoder().decode(bin!)).toBe("PNGDATA");
    // binary files appear in the tree
    const tree = await mockBackend.listFiles(MOCK_VAULT_PATH);
    const attachments = tree.find((e) => e.name === "attachments");
    expect(attachments?.is_dir).toBe(true);
    expect(attachments?.children?.some((c) => c.name === "img.png")).toBe(true);
  });
});
