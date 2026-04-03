<script lang="ts">
  import { onDestroy } from "svelte";
  import * as d3 from "d3";
  import type { GraphData, GraphNode, GraphEdge } from "../types";
  import { getGraphData } from "../services/tauri";
  import { vaultStore } from "../stores/vault.svelte";

  interface Props {
    onclose: () => void;
  }
  let { onclose }: Props = $props();

  let container: HTMLDivElement | undefined = $state();
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | undefined;
  let simulation: d3.Simulation<d3.SimulationNodeDatum, undefined> | undefined;
  let graphError = $state<string | null>(null);

  interface SimNode extends d3.SimulationNodeDatum {
    id: string;
    label: string;
    links: number;
  }

  interface SimLink extends d3.SimulationLinkDatum<SimNode> {
    source: SimNode | string;
    target: SimNode | string;
  }

  async function loadAndRender() {
    if (!container) return;
    graphError = null;

    let data: GraphData;
    try {
      data = await getGraphData();
    } catch (e) {
      graphError = "Failed to load graph data. The sidecar may not be running.";
      console.error("[graph] load error:", e);
      return;
    }

    if (!data.nodes.length) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous
    d3.select(container).selectAll("*").remove();

    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const links: SimLink[] = data.edges.map((e) => ({
      source: e.source,
      target: e.target,
    }));

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    // Zoom behavior
    const g = svg.append("g");
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
        }) as any
    );

    // Arrow marker
    svg.append("defs").append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "var(--text-secondary)");

    // Links
    const link = g
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "var(--text-secondary)")
      .attr("stroke-opacity", 0.3)
      .attr("stroke-width", 1);

    // Nodes
    const maxLinks = Math.max(1, ...nodes.map((n) => n.links));
    const radiusScale = d3.scaleSqrt().domain([0, maxLinks]).range([4, 16]);

    const node = g
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => radiusScale(d.links))
      .attr("fill", "var(--accent)")
      .attr("stroke", "var(--bg-primary)")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .on("click", (_event, d) => {
        vaultStore.navigateToNote(d.label);
        onclose();
      })
      .call(
        d3.drag<SVGCircleElement, SimNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation?.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation?.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Labels
    const label = g
      .append("g")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", 10)
      .attr("fill", "var(--text-primary)")
      .attr("dx", (d) => radiusScale(d.links) + 4)
      .attr("dy", 3)
      .attr("pointer-events", "none");

    // Tooltip on hover
    node.append("title").text((d) => `${d.label} (${d.links} connections)`);

    simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        "link",
        d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance(80)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => radiusScale(d.links) + 2))
      .on("tick", () => {
        link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y);

        node.attr("cx", (d) => d.x!).attr("cy", (d) => d.y!);

        label.attr("x", (d) => d.x!).attr("y", (d) => d.y!);
      });
  }

  $effect(() => {
    if (container) {
      loadAndRender();
    }
  });

  onDestroy(() => {
    simulation?.stop();
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="fixed inset-0 z-50 flex flex-col"
  style="background-color: var(--bg-primary);"
>
  <div
    class="flex h-10 items-center justify-between px-4"
    style="border-bottom: 1px solid var(--border); background-color: var(--bg-secondary);"
  >
    <span class="text-sm font-semibold" style="color: var(--accent);">Graph View</span>
    <div class="flex items-center gap-3">
      <span class="text-xs" style="color: var(--text-secondary);">
        Scroll to zoom · Drag nodes · Click to open
      </span>
      <button
        class="rounded px-2 py-0.5 text-xs"
        style="color: var(--text-secondary); border: 1px solid var(--border);"
        onclick={onclose}
      >
        Close (Esc)
      </button>
    </div>
  </div>

  <div
    bind:this={container}
    class="flex-1 overflow-hidden"
  >
    {#if graphError}
      <div class="flex h-full items-center justify-center">
        <p class="text-sm" style="color: var(--text-secondary);">{graphError}</p>
      </div>
    {/if}
  </div>
</div>
