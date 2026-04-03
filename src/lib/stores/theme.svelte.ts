export interface ThemeInfo {
  id: string;
  name: string;
  description: string;
}

const THEMES: ThemeInfo[] = [
  { id: "midnight", name: "Midnight", description: "Sleek dark with near-white headings" },
  { id: "darktm", name: "Dark TM", description: "Neon cyan/magenta on dark" },
  { id: "editorial", name: "Editorial", description: "Refined light with serif typography" },
  { id: "cyberpunk", name: "Cyberpunk", description: "Neon terminal with glow effects" },
  { id: "studio", name: "Studio", description: "Warm and cozy with soft shadows" },
  { id: "allamerican", name: "All-American", description: "Red, white & blue" },
  { id: "hotdogstand", name: "Hot Dog Stand", description: "Windows 3.1 — pure chaos" },
];

const STORAGE_KEY = "doc-md-theme";

class ThemeStore {
  current = $state<string>("midnight");

  get themes(): ThemeInfo[] {
    return THEMES;
  }

  init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && THEMES.some((t) => t.id === saved)) {
      this.current = saved;
    }
    this.apply();
  }

  setTheme(id: string) {
    if (!THEMES.some((t) => t.id === id)) return;
    this.current = id;
    localStorage.setItem(STORAGE_KEY, id);
    this.apply();
  }

  private apply() {
    document.documentElement.setAttribute("data-theme", this.current);
  }
}

export const themeStore = new ThemeStore();
