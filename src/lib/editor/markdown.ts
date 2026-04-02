import MarkdownIt from "markdown-it";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const TAG_RE = /(?:^|\s)(#[a-zA-Z][\w/-]*)/g;

function wikilinkPlugin(md: MarkdownIt) {
  const defaultRender =
    md.renderer.rules.text ||
    ((tokens, idx) => md.utils.escapeHtml(tokens[idx].content));

  md.renderer.rules.text = (tokens, idx, options, env, self) => {
    let text = tokens[idx].content;

    // Replace wiki links
    text = text.replace(WIKILINK_RE, (_match, target: string, alias?: string) => {
      const display = alias ?? target;
      const escaped = md.utils.escapeHtml(target);
      const escapedDisplay = md.utils.escapeHtml(display);
      return `<a class="wikilink" href="#" data-target="${escaped}">${escapedDisplay}</a>`;
    });

    // Replace tags
    text = text.replace(TAG_RE, (match, tag: string) => {
      const prefix = match.startsWith(" ") ? " " : "";
      const escaped = md.utils.escapeHtml(tag);
      return `${prefix}<span class="md-tag">${escaped}</span>`;
    });

    return text;
  };
}

function taskListPlugin(md: MarkdownIt) {
  md.renderer.rules.list_item_open = (tokens, idx) => {
    const next = tokens[idx + 2]; // inline content
    if (next?.type === "inline" && next.content) {
      if (next.content.startsWith("[ ] ")) {
        next.content = next.content.slice(4);
        return '<li class="task-item"><input type="checkbox" disabled> ';
      }
      if (next.content.startsWith("[x] ") || next.content.startsWith("[X] ")) {
        next.content = next.content.slice(4);
        return '<li class="task-item"><input type="checkbox" checked disabled> ';
      }
    }
    return "<li>";
  };
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})
  .use(wikilinkPlugin)
  .use(taskListPlugin);

export function renderMarkdown(source: string): string {
  return md.render(source);
}
