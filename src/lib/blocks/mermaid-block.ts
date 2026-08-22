import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    primaryColor: "#0d9488",
    primaryTextColor: "#e2e8f0",
    primaryBorderColor: "#2dd4bf",
    lineColor: "#5eead4",
    secondaryColor: "#1e293b",
    tertiaryColor: "#0f172a",
    fontFamily: "ui-monospace, monospace",
  },
});

let idCounter = 0;

export interface MermaidBlockData {
  code: string;
}

export class MermaidBlock {
  private data: MermaidBlockData;
  private wrapper!: HTMLElement;
  private textarea!: HTMLTextAreaElement;
  private preview!: HTMLElement;
  private errorEl!: HTMLElement;
  private renderedId: string;

  static get toolbox() {
    return {
      title: "Mermaid Diagram",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    };
  }

  constructor({ data }: { data: MermaidBlockData }) {
    this.data = {
      code: data.code || "graph TD;\n    A[Start] --> B[End]",
    };
    this.renderedId = `mermaid-${++idCounter}`;
  }

  render(): HTMLElement {
    this.wrapper = document.createElement("div");
    this.wrapper.className = "mermaid-block";

    // Textarea for code input
    this.textarea = document.createElement("textarea");
    this.textarea.className = "mermaid-textarea";
    this.textarea.value = this.data.code;
    this.textarea.placeholder = "Enter Mermaid diagram code...\n\nExamples:\n  graph TD; A-->B; B-->C\n  sequenceDiagram; Alice->>Bob: Hello\n  classDiagram; Animal <|-- Duck";
    this.textarea.style.cssText = `
      width: 100%;
      min-height: 100px;
      background: oklch(0.14 0.01 250);
      color: oklch(0.93 0 0);
      border: 1px solid oklch(0.22 0.02 250);
      border-radius: 8px;
      padding: 12px;
      font-family: ui-monospace, monospace;
      font-size: 13px;
      line-height: 1.6;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;
    `;
    this.textarea.addEventListener("input", () => {
      this.data.code = this.textarea.value;
      this.renderDiagram();
    });
    this.textarea.addEventListener("focus", () => {
      this.textarea.style.borderColor = "oklch(0.72 0.19 180)";
    });
    this.textarea.addEventListener("blur", () => {
      this.textarea.style.borderColor = "oklch(0.22 0.02 250)";
    });

    // Preview area
    this.preview = document.createElement("div");
    this.preview.className = "mermaid-preview";
    this.preview.style.cssText = `
      margin-top: 8px;
      padding: 16px;
      background: oklch(0.12 0.01 250);
      border: 1px solid oklch(0.22 0.02 250);
      border-radius: 8px;
      overflow-x: auto;
      min-height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Error element
    this.errorEl = document.createElement("div");
    this.errorEl.style.cssText = `
      color: oklch(0.65 0.2 25);
      font-size: 12px;
      font-family: ui-monospace, monospace;
      padding: 8px;
      display: none;
    `;

    this.wrapper.appendChild(this.textarea);
    this.wrapper.appendChild(this.errorEl);
    this.wrapper.appendChild(this.preview);

    // Render after mount
    setTimeout(() => this.renderDiagram(), 50);

    return this.wrapper;
  }

  private async renderDiagram(): Promise<void> {
    this.errorEl.style.display = "none";
    this.preview.innerHTML = "";

    if (!this.data.code.trim()) {
      this.preview.innerHTML =
        '<span style="color: oklch(0.6 0 0); font-size: 13px;">Enter diagram code above...</span>';
      return;
    }

    try {
      const { svg } = await mermaid.render(
        `mermaid-svg-${this.renderedId}`,
        this.data.code,
      );
      this.preview.innerHTML = svg;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid diagram syntax";
      this.errorEl.textContent = `⚠ ${message}`;
      this.errorEl.style.display = "block";
      this.preview.innerHTML =
        '<span style="color: oklch(0.6 0 0); font-size: 13px;">Diagram preview unavailable</span>';
    }
  }

  save(): MermaidBlockData {
    return this.data;
  }
}
