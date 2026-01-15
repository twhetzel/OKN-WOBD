import { NextResponse } from "next/server";
import { getGraphSuggestions, getQuickSuggestions } from "@/lib/registry/suggestions";
import { fetchGraphsFromRegistry, getGraphByShortname } from "@/lib/registry/fetch";

/**
 * GET /api/tools/registry/graphs/suggestions?graphs=nde,ubergraph
 * Get query/topic suggestions for one or more graphs
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const graphsParam = searchParams.get("graphs");
    const quick = searchParams.get("quick") === "true";

    try {
        if (!graphsParam) {
            // If no graphs specified, get suggestions for all graphs
            const allGraphs = await fetchGraphsFromRegistry();

            const packId = searchParams.get("pack_id") || "wobd";

            if (quick) {
                const suggestions = getQuickSuggestions(allGraphs, packId);
                return NextResponse.json({
                    suggestions,
                    total: suggestions.length,
                    graphs: allGraphs.map(g => g.shortname),
                });
            } else {
                // Full content exploration for all graphs (queries actual graph content)
                const graphShortnames = allGraphs.map(g => g.shortname);
                const suggestions = await getGraphSuggestions(graphShortnames, packId);
                return NextResponse.json({
                    suggestions,
                    total: suggestions.length,
                    graphs: graphShortnames,
                });
            }
        }

        // Parse graph shortnames
        const graphShortnames = graphsParam.split(",").map(s => s.trim()).filter(Boolean);

        if (graphShortnames.length === 0) {
            return NextResponse.json(
                { error: "No graphs specified" },
                { status: 400 }
            );
        }

        // Verify graphs exist
        const graphs = [];
        for (const shortname of graphShortnames) {
            const graph = await getGraphByShortname(shortname);
            if (!graph) {
                return NextResponse.json(
                    { error: `Graph "${shortname}" not found` },
                    { status: 404 }
                );
            }
            graphs.push(graph);
        }

        const packId = searchParams.get("pack_id") || "wobd";

        if (quick) {
            const suggestions = getQuickSuggestions(graphs, packId);
            return NextResponse.json({
                suggestions,
                total: suggestions.length,
                graphs: graphShortnames,
            });
        } else {
            // Full content exploration - queries actual graph content
            const suggestions = await getGraphSuggestions(graphShortnames, packId);
            return NextResponse.json({
                suggestions,
                total: suggestions.length,
                graphs: graphShortnames,
            });
        }
    } catch (error: any) {
        console.error("Error getting graph suggestions:", error);
        return NextResponse.json(
            { error: error.message || "Failed to get suggestions" },
            { status: 500 }
        );
    }
}

