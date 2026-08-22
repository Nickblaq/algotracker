declare module "@editorjs/marker" {
  import { InlineTool, InlineToolConstructorOptions } from "@editorjs/editorjs";
  export default class Marker implements InlineTool {
    constructor(options: InlineToolConstructorOptions);
    static get isInline(): boolean;
    static get sanitize(): Record<string, boolean>;
    static get shortcut(): string;
    render(): HTMLElement;
    surround(range: Range): void;
    checkState(selection: Selection): boolean;
  }
}

declare module "@editorjs/checklist" {
  import {
    BlockTool,
    BlockToolConstructorOptions,
  } from "@editorjs/editorjs";
  export default class Checklist implements BlockTool {
    constructor(options: BlockToolConstructorOptions);
    static get toolbox(): { title: string; icon: string };
    render(): HTMLElement;
    save(block: HTMLElement): { items: Array<{ text: string; checked: boolean }> };
  }
}

declare module "@editorjs/raw" {
  import {
    BlockTool,
    BlockToolConstructorOptions,
  } from "@editorjs/editorjs";
  export default class RawTool implements BlockTool {
    constructor(options: BlockToolConstructorOptions);
    static get toolbox(): { title: string; icon: string };
    render(): HTMLElement;
    save(block: HTMLElement): { html: string };
  }
}

declare module "@editorjs/delimiter" {
  import {
    BlockTool,
    BlockToolConstructorOptions,
  } from "@editorjs/editorjs";
  export default class Delimiter implements BlockTool {
    constructor(options: BlockToolConstructorOptions);
    render(): HTMLElement;
    save(): Record<string, never>;
  }
}

declare module "@editorjs/inline-code" {
  import { InlineTool, InlineToolConstructorOptions } from "@editorjs/editorjs";
  export default class InlineCode implements InlineTool {
    constructor(options: InlineToolConstructorOptions);
    static get isInline(): boolean;
    static get sanitize(): Record<string, boolean>;
    static get shortcut(): string;
    render(): HTMLElement;
    surround(range: Range): void;
    checkState(selection: Selection): boolean;
  }
}
