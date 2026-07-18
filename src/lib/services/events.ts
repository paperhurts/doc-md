/**
 * Event listening that works both inside Tauri (real IPC events) and in
 * browser/test mode (mock event bus).
 */
import { isTauri } from "./env";
import { listenMock } from "./mock";

export type Unlisten = () => void;

export async function listenEvent<T>(
  name: string,
  cb: (payload: T) => void,
): Promise<Unlisten> {
  if (isTauri()) {
    const { listen } = await import("@tauri-apps/api/event");
    return await listen<T>(name, (event) => cb(event.payload));
  }
  return listenMock(name, (payload) => cb(payload as T));
}
