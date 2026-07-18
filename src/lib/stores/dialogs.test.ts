import { describe, it, expect, beforeEach } from "vitest";
import { dialogStore } from "./dialogs.svelte";

describe("dialog store", () => {
  beforeEach(() => {
    // Drain anything a failed test left behind
    while (dialogStore.current) dialogStore.cancel();
  });

  it("prompt resolves with the submitted value", async () => {
    const result = dialogStore.prompt("Note name:", "My note");
    expect(dialogStore.current?.kind).toBe("prompt");
    expect(dialogStore.current?.title).toBe("Note name:");
    dialogStore.submit("hello");
    await expect(result).resolves.toBe("hello");
    expect(dialogStore.current).toBeNull();
  });

  it("prompt resolves null on cancel", async () => {
    const result = dialogStore.prompt("Note name:");
    dialogStore.cancel();
    await expect(result).resolves.toBeNull();
  });

  it("confirm resolves true on submit, false on cancel", async () => {
    const yes = dialogStore.confirm("Delete?");
    dialogStore.submit();
    await expect(yes).resolves.toBe(true);

    const no = dialogStore.confirm("Delete?");
    dialogStore.cancel();
    await expect(no).resolves.toBe(false);
  });

  it("alert resolves on submit and on cancel", async () => {
    const a = dialogStore.alert("Heads up");
    dialogStore.submit();
    await expect(a).resolves.toBeUndefined();

    const b = dialogStore.alert("Heads up");
    dialogStore.cancel();
    await expect(b).resolves.toBeUndefined();
  });

  it("queues overlapping dialogs in order", async () => {
    const first = dialogStore.prompt("First");
    const second = dialogStore.confirm("Second");
    expect(dialogStore.current?.title).toBe("First");

    dialogStore.submit("one");
    expect(dialogStore.current?.title).toBe("Second");

    dialogStore.submit();
    await expect(first).resolves.toBe("one");
    await expect(second).resolves.toBe(true);
    expect(dialogStore.current).toBeNull();
  });

  it("submit/cancel with no active dialog are safe no-ops", () => {
    dialogStore.submit("x");
    dialogStore.cancel();
    expect(dialogStore.current).toBeNull();
  });
});
