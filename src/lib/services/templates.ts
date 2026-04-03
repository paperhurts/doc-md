/**
 * Daily notes and template engine.
 */

/** Replace template variables in content. */
export function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/** Get standard template variables for the current moment. */
export function getTemplateVars(title: string): Record<string, string> {
  const now = new Date();
  return {
    date: now.toISOString().split("T")[0],
    time: now.toTimeString().split(" ")[0].slice(0, 5),
    title,
    datetime: now.toISOString().slice(0, 16).replace("T", " "),
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, "0"),
    day: String(now.getDate()).padStart(2, "0"),
  };
}

/** Get today's daily note filename. */
export function getDailyNotePath(vaultPath: string, folder = "daily"): {
  filePath: string;
  fileName: string;
  title: string;
} {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const sep = vaultPath.includes("\\") ? "\\" : "/";
  const fileName = `${dateStr}.md`;
  const filePath = `${vaultPath}${sep}${folder}${sep}${fileName}`;
  return { filePath, fileName, title: dateStr };
}

/** Default daily note template. */
export const DAILY_NOTE_TEMPLATE = `# {{date}}

## Tasks
- [ ]

## Notes

`;

/** Default new note template. */
export const NEW_NOTE_TEMPLATE = `# {{title}}

`;
