/**
 * In-app dialog service replacing native prompt()/confirm()/alert(), which
 * WebView2 renders with the page origin as the title ("localhost:5420 says").
 * DialogHost.svelte (mounted once in App.svelte) renders the active request.
 */

export interface DialogRequest {
  kind: "prompt" | "confirm" | "alert";
  title: string;
  placeholder?: string;
  /** Initial value for prompt inputs. */
  initial?: string;
  resolve: (value: string | boolean | null) => void;
}

class DialogStore {
  current = $state<DialogRequest | null>(null);
  private queue: DialogRequest[] = [];

  /** Ask for a line of text. Resolves to the value, or null on cancel. */
  prompt(title: string, placeholder = "", initial = ""): Promise<string | null> {
    return new Promise((resolve) => {
      this.enqueue({
        kind: "prompt",
        title,
        placeholder,
        initial,
        resolve: (v) => resolve(v as string | null),
      });
    });
  }

  /** Yes/no question. Resolves true only on explicit OK. */
  confirm(title: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.enqueue({ kind: "confirm", title, resolve: (v) => resolve(v === true) });
    });
  }

  /** Informational message. Resolves when dismissed. */
  alert(title: string): Promise<void> {
    return new Promise((resolve) => {
      this.enqueue({ kind: "alert", title, resolve: () => resolve() });
    });
  }

  private enqueue(request: DialogRequest) {
    if (this.current) {
      this.queue.push(request);
    } else {
      this.current = request;
    }
  }

  /** Called by DialogHost when the user confirms (value for prompts). */
  submit(value?: string) {
    const req = this.current;
    if (!req) return;
    this.advance();
    req.resolve(req.kind === "prompt" ? (value ?? "") : true);
  }

  /** Called by DialogHost on cancel/Escape/backdrop click. */
  cancel() {
    const req = this.current;
    if (!req) return;
    this.advance();
    req.resolve(req.kind === "confirm" ? false : null);
  }

  private advance() {
    this.current = this.queue.shift() ?? null;
  }
}

export const dialogStore = new DialogStore();
