import { describe, it, expect, beforeEach } from "vitest";
import { transcriptFollow } from "./transcriptFollow.svelte";

describe("transcript follow store", () => {
  beforeEach(() => {
    transcriptFollow.sessionActive = false;
    transcriptFollow.following = true;
  });

  it("does not follow when no session is active", () => {
    expect(transcriptFollow.shouldFollow).toBe(false);
  });

  it("follows by default when a session starts", () => {
    transcriptFollow.start();
    expect(transcriptFollow.shouldFollow).toBe(true);
  });

  it("breakFollow stops tracking until resumed", () => {
    transcriptFollow.start();
    transcriptFollow.breakFollow();
    expect(transcriptFollow.shouldFollow).toBe(false);
    transcriptFollow.resume();
    expect(transcriptFollow.shouldFollow).toBe(true);
  });

  it("a new session resets a broken follow back to tracking", () => {
    transcriptFollow.start();
    transcriptFollow.breakFollow();
    transcriptFollow.end();
    transcriptFollow.start();
    expect(transcriptFollow.shouldFollow).toBe(true);
  });

  it("end() stops following regardless of tracking state", () => {
    transcriptFollow.start();
    transcriptFollow.end();
    expect(transcriptFollow.shouldFollow).toBe(false);
  });
});
