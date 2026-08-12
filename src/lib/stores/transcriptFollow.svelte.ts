/**
 * Follow-mode state for transcription sessions (issue #59): while a session
 * is active the editor auto-scrolls with transcript appends ("following");
 * a manual scroll away from the bottom breaks it, and the "Scroll to end"
 * button in TranscriptionBar resumes it. TranscriptionBar owns the session
 * lifecycle; Editor reads the flags and reports scroll breaks.
 */
class TranscriptFollowStore {
  /** A transcription session is running for the visible note. */
  sessionActive = $state(false);
  /** Auto-scroll on transcript appends (only meaningful while sessionActive). */
  following = $state(true);

  start() {
    this.sessionActive = true;
    this.following = true;
  }

  end() {
    this.sessionActive = false;
  }

  breakFollow() {
    this.following = false;
  }

  resume() {
    this.following = true;
  }

  get shouldFollow(): boolean {
    return this.sessionActive && this.following;
  }
}

export const transcriptFollow = new TranscriptFollowStore();
