import { motion } from "framer-motion";
import {
  PenLine,
  ArrowRight,
  Layers,
  FileText,
  Sparkles,
  Code2,
  Sigma,
  GitBranch,
  CheckSquare,
  Table,
} from "lucide-react";
import { Link } from "react-router";

const features = [
  {
    icon: PenLine,
    title: "Block Editor",
    desc: "Rich block-based editing with headings, lists, tables, code blocks, quotes, and more — powered by Editor.js.",
  },
  {
    icon: GitBranch,
    title: "Mermaid Diagrams",
    desc: "Embed flowcharts, sequence diagrams, class diagrams, and Gantt charts directly in your documents with live preview.",
  },
  {
    icon: Sigma,
    title: "LaTeX Math",
    desc: "Write mathematical formulas with KaTeX — display mode and inline. From equations to integrals, rendered beautifully.",
  },
  {
    icon: Code2,
    title: "Code Blocks",
    desc: "Syntax-highlighted code blocks for any language. Perfect for technical documentation and tutorials.",
  },
  {
    icon: Layers,
    title: "Auto-Save",
    desc: "Every keystroke is automatically persisted to your browser's local IndexedDB. Never lose your work.",
  },
  {
    icon: CheckSquare,
    title: "Checklists & Tasks",
    desc: "Interactive checklists to track progress. Toggle items as you complete them.",
  },
];

const blockExamples = [
  {
    icon: Table,
    label: "Tables",
  },
  {
    icon: FileText,
    label: "Rich Text",
  },
  {
    icon: Sparkles,
    label: "Inline Format",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[oklch(0.72_0.19_180_/_0.06)] blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] rounded-full bg-[oklch(0.72_0.19_160_/_0.05)] blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-[oklch(0.8_0.15_280_/_0.04)] blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 border-b border-border/50">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/15 text-primary">
              <PenLine className="size-4" />
            </div>
            <span className="text-lg font-bold tracking-tight font-mono">
              Docflow
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/documents"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
            >
              My Docs
            </Link>
            <Link
              to="/editor"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
            >
              Start Writing
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-28 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="flex items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-mono text-primary">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              Editor.js + Mermaid + LaTeX
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight font-mono leading-tight">
            Write. Diagram.
            <br />
            <span className="text-primary">Express.</span>
          </h1>

          <p className="mt-6 max-w-xl text-muted-foreground leading-relaxed text-base">
            A modern block editor that lets you write rich documents, embed
            live Mermaid diagrams, render LaTeX math formulas, and code
            blocks — all saved automatically to your browser.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              to="/editor"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 hover:shadow-[0_0_30px_oklch(0.72_0.19_180_/_0.3)]"
            >
              <PenLine className="size-4" />
              Open Editor
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              to="/documents"
              className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/50 px-5 py-2.5 text-sm font-mono text-muted-foreground transition-all hover:text-foreground hover:border-border"
            >
              <FileText className="size-3.5" />
              View Documents
            </Link>
          </div>

          {/* Block type chips */}
          <div className="mt-10 flex flex-wrap gap-2">
            {blockExamples.map((b) => (
              <span
                key={b.label}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/30 px-3 py-1.5 text-[11px] font-mono text-muted-foreground"
              >
                <b.icon className="size-3" />
                {b.label}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-sm font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-6">
            Everything you need
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, idx) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + idx * 0.06 }}
                className="rounded-xl border border-border/40 bg-card/50 p-5 hover:border-primary/20 transition-colors"
              >
                <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary mb-3">
                  <f.icon className="size-4" />
                </div>
                <div className="text-sm font-semibold font-mono mb-1.5">
                  {f.title}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-2xl border border-border/40 bg-card/50 p-8 sm:p-12 text-center">
          <h2 className="text-xl sm:text-2xl font-bold font-mono mb-3">
            Ready to create?
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Start writing immediately — no sign-up required. Your documents are
            stored locally and ready when you are.
          </p>
          <Link
            to="/editor"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 hover:shadow-[0_0_30px_oklch(0.72_0.19_180_/_0.3)]"
          >
            <PenLine className="size-4" />
            Open Editor
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/30 py-6 text-center text-[10px] text-muted-foreground/40 font-mono">
        Docflow · Editor.js · Mermaid · KaTeX · IndexedDB
      </footer>
    </div>
  );
}
