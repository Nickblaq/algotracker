import { useEffect, useRef, useCallback, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import EditorJS, { type OutputData } from "@editorjs/editorjs";
import Header from "@editorjs/header";
import List from "@editorjs/list";
import Code from "@editorjs/code";
import Paragraph from "@editorjs/paragraph";
import Delimiter from "@editorjs/delimiter";
import InlineCode from "@editorjs/inline-code";
import Marker from "@editorjs/marker";
import Table from "@editorjs/table";
import Warning from "@editorjs/warning";
import Checklist from "@editorjs/checklist";
import Quote from "@editorjs/quote";
import RawTool from "@editorjs/raw";
import { MermaidBlock } from "@/lib/blocks/mermaid-block";
import { LatexBlock } from "@/lib/blocks/latex-block";
import { getDocument, updateDocument, createDocument } from "@/lib/db";
import { ArrowLeft, Save, Check } from "lucide-react";

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editorRef = useRef<EditorJS | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [title, setTitle] = useState("Untitled");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [loading, setLoading] = useState(true);
  const [docId, setDocId] = useState<number | null>(
    id ? parseInt(id, 10) : null,
  );

  const saveDocument = useCallback(
    async (data: OutputData, docTitle: string) => {
      if (!docId) return;
      setSaveStatus("saving");
      try {
        await updateDocument(docId, { title: docTitle, content: data });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Failed to save:", err);
        setSaveStatus("idle");
      }
    },
    [docId],
  );

  const debouncedSave = useCallback(
    (data: OutputData, docTitle: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveDocument(data, docTitle);
      }, 800);
    },
    [saveDocument],
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      let currentDocId = docId;
      let initialData: OutputData | undefined;

      // If no id in URL, create a new document
      if (!currentDocId) {
        const newId = await createDocument("Untitled");
        if (cancelled) return;
        currentDocId = newId;
        setDocId(newId);
        navigate(`/editor/${newId}`, { replace: true });
      } else {
        const doc = await getDocument(currentDocId);
        if (doc) {
          setTitle(doc.title);
          initialData = doc.content as OutputData;
        }
      }

      if (cancelled || !containerRef.current) return;

      // Destroy existing instance
      if (editorRef.current) {
        try {
          await editorRef.current.isReady;
          editorRef.current.destroy();
        } catch {
          // ignore
        }
      }

      const editor = new EditorJS({
        holder: containerRef.current,
        placeholder: "Start writing something amazing...",
        data: initialData,
        autofocus: true,
        tools: {
          header: {
            class: Header,
            inlineToolbar: true,
            config: {
              placeholder: "Heading",
              levels: [1, 2, 3, 4],
              defaultLevel: 2,
            },
          },
          list: {
            class: List,
            inlineToolbar: true,
          },
          code: {
            class: Code,
            shortcut: "CMD+SHIFT+K",
          },
          paragraph: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            class: Paragraph as any,
            inlineToolbar: true,
            config: {
              placeholder: "Type something...",
            },
          },
          delimiter: Delimiter,
          inlineCode: {
            class: InlineCode,
            shortcut: "CMD+SHIFT+M",
          },
          marker: {
            class: Marker,
            shortcut: "CMD+SHIFT+H",
          },
          table: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            class: Table as any,
            inlineToolbar: true,
          },
          warning: Warning,
          checklist: {
            class: Checklist,
            inlineToolbar: true,
          },
          quote: {
            class: Quote,
            inlineToolbar: true,
            config: {
              quotePlaceholder: "Quote",
              captionPlaceholder: "Author",
            },
          },
          raw: RawTool,
          mermaid: {
            class: MermaidBlock,
            inlineToolbar: false,
          },
          latex: {
            class: LatexBlock,
            inlineToolbar: false,
          },
        },
        onChange: async (api) => {
          try {
            const data = await api.saver.save();
            debouncedSave(data, title);
          } catch {
            // ignore save errors on change
          }
        },
        onReady: () => {
          setLoading(false);
        },
      });

      editorRef.current = editor;
    }

    init();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (editorRef.current) {
        try {
          editorRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save on title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (editorRef.current) {
      editorRef.current
        .save()
        .then((data) => debouncedSave(data, newTitle));
    }
  };

  const handleManualSave = async () => {
    if (editorRef.current) {
      const data = await editorRef.current.save();
      await saveDocument(data, title);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/3 w-[600px] h-[400px] rounded-full bg-[oklch(0.72_0.19_180_/_0.03)] blur-[120px]" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/documents"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              className="bg-transparent border-none outline-none text-lg font-semibold font-mono text-foreground placeholder:text-muted-foreground/50 w-64"
              placeholder="Untitled"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
              {saveStatus === "saving" && (
                <>
                  <Save className="size-3 animate-pulse" />
                  Saving...
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <Check className="size-3 text-[oklch(0.72_0.19_160)]" />
                  Saved
                </>
              )}
              {saveStatus === "idle" && (
                <span className="opacity-50">Auto-save on</span>
              )}
            </div>
            <button
              onClick={handleManualSave}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/50 px-3.5 py-1.5 text-xs font-mono text-secondary-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Save className="size-3" />
              Save
            </button>
          </div>
        </div>
      </header>

      {/* Editor */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground font-mono animate-pulse">
            Loading editor...
          </div>
        )}
        <div
          ref={containerRef}
          className="editorjs-container"
          style={{ minHeight: loading ? 0 : "60vh" }}
        />
      </main>
    </div>
  );
}
