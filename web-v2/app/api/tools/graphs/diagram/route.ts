import { NextResponse } from "next/server";
import { loadContextPack } from "@/lib/context-packs/loader";
import type { GraphMetadata } from "@/lib/context-packs/types";

/**
 * Derive class names from graph metadata (context packs).
 * - Dataset: when good_for includes dataset_search
 * - Entity types from queryable_by (Disease, Species, Gene, Pathogen, etc.)
 */
function deriveClasses(meta: GraphMetadata): string[] {
  const classes = new Set<string>();

  if (meta.good_for?.includes("dataset_search")) {
    classes.add("Dataset");
  }

  for (const q of meta.queryable_by || []) {
    if (q.entity_type) classes.add(q.entity_type);
  }

  return Array.from(classes).sort();
}

/**
 * Build a Mermaid flowchart from class names (classes-only for v1).
 */
function buildMermaid(meta: GraphMetadata, classes: string[]): string {
  const lines: string[] = ["flowchart TB"];

  const toId = (label: string) =>
    label.replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "") || "Node";

  if (classes.length === 0) {
    lines.push('  Schema["(No classes derived from metadata)"]');
  } else {
    for (const c of classes) {
      const id = toId(c);
      lines.push(`  ${id}["${c}"]`);
    }
  }

  return lines.join("\n");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shortname = searchParams.get("shortname");
  const packId = searchParams.get("pack_id") || "wobd";

  if (!shortname || !shortname.trim()) {
    return NextResponse.json(
      { error: "Specify a graph, e.g. @diagram nde or @diagram ubergraph" },
      { status: 400 }
    );
  }

  const trimmed = shortname.trim().toLowerCase();

  try {
    const pack = loadContextPack(packId);
    if (!pack) {
      return NextResponse.json(
        { error: `Context pack "${packId}" not found` },
        { status: 404 }
      );
    }

    const meta = pack.graphs_metadata?.find(
      (g) => g.id?.toLowerCase() === trimmed
    );

    if (!meta) {
      const available = (pack.graphs_metadata || [])
        .map((g) => g.id)
        .filter(Boolean);
      return NextResponse.json(
        {
          error: `Graph "${shortname}" not found in context pack.`,
          available_graphs: available,
        },
        { status: 404 }
      );
    }

    const classes = deriveClasses(meta);
    const mermaid = buildMermaid(meta, classes);

    return NextResponse.json({
      mermaid,
      graphShortname: meta.id,
      label: meta.description || meta.id,
      source: "context_pack",
      classes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error generating diagram:", err);
    return NextResponse.json(
      { error: `Failed to generate diagram: ${message}` },
      { status: 500 }
    );
  }
}
