import katex from "katex";
import mermaid from "mermaid";

let notebookMermaidId = 0;

export interface NotebookBlockData {
  content: string;
}

// ─── Inline rendering helpers ───────────────────────────────────────────────

function renderInlineMath(text: string): string {
  // Display math first: $$...$$
  let out = text.replace(/\$\$(.*?)\$\$/g, (_, formula: string) => {
    try {
      return katex.renderToString(formula, {
        displayMode: true,
        throwOnError: false,
        trust: true,
      });
    } catch {
      return `<span class="nb-error">${escapeHtml(formula)}</span>`;
    }
  });
  // Inline math: $...$  (not preceded/followed by $)
  out = out.replace(/(?<!\$)\$(?!\$)(.*?)(?<!\$)\$(?!\$)/g, (_, formula: string) => {
    try {
      return katex.renderToString(formula, {
        displayMode: false,
        throwOnError: false,
        trust: true,
      });
    } catch {
      return `<span class="nb-error">${escapeHtml(formula)}</span>`;
    }
  });
  return out;
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  // Bold: **text**
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic: *text*
  out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  // Strikethrough: ~~text~~
  out = out.replace(/~~(.+?)~~/g, "<del>$1</del>");
  // Inline code: `code`
  out = out.replace(/`([^`]+)`/g, '<code class="nb-inline-code">$1</code>');
  // Math (after HTML escaping so LaTeX symbols survive)
  out = renderInlineMath(out);
  return out;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Block-level parsing ────────────────────────────────────────────────────

interface ParsedBlock {
  type: string;
  html: string;
  raw: string;
  lang?: string;
}

function parseBlocks(source: string): ParsedBlock[] {
  const lines = source.split("\n");
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ```lang ... ``` or ~~~~lang ... ~~~~
    const backtickFence = line.trimStart().startsWith("```");
    const tildeFence = line.trimStart().startsWith("~~~~");
    if (backtickFence || tildeFence) {
      const fenceChar = backtickFence ? "`" : "~";
      const fenceLen = backtickFence ? 3 : 4;
      const lang = line.trimStart().slice(fenceLen).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(fenceChar.repeat(fenceLen))) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const code = codeLines.join("\n");
      blocks.push({
        type: "code",
        lang: lang || undefined,
        raw: code,
        html: renderCodeBlock(code, lang),
      });
      continue;
    }

    // Heading: # through ######
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push({
        type: "heading",
        raw: headingMatch[2],
        html: `<h${level} class="nb-heading nb-h${level}">${renderInline(headingMatch[2])}</h${level}>`,
      });
      i++;
      continue;
    }

    // Horizontal rule: --- or *** or ___
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ type: "hr", raw: line, html: '<hr class="nb-hr" />' });
      i++;
      continue;
    }

    // Blockquote (possibly admonition): > text
    if (line.trimStart().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const content = quoteLines.join("\n");

      // Check for admonition: > [!TYPE]
      const admonitionMatch = content.match(/^\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\s*\n?([\s\S]*)/i);
      if (admonitionMatch) {
        const type = admonitionMatch[1].toLowerCase();
        const body = admonitionMatch[2];
        blocks.push({
          type: "admonition",
          raw: content,
          html: renderAdmonition(type, body),
        });
      } else {
        blocks.push({
          type: "blockquote",
          raw: content,
          html: `<blockquote class="nb-blockquote">${renderInline(content)}</blockquote>`,
        });
      }
      continue;
    }

    // Unordered list: - item or * item
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      const lis = items.map((item) => `<li>${renderInline(item)}</li>`).join("");
      blocks.push({
        type: "ul",
        raw: items.join("\n"),
        html: `<ul class="nb-list">${lis}</ul>`,
      });
      continue;
    }

    // Ordered list: 1. item
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      const lis = items.map((item) => `<li>${renderInline(item)}</li>`).join("");
      blocks.push({
        type: "ol",
        raw: items.join("\n"),
        html: `<ol class="nb-list">${lis}</ol>`,
      });
      continue;
    }

    // Checklist: - [ ] or - [x]
    if (/^\s*-\s*\[[ x]\]\s+/i.test(line)) {
      const items: string[] = [];
      const checked: boolean[] = [];
      while (i < lines.length && /^\s*-\s*\[[ x]\]\s+/i.test(lines[i])) {
        const m = lines[i].match(/^\s*-\s*\[([ x])\]\s+(.*)/i);
        if (m) {
          checked.push(m[1].toLowerCase() === "x");
          items.push(m[2]);
        }
        i++;
      }
      const lis = items
        .map(
          (item, idx) =>
            `<li class="nb-checklist-item"><span class="nb-checkbox${checked[idx] ? " checked" : ""}"></span>${renderInline(item)}</li>`,
        )
        .join("");
      blocks.push({
        type: "checklist",
        raw: items.join("\n"),
        html: `<ul class="nb-checklist">${lis}</ul>`,
      });
      continue;
    }

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Default: paragraph (collect consecutive non-empty, non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trimStart().startsWith("#") &&
      !lines[i].trimStart().startsWith("```") &&
      !lines[i].trimStart().startsWith(">") &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*[-*]\s*\[[ x]\]/i.test(lines[i]) &&
      !/^(\*{3,}|-{3,}|_{3,})\s*$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({
        type: "paragraph",
        raw: paraLines.join("\n"),
        html: `<p class="nb-paragraph">${renderInline(paraLines.join("<br>"))}</p>`,
      });
    }
  }

  return blocks;
}

function renderCodeBlock(code: string, lang: string): string {
  const escaped = escapeHtml(code);
  const langClass = lang ? ` language-${lang}` : "";

  if (lang === "mermaid") {
    const id = `nb-mermaid-${++notebookMermaidId}`;
    return `<div class="nb-mermaid-container" data-mermaid-id="${id}" data-mermaid-code="${escapeHtml(code).replace(/"/g, "&quot;")}"><div class="nb-mermaid-placeholder">Rendering diagram...</div></div>`;
  }

  return `<pre class="nb-code-block"><code class="nb-code${langClass}">${escaped}</code>${lang ? `<span class="nb-code-lang">${escapeHtml(lang)}</span>` : ""}</pre>`;
}

function renderAdmonition(type: string, body: string): string {
  const icons: Record<string, string> = {
    note: "📝",
    tip: "💡",
    warning: "⚠️",
    caution: "🚫",
    important: "❗",
  };
  return `<div class="nb-admonition nb-admonition-${type}"><div class="nb-admonition-header"><span class="nb-admonition-icon">${icons[type] || "📝"}</span><span class="nb-admonition-type">${type.toUpperCase()}</span></div><div class="nb-admonition-body">${renderInline(body.trim())}</div></div>`;
}

// ─── Main block class ───────────────────────────────────────────────────────

export class NotebookBlock {
  private data: NotebookBlockData;
  private wrapper!: HTMLElement;
  private textarea!: HTMLTextAreaElement;
  private preview!: HTMLElement;
  private renderedBlocks: HTMLElement[] = [];

  static get toolbox() {
    return {
      title: "Smart Notebook",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>',
    };
  }

  constructor({ data }: { data: NotebookBlockData }) {
    this.data = {
      content: data.content || "",
    };
  }

  render(): HTMLElement {
    this.wrapper = document.createElement("div");
    this.wrapper.className = "notebook-block";

    // Hint bar
    const hint = document.createElement("div");
    hint.className = "nb-hint";
    hint.innerHTML = `
      <span class="nb-hint-title">SMART NOTEBOOK</span>
      <span class="nb-hint-sep">·</span>
      <span class="nb-hint-syntax"><code>#</code> heading <code>**bold**</code> <code>*italic*</code> <code>$math$</code> <code>\`\`\`lang</code> code <code>---</code> hr <code>&gt;</code> quote <code>- </code> list</span>
    `;

    // Textarea
    this.textarea = document.createElement("textarea");
    this.textarea.className = "nb-textarea";
    this.textarea.value = this.data.content;
    this.textarea.placeholder = [
      "# Smart Notebook",
      "",
      "Write rich content with simple syntax:",
      "",
      "## Headings",
      "Use # for H1, ## for H2, ### for H3, etc.",
      "",
      "## Math",
      "Inline math: $E = mc^2$ flows with text.",
      "Display math gets its own line:",
      "$$\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}$$",
      "",
      "## Code",
      "Inline: \`console.log('hello')\`",
      "Fenced blocks with language highlighting:",
      "```python",
      "def fib(n): return n if n < 2 else fib(n-1) + fib(n-2)",
      "```",
      "",
      "## Diagrams",
      "```mermaid",
      "graph TD; A[Start] --> B[Process] --> C[End]",
      "```",
      "",
      "## Formatting",
      "**Bold text** and *italic text* and ~~strikethrough~~",
      "",
      "- Unordered list item",
      "1. Ordered list item",
      "- [ ] Checkbox item",
      "",
      "> Blockquote text",
      "> [!TIP] This is a helpful tip",
      "",
      "---",
    ].join("\n");
    this.textarea.addEventListener("input", () => {
      this.data.content = this.textarea.value;
      this.renderPreview();
    });
    this.textarea.addEventListener("focus", () => {
      this.textarea.style.borderColor = "oklch(0.72 0.19 180)";
    });
    this.textarea.addEventListener("blur", () => {
      this.textarea.style.borderColor = "oklch(0.22 0.02 250)";
    });
    // Tab key inserts spaces instead of moving focus
    this.textarea.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        this.textarea.value =
          this.textarea.value.substring(0, start) +
          "  " +
          this.textarea.value.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
        this.data.content = this.textarea.value;
        this.renderPreview();
      }
    });

    // Preview
    this.preview = document.createElement("div");
    this.preview.className = "nb-preview";

    this.wrapper.appendChild(hint);
    this.wrapper.appendChild(this.textarea);
    this.wrapper.appendChild(this.preview);

    setTimeout(() => this.renderPreview(), 10);

    return this.wrapper;
  }

  private renderPreview(): void {
    if (!this.data.content.trim()) {
      this.preview.innerHTML =
        '<span class="nb-empty">Preview will appear here as you type...</span>';
      return;
    }

    // Clear previous mermaid instances
    this.renderedBlocks.forEach((el) => {
      const mermaidEls = el.querySelectorAll(".nb-mermaid-container svg");
      mermaidEls.forEach((svg) => svg.remove());
    });

    const blocks = parseBlocks(this.data.content);
    this.preview.innerHTML = blocks.map((b) => b.html).join("\n");
    this.renderedBlocks = Array.from(this.preview.children) as HTMLElement[];

    // Render mermaid diagrams
    const mermaidContainers = this.preview.querySelectorAll(".nb-mermaid-container");
    mermaidContainers.forEach(async (container) => {
      const el = container as HTMLElement;
      const code = el.getAttribute("data-mermaid-code") || "";
      const id = el.getAttribute("data-mermaid-id") || `nb-mermaid-${Date.now()}`;
      try {
        const { svg } = await mermaid.render(id, code);
        el.innerHTML = svg;
      } catch {
        el.innerHTML = `<div class="nb-error">Failed to render diagram</div>`;
      }
    });
  }

  save(): NotebookBlockData {
    return this.data;
  }
}
