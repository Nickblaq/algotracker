import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  FileText,
  Trash2,
  ArrowLeft,
  Clock,
  LayoutGrid,
} from "lucide-react";
import {
  getAllDocuments,
  createDocument,
  deleteDocument,
  type Document,
} from "@/lib/db";

function formatDate(d: Date): string {
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export default function Documents() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDocs = useCallback(async () => {
    const all = await getAllDocuments();
    setDocs(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleNew = async () => {
    const id = await createDocument("Untitled");
    navigate(`/editor/${id}`);
  };

  const handleDelete = async (id: number) => {
    await deleteDocument(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] rounded-full bg-[oklch(0.72_0.19_180_/_0.04)] blur-[120px]" />
        <div className="absolute bottom-0 right-1/3 w-[400px] h-[300px] rounded-full bg-[oklch(0.72_0.19_160_/_0.03)] blur-[100px]" />
      </div>

      {/* Header */}
      <header className="border-b border-border/40">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center size-8 rounded-lg bg-primary/15 text-primary">
                <LayoutGrid className="size-4" />
              </div>
              <h1 className="text-lg font-bold tracking-tight font-mono">
                Documents
              </h1>
            </div>
          </div>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 hover:shadow-[0_0_25px_oklch(0.72_0.19_180_/_0.2)]"
          >
            <Plus className="size-4" />
            New Document
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground font-mono animate-pulse">
            Loading documents...
          </div>
        ) : docs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24"
          >
            <div className="size-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-6">
              <FileText className="size-8 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold font-mono mb-2">
              No documents yet
            </h2>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              Create your first document to get started. Everything is saved
              locally in your browser.
            </p>
            <button
              onClick={handleNew}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
            >
              <Plus className="size-4" />
              Create Document
            </button>
          </motion.div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {docs.map((doc, idx) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Link
                    to={`/editor/${doc.id}`}
                    className="group block rounded-xl border border-border/40 bg-card/50 p-5 transition-all hover:border-primary/30 hover:bg-card/80 hover:shadow-[0_0_30px_oklch(0.72_0.19_180_/_0.06)]"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                        <FileText className="size-4" />
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (doc.id) handleDelete(doc.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <h3 className="font-semibold font-mono text-sm mb-2 truncate">
                      {doc.title || "Untitled"}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                      <Clock className="size-3" />
                      {formatDate(doc.updatedAt)}
                    </div>
                    {doc.id && (
                      <div className="mt-2 text-[10px] text-muted-foreground/40 font-mono">
                        Created {formatDate(doc.createdAt)}
                      </div>
                    )}
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <footer className="border-t border-border/30 py-6 text-center text-[10px] font-mono text-muted-foreground/40">
        {docs.length} document{docs.length !== 1 ? "s" : ""} · stored locally
      </footer>
    </div>
  );
}
