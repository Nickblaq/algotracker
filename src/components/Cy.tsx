"use client";

/**
 * Cy.tsx
 * ---------------------------------------------------------------------------
 * Single-file demo of Cytoscape.js's graph engine, styled with styled-jsx
 * (Next.js's built-in CSS-in-JS — the <style jsx> block at the bottom of the
 * return). No Tailwind, no separate stylesheet, no extra deps.
 *
 *   - 5 interchangeable layouts (cose, concentric, breadthfirst, grid, circle)
 *     with animated layout transitions
 *   - neighborhood isolation: tap a node, everything outside its 1-hop
 *     neighborhood dims, edges animate width/opacity
 *   - live search-to-highlight (substring match on label, gold outline)
 *   - drag-to-rewire: grab a node, its edges follow in real time (native)
 *   - compound/grouped nodes (parent containers) to show nesting
 *   - edge weight -> visual encoding (width)
 *   - degree -> node size encoding (computed, not hardcoded)
 *   - PNG export at 2x resolution, paper-coloured background
 *   - fit / zoom / reflow controls
 *   - stats HUD (node/edge count, density, avg degree) recomputed live
 *
 * Install:  npm i cytoscape
 * Usage:    <Cy />
 * ---------------------------------------------------------------------------
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import cytoscape, { Core, ElementDefinition, NodeSingular } from "cytoscape";

// -----------------------------------------------------------------------------
// Theme — paper / ink / clay-terracotta. Plain constants, referenced both by
// Cytoscape's own JS stylesheet (which can't read CSS vars) and by the
// styled-jsx block below (as var(--x), set from these same values).
// -----------------------------------------------------------------------------
const theme = {
  paper: "#f6f1e7",
  surface: "#fffdf8",
  surfaceSoft: "#faf5ec",
  surfaceHover: "#f3ecdf",
  line: "#e6dccb",
  lineStrong: "#d5c7b1",
  ink: "#1c1a16",
  inkSoft: "#494238",
  muted: "#8a7f6f",
  accent: "#a3432a",
  accentHover: "#8a3520",
  accentInk: "#6f2a17",
  accentRing: "rgba(163, 67, 42, 0.22)",
  teal: "#0d6e63",
  gold: "#946313",
};

// -----------------------------------------------------------------------------
// Synthetic graph generator — clustered small-world-ish graph with a few
// compound (parent) groups so compound-node rendering has something to show.
// -----------------------------------------------------------------------------
function generateGraph(): ElementDefinition[] {
  const clusters = ["core", "edge", "infra", "ml"];
  const nodes: ElementDefinition[] = [];
  const edges: ElementDefinition[] = [];

  clusters.forEach((cluster) => {
    nodes.push({ data: { id: cluster, label: cluster.toUpperCase(), isParent: true } });
  });

  let id = 0;
  const nodeIds: string[] = [];
  clusters.forEach((cluster) => {
    const count = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const nid = `n${id++}`;
      nodeIds.push(nid);
      nodes.push({ data: { id: nid, label: nid, parent: cluster, cluster } });
    }
  });

  clusters.forEach((cluster) => {
    const members = nodeIds.filter((n) => nodes.find((x) => x.data.id === n)?.data.cluster === cluster);
    members.forEach((a, i) => {
      members.slice(i + 1).forEach((b) => {
        if (Math.random() < 0.35) {
          edges.push({ data: { id: `e${a}-${b}`, source: a, target: b, weight: +(Math.random() * 5).toFixed(1) } });
        }
      });
    });
  });

  for (let i = 0; i < 10; i++) {
    const a = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    const b = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    if (a !== b) {
      edges.push({ data: { id: `bridge${i}-${a}-${b}`, source: a, target: b, weight: +(Math.random() * 3 + 2).toFixed(1) } });
    }
  }

  return [...nodes, ...edges];
}

const LAYOUTS = [
  { key: "cose", label: "Force (cose)" },
  { key: "concentric", label: "Concentric" },
  { key: "breadthfirst", label: "Hierarchy" },
  { key: "grid", label: "Grid" },
  { key: "circle", label: "Circle" },
] as const;

type LayoutKey = (typeof LAYOUTS)[number]["key"];

export default function Cy() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const [layout, setLayout] = useState<LayoutKey>("cose");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0, density: 0, avgDegree: 0 });

  const elements = useMemo(() => generateGraph(), []);

  // --- init -----------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      wheelSensitivity: 0.25,
      style: [
        {
          selector: "node",
          style: {
            "background-color": theme.accent,
            label: "data(label)",
            color: theme.surface,
            "font-size": 9,
            "text-valign": "center",
            "text-halign": "center",
            "text-outline-width": 1.5,
            "text-outline-color": theme.accentInk,
            width: "mapData(degree, 0, 10, 18, 46)",
            height: "mapData(degree, 0, 10, 18, 46)",
            "transition-property": "opacity, background-color, width, height",
            "transition-duration": 180,
          },
        },
        {
          selector: "node[?isParent]",
          style: {
            "background-color": theme.surfaceSoft,
            "background-opacity": 0.9,
            "border-width": 1,
            "border-color": theme.lineStrong,
            label: "data(label)",
            "font-size": 11,
            "font-weight": 600,
            color: theme.inkSoft,
            "text-valign": "top",
            "text-halign": "center",
            shape: "round-rectangle",
            padding: "14px",
          },
        },
        {
          selector: "edge",
          style: {
            width: "mapData(weight, 0, 8, 0.6, 5)",
            "line-color": theme.lineStrong,
            "target-arrow-color": theme.lineStrong,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.6,
            "arrow-scale": 0.6,
            "transition-property": "opacity, line-color, width",
            "transition-duration": 180,
          },
        },
        { selector: ".dimmed", style: { opacity: 0.1 } },
        {
          selector: ".highlighted",
          style: { "background-color": theme.teal, "line-color": theme.teal, "target-arrow-color": theme.teal, opacity: 1 },
        },
        { selector: ".search-match", style: { "border-width": 3, "border-color": theme.gold } },
        { selector: "node:selected", style: { "border-width": 3, "border-color": theme.teal } },
      ],
      layout: { name: "cose", animate: true, animationDuration: 500 } as any,
    });

    cy.nodes().forEach((n) => {
      n.data("degree", n.degree(false));
    });

    cy.on("tap", "node", (evt) => {
      const node = evt.target as NodeSingular;
      if (node.data("isParent")) return;
      setSelectedId(node.id());
      const neighborhood = node.closedNeighborhood();
      cy.elements().addClass("dimmed");
      neighborhood.removeClass("dimmed");
      neighborhood.edges().addClass("highlighted");
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        setSelectedId(null);
        cy.elements().removeClass("dimmed highlighted");
      }
    });

    const computeStats = () => {
      const n = cy.nodes().not("[?isParent]").length;
      const e = cy.edges().length;
      const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
      const avgDegree = n > 0 ? (2 * e) / n : 0;
      setStats({ nodes: n, edges: e, density: +density.toFixed(3), avgDegree: +avgDegree.toFixed(2) });
    };
    computeStats();

    cyRef.current = cy;
    return () => cy.destroy();
  }, [elements]);

  // --- layout switch ----------------------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const opts: Record<LayoutKey, any> = {
      cose: { name: "cose", animate: true, animationDuration: 500, nodeRepulsion: 9000 },
      concentric: { name: "concentric", animate: true, animationDuration: 500, minNodeSpacing: 20 },
      breadthfirst: { name: "breadthfirst", animate: true, animationDuration: 500, directed: true, spacingFactor: 1.1 },
      grid: { name: "grid", animate: true, animationDuration: 500 },
      circle: { name: "circle", animate: true, animationDuration: 500 },
    };
    cy.layout(opts[layout]).run();
  }, [layout]);

  // --- search -----------------------------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass("search-match");
    if (!query.trim()) return;
    const q = query.toLowerCase();
    const matches = cy.nodes().filter((n) => (n.data("label") as string)?.toLowerCase().includes(q));
    matches.addClass("search-match");
    if (matches.length) cy.animate({ fit: { eles: matches, padding: 60 } }, { duration: 400 });
  }, [query]);

  const fit = useCallback(() => {
    cyRef.current?.animate({ fit: { eles: cyRef.current.elements(), padding: 40 } }, { duration: 350 });
  }, []);
  const zoomBy = useCallback((factor: number) => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.animate({ zoom: cy.zoom() * factor, center: { eles: cy.elements() } }, { duration: 200 });
  }, []);
  const exportPng = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const uri = cy.png({ full: true, scale: 2, bg: theme.paper });
    const a = document.createElement("a");
    a.href = uri;
    a.download = "graph.png";
    a.click();
  }, []);
  const reshuffle = useCallback(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.layout({ name: layout, animate: true, animationDuration: 450 } as any).run();
  }, [layout]);

  return (
    <div className="cy-shell">
      <div className="cy-toolbar">
        <span className="cy-brand">cytoscape.js</span>

        <div className="cy-layout-group">
          {LAYOUTS.map((l) => (
            <button
              key={l.key}
              onClick={() => setLayout(l.key)}
              className={`cy-btn${layout === l.key ? " active" : ""}`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search nodes…"
          className="cy-search"
        />

        <div className="cy-controls">
          <button onClick={() => zoomBy(1.3)} className="cy-btn standalone">+</button>
          <button onClick={() => zoomBy(0.75)} className="cy-btn standalone">−</button>
          <button onClick={fit} className="cy-btn standalone">fit</button>
          <button onClick={reshuffle} className="cy-btn standalone">reflow</button>
          <button onClick={exportPng} className="cy-btn standalone">export png</button>
        </div>
      </div>

      <div className="cy-canvas-wrap">
        <div ref={containerRef} className="cy-canvas" />

        <div className="cy-hud">
          <div>nodes: <b>{stats.nodes}</b></div>
          <div>edges: <b>{stats.edges}</b></div>
          <div>density: <b>{stats.density}</b></div>
          <div>avg degree: <b>{stats.avgDegree}</b></div>
        </div>

        {selectedId && (
          <div className="cy-selection">
            selected: <b>{selectedId}</b> — neighborhood isolated, tap canvas to clear
          </div>
        )}
      </div>

      <style jsx>{`
        .cy-shell {
          width: 100%;
          height: 85vh;
          min-height: 600px;
          display: flex;
          flex-direction: column;
          background: ${theme.paper};
          color: ${theme.ink};
          border: 1px solid ${theme.line};
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(58, 43, 24, 0.12);
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        }

        .cy-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: ${theme.surface};
          border-bottom: 1px solid ${theme.line};
        }

        .cy-brand {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: ${theme.accent};
          margin-right: 8px;
        }

        .cy-layout-group {
          display: flex;
          border: 1px solid ${theme.line};
          border-radius: 6px;
          overflow: hidden;
        }

        .cy-btn {
          padding: 6px 10px;
          font-size: 12px;
          background: ${theme.surface};
          color: ${theme.inkSoft};
          border: none;
          border-right: 1px solid ${theme.line};
          cursor: pointer;
          transition: background-color 150ms ease, color 150ms ease;
        }
        .cy-layout-group .cy-btn:last-child {
          border-right: none;
        }
        .cy-btn:hover {
          background: ${theme.surfaceHover};
        }
        .cy-btn.active {
          background: ${theme.accent};
          color: ${theme.surface};
          font-weight: 500;
        }
        .cy-btn.standalone {
          border: 1px solid ${theme.line};
          border-radius: 6px;
        }

        .cy-search {
          margin-left: 4px;
          padding: 6px 10px;
          font-size: 12px;
          width: 150px;
          background: ${theme.surface};
          color: ${theme.ink};
          border: 1px solid ${theme.line};
          border-radius: 6px;
          outline: none;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }
        .cy-search::placeholder {
          color: ${theme.muted};
        }
        .cy-search:focus {
          border-color: ${theme.accent};
          box-shadow: 0 0 0 3px ${theme.accentRing};
        }

        .cy-controls {
          display: flex;
          gap: 6px;
          margin-left: auto;
        }

        .cy-canvas-wrap {
          position: relative;
          flex: 1;
          background: ${theme.surfaceSoft};
        }

        .cy-canvas {
          position: absolute;
          inset: 0;
        }

        .cy-hud {
          position: absolute;
          top: 12px;
          left: 12px;
          font-size: 11px;
          line-height: 1.7;
          background: rgba(255, 253, 248, 0.9);
          backdrop-filter: blur(4px);
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid ${theme.line};
          color: ${theme.muted};
          box-shadow: 0 1px 2px rgba(58, 43, 24, 0.06);
          pointer-events: none;
        }
        .cy-hud b {
          color: ${theme.ink};
          font-weight: 600;
        }

        .cy-selection {
          position: absolute;
          bottom: 12px;
          right: 12px;
          font-size: 11px;
          background: rgba(255, 253, 248, 0.92);
          backdrop-filter: blur(4px);
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid ${theme.line};
          color: ${theme.muted};
          box-shadow: 0 1px 2px rgba(58, 43, 24, 0.06);
        }
        .cy-selection b {
          color: ${theme.accent};
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
