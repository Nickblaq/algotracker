import katex from "katex";
import "katex/dist/katex.min.css";

export interface MathInlineBlockData {
  text: string;
}

function renderMixedContent(text: string): string {
  // Split on $...$ for inline math and $$...$$ for display math
  // First handle display math ($$...$$)
  let html = text.replace(
    /\$\$(.*?)\$\$/g,
    (_, formula: string) => {
      try {
        return katex.renderToString(formula, {
          displayMode: true,
          throwOnError: false,
          trust: true,
        });
      } catch {
        return `<span class="latex-error" title="Invalid LaTeX">${formula}</span>`;
      }
    },
  );

  // Then handle inline math ($...$) — but not escaped \$
  html = html.replace(
    /(?<!\$)\$(?!\$)(.*?)(?<!\$)\$(?!\$)/g,
    (_, formula: string) => {
      try {
        return katex.renderToString(formula, {
          displayMode: false,
          throwOnError: false,
          trust: true,
        });
      } catch {
        return `<span class="latex-error" title="Invalid LaTeX">${formula}</span>`;
      }
    },
  );

  // Convert newlines to <br>
  html = html.replace(/\n/g, "<br>");

  return html;
}

export class MathInlineBlock {
  private data: MathInlineBlockData;
  private wrapper!: HTMLElement;
  private textarea!: HTMLTextAreaElement;
  private preview!: HTMLElement;

  static get toolbox() {
    return {
      title: "Math Paragraph",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>',
    };
  }

  constructor({ data }: { data: MathInlineBlockData }) {
    this.data = {
      text: data.text || "",
    };
  }

  render(): HTMLElement {
    this.wrapper = document.createElement("div");
    this.wrapper.className = "math-inline-block";

    // Hint
    const hint = document.createElement("div");
    hint.className = "math-inline-hint";
    hint.style.cssText = `
      font-size: 11px; color: oklch(0.6 0 0); font-family: ui-monospace, monospace;
      margin-bottom: 6px; display: flex; align-items: center; gap: 6px;
    `;
    hint.innerHTML = `
      <span>MATH PARAGRAPH</span>
      <span style="opacity:0.5">·</span>
      <span style="opacity:0.5">Use <code style="background:oklch(0.18 0.02 250);padding:1px 4px;border-radius:3px;color:oklch(0.72 0.19 180)">$formula$</code> for inline math, <code style="background:oklch(0.18 0.02 250);padding:1px 4px;border-radius:3px;color:oklch(0.72 0.19 180)">$$formula$$</code> for display</span>
    `;

    // Textarea
    this.textarea = document.createElement("textarea");
    this.textarea.className = "math-inline-textarea";
    this.textarea.value = this.data.text;
    this.textarea.placeholder =
      'Type text with inline math...\n\nExample:\nThe famous equation $E = mc^2$ relates mass to energy.\n\nThe quadratic formula is:\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\nEuler\'s identity: $e^{i\\pi} + 1 = 0$';
    this.textarea.style.cssText = `
      width: 100%; min-height: 120px;
      background: oklch(0.14 0.01 250); color: oklch(0.93 0 0);
      border: 1px solid oklch(0.22 0.02 250); border-radius: 8px;
      padding: 12px; font-family: ui-monospace, monospace;
      font-size: 13px; line-height: 1.8; resize: vertical; outline: none;
      transition: border-color 0.2s;
    `;
    this.textarea.addEventListener("input", () => {
      this.data.text = this.textarea.value;
      this.updatePreview();
    });
    this.textarea.addEventListener("focus", () => {
      this.textarea.style.borderColor = "oklch(0.72 0.19 180)";
    });
    this.textarea.addEventListener("blur", () => {
      this.textarea.style.borderColor = "oklch(0.22 0.02 250)";
    });

    // Preview
    this.preview = document.createElement("div");
    this.preview.className = "math-inline-preview";
    this.preview.style.cssText = `
      margin-top: 8px; padding: 16px 20px;
      background: oklch(0.12 0.01 250);
      border: 1px solid oklch(0.22 0.02 250); border-radius: 8px;
      font-size: 15px; line-height: 1.8; color: oklch(0.93 0 0);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow-x: auto;
    `;

    // Add KaTeX color overrides inside preview
    const style = document.createElement("style");
    style.textContent = `
      .math-inline-preview .katex { color: oklch(0.93 0 0) !important; font-size: 1.1em; }
      .math-inline-preview .katex-display { margin: 12px 0; }
      .math-inline-preview .latex-error {
        color: oklch(0.65 0.2 25); background: oklch(0.65 0.2 25 / 0.1);
        padding: 1px 4px; border-radius: 3px; font-family: ui-monospace, monospace; font-size: 13px;
      }
    `;
    this.wrapper.appendChild(style);
    this.wrapper.appendChild(hint);
    this.wrapper.appendChild(this.textarea);
    this.wrapper.appendChild(this.preview);

    setTimeout(() => this.updatePreview(), 10);

    return this.wrapper;
  }

  private updatePreview(): void {
    if (!this.data.text.trim()) {
      this.preview.innerHTML =
        '<span style="color: oklch(0.6 0 0); font-size: 13px;">Preview will appear here...</span>';
      return;
    }
    this.preview.innerHTML = renderMixedContent(this.data.text);
  }

  save(): MathInlineBlockData {
    return this.data;
  }
}
