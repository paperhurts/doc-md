import MarkdownIt from "markdown-it";
import katex from "katex";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const TAG_RE = /(?:^|\s)(#[a-zA-Z][\w/-]*)/g;

function wikilinkPlugin(md: MarkdownIt) {
  const defaultRender =
    md.renderer.rules.text ||
    ((tokens: any, idx: any) => md.utils.escapeHtml(tokens[idx].content));

  md.renderer.rules.text = (tokens, idx, options, env, self) => {
    // Escape HTML first to prevent XSS — escapeHtml only touches & < > "
    // so [ ] | # are preserved for wikilink and tag regex matching
    let text = md.utils.escapeHtml(tokens[idx].content);

    // Replace wiki links (captured groups are already escaped)
    text = text.replace(WIKILINK_RE, (_match, target: string, alias?: string) => {
      const display = alias ?? target;
      return `<a class="wikilink" href="#" data-target="${target}">${display}</a>`;
    });

    // Replace tags (captured groups are already escaped)
    text = text.replace(TAG_RE, (match, tag: string) => {
      const prefix = match.startsWith(" ") ? " " : "";
      return `${prefix}<span class="md-tag">${tag}</span>`;
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

/** KaTeX math rendering: $inline$ and $$block$$ */
function mathPlugin(md: MarkdownIt) {
  // Block math: $$...$$
  md.renderer.rules.math_block = (tokens, idx) => {
    try {
      return `<div class="math-block">${katex.renderToString(tokens[idx].content, { displayMode: true, throwOnError: false })}</div>`;
    } catch {
      return `<div class="math-block math-error">${md.utils.escapeHtml(tokens[idx].content)}</div>`;
    }
  };

  // Inline math: $...$
  md.renderer.rules.math_inline = (tokens, idx) => {
    try {
      return katex.renderToString(tokens[idx].content, { displayMode: false, throwOnError: false });
    } catch {
      return `<code class="math-error">${md.utils.escapeHtml(tokens[idx].content)}</code>`;
    }
  };

  // Block math rule: $$ on its own line
  md.block.ruler.after("fence", "math_block", (state, startLine, endLine, silent) => {
    const startPos = state.bMarks[startLine] + state.tShift[startLine];
    const startMax = state.eMarks[startLine];
    if (startPos + 2 > startMax) return false;
    if (state.src.slice(startPos, startPos + 2) !== "$$") return false;
    if (silent) return true;

    let nextLine = startLine;
    let found = false;
    while (++nextLine < endLine) {
      const pos = state.bMarks[nextLine] + state.tShift[nextLine];
      const max = state.eMarks[nextLine];
      if (state.src.slice(pos, pos + 2) === "$$" && pos + 2 >= max) {
        found = true;
        break;
      }
    }
    if (!found) return false;

    state.line = nextLine + 1;
    const token = state.push("math_block", "math", 0);
    token.block = true;
    token.content = state.src
      .slice(state.bMarks[startLine] + 2, state.bMarks[nextLine])
      .trim();
    token.map = [startLine, state.line];
    return true;
  });

  // Inline math rule: $...$
  md.inline.ruler.after("escape", "math_inline", (state, silent) => {
    if (state.src[state.pos] !== "$") return false;
    if (state.src[state.pos + 1] === "$") return false; // skip block $$

    const start = state.pos + 1;
    let end = start;
    while (end < state.posMax && state.src[end] !== "$") end++;
    if (end >= state.posMax) return false;
    if (end === start) return false; // empty $$

    if (!silent) {
      const token = state.push("math_inline", "math", 0);
      token.content = state.src.slice(start, end);
    }
    state.pos = end + 1;
    return true;
  });
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
})
  .use(wikilinkPlugin)
  .use(taskListPlugin)
  .use(mathPlugin);

export function renderMarkdown(source: string): string {
  return md.render(source);
}
