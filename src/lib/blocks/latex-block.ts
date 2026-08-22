import katex from "katex";
import "katex/dist/katex.min.css";

export interface LatexBlockData {
  formula: string;
  displayMode: boolean;
}

export class LatexBlock {
  private data: LatexBlockData;
  private wrapper!: HTMLElement;
  private textarea!: HTMLTextAreaElement;
  private preview!: HTMLElement;
  private errorEl!: HTMLElement;

  static get toolbox() {
    return {
      title: "LaTeX Math",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6v6H4z"/><path d="M14 4h6v6h-6z"/><path d="M4 14h6v6H4z"/><path d="M17 14v7"/><path d="M14 17h6"/></svg>',
    };
  }

  constructor({ data }: { data: LatexBlockData }) {
    this.data = {
      formula: data.formula || "",
      displayMode: data.displayMode ?? true,
    };
  }

  render(): HTMLElement {
    this.wrapper = document.createElement("div");
    this.wrapper.className = "latex-block";

    // Header with toggle
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
    `;

    const label = document.createElement("span");
    label.style.cssText = `
      font-size: 11px; color: oklch(0.6 0 0); font-family: ui-monospace, monospace;
      text-transform: uppercase; letter-spacing: 0.05em;
    `;
    label.textContent = "LaTeX Formula";

    const toggle = document.createElement("button");
    toggle.className = "latex-toggle";
    toggle.style.cssText = `
      margin-left: auto; font-size: 11px; padding: 2px 8px;
      border-radius: 4px; border: 1px solid oklch(0.22 0.02 250);
      background: oklch(0.14 0.01 250); color: oklch(0.93 0 0);
      cursor: pointer; font-family: ui-monospace, monospace;
    `;
    toggle.textContent = this.data.displayMode ? "Display" : "Inline";
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      this.data.displayMode = !this.data.displayMode;
      toggle.textContent = this.data.displayMode ? "Display" : "Inline";
      this.renderFormula();
    });

    header.appendChild(label);
    header.appendChild(toggle);

    // Textarea
    this.textarea = document.createElement("textarea");
    this.textarea.className = "latex-textarea";
    this.textarea.value = this.data.formula;
    this.textarea.placeholder =
      "Enter LaTeX formula...\n\nExamples:\n  E = mc^2\n  \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n  \\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}\n  \\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}";
    this.textarea.style.cssText = `
      width: 100%; min-height: 80px;
      background: oklch(0.14 0.01 250); color: oklch(0.93 0 0);
      border: 1px solid oklch(0.22 0.02 250); border-radius: 8px;
      padding: 12px; font-family: ui-monospace, monospace;
      font-size: 13px; line-height: 1.6; resize: vertical; outline: none;
      transition: border-color 0.2s;
    `;
    this.textarea.addEventListener("input", () => {
      this.data.formula = this.textarea.value;
      this.renderFormula();
    });
    this.textarea.addEventListener("focus", () => {
      this.textarea.style.borderColor = "oklch(0.72 0.19 180)";
    });
    this.textarea.addEventListener("blur", () => {
      this.textarea.style.borderColor = "oklch(0.22 0.02 250)";
    });

    // Preview area
    this.preview = document.createElement("div");
    this.preview.className = "latex-preview";
    this.preview.style.cssText = `
      margin-top: 8px; padding: 20px;
      background: oklch(0.12 0.01 250);
      border: 1px solid oklch(0.22 0.02 250); border-radius: 8px;
      overflow-x: auto; min-height: 50px;
      display: flex; align-items: center; justify-content: center;
    `;

    // Error element
    this.errorEl = document.createElement("div");
    this.errorEl.style.cssText = `
      color: oklch(0.65 0.2 25); font-size: 12px;
      font-family: ui-monospace, monospace; padding: 8px; display: none;
    `;

    this.wrapper.appendChild(header);
    this.wrapper.appendChild(this.textarea);
    this.wrapper.appendChild(this.errorEl);
    this.wrapper.appendChild(this.preview);

    setTimeout(() => this.renderFormula(), 10);

    return this.wrapper;
  }

  private renderFormula(): void {
    this.errorEl.style.display = "none";

    if (!this.data.formula.trim()) {
      this.preview.innerHTML =
        '<span style="color: oklch(0.6 0 0); font-size: 13px;">Enter a formula above...</span>';
      return;
    }

    try {
      const html = katex.renderToString(this.data.formula, {
        displayMode: this.data.displayMode,
        throwOnError: true,
        trust: true,
      });
      this.preview.innerHTML = html;
      this.preview.querySelectorAll(".katex").forEach((el) => {
        (el as HTMLElement).style.color = "oklch(0.93 0 0)";
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid LaTeX syntax";
      this.errorEl.textContent = `⚠ ${message}`;
      this.errorEl.style.display = "block";
      this.preview.innerHTML =
        '<span style="color: oklch(0.6 0 0); font-size: 13px;">Formula preview unavailable</span>';
    }
  }

  save(): LatexBlockData {
    return this.data;
  }
}
