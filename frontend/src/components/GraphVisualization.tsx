import React, { useState, useRef, useEffect } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { Wallet, Transaction } from "../types";

interface GraphVisualizationProps {
  nodes: Wallet[];
  edges: Transaction[];
  focusPattern?: {
    type:
      | "fan-in"
      | "fan-out"
      | "high-volume"
      | "circular"
      | "layering"
      | "structuring"
      | "pass-through"
      | "peel-chain"
      | "mixer";
    walletHash: string;
    wallets?: string[];
    transactions?: Array<{
      hash: string;
      from: string;
      to: string;
      amount: number;
      timestamp: string;
    }>;
    startTime?: string;
    endTime?: string;
  } | null;
  onWalletSelect?: (
    wallet: {
      id: string;
      hash: string;
      riskScore: number;
      transactionCount: number;
      inflow: number;
      outflow: number;
      role?: string;
    } | null,
  ) => void;
}

const GraphVisualization: React.FC<GraphVisualizationProps> = ({
  nodes,
  edges,
  focusPattern = null,
  onWalletSelect,
}) => {
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [filteredData, setFilteredData] = useState<{
    nodes: any[];
    links: any[];
  }>({ nodes: [], links: [] });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({
    width: typeof window !== "undefined" ? window.innerWidth * 0.7 : 800,
    height: typeof window !== "undefined" ? window.innerHeight * 0.8 : 600,
  });
  const [primaryNodeId, setPrimaryNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (focusPattern) {
      setSelectedNodeId(null);
      setHoveredNodeId(null);
      onWalletSelect?.(null);
    }
  }, [focusPattern, onWalletSelect]);

  // Normalize risk score to 0-1
  const normalizeRisk = (score: number) => Math.min(score / 100, 1);

  // Get color based on risk with strong hierarchy
  const getRiskColor = (normalizedScore: number) => {
    if (normalizedScore >= 0.7) return "#ef4444"; // Red for high risk
    if (normalizedScore >= 0.4) return "#f59e0b"; // Yellow for medium
    return "#22c55e"; // Green for low risk
  };

  // Measure container dimensions
  useEffect(() => {
    const measureContainer = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({
            width: rect.width,
            height: rect.height,
          });
        }
      }
    };

    measureContainer();
    const timeout = setTimeout(measureContainer, 100);
    const resizeObserver = new ResizeObserver(measureContainer);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeout);
      resizeObserver.disconnect();
    };
  }, []);

  // Build graph with PROGRESSIVE DISCLOSURE
  useEffect(() => {
    const normalizedNodes = nodes.map((w) => ({
      id: w.id,
      hash: w.hash,
      risk: normalizeRisk(w.riskScore),
      riskScore: w.riskScore,
      inflow: w.inflow,
      outflow: w.outflow,
      transactionCount: w.transactionCount,
      color: getRiskColor(normalizeRisk(w.riskScore)),
    }));

    // Calculate node roles (source, sink, intermediary)
    const nodeRoles = new Map<
      string,
      { inDegree: number; outDegree: number; role: string }
    >();
    edges.forEach((edge) => {
      const fromNode = normalizedNodes.find((n) => n.hash === edge.from_wallet);
      const toNode = normalizedNodes.find((n) => n.hash === edge.to_wallet);

      if (fromNode && toNode) {
        const fromRole = nodeRoles.get(fromNode.id) || {
          inDegree: 0,
          outDegree: 0,
          role: "normal",
        };
        const toRole = nodeRoles.get(toNode.id) || {
          inDegree: 0,
          outDegree: 0,
          role: "normal",
        };

        fromRole.outDegree++;
        toRole.inDegree++;

        nodeRoles.set(fromNode.id, fromRole);
        nodeRoles.set(toNode.id, toRole);
      }
    });

    // Assign roles and sizes
    nodeRoles.forEach((role) => {
      if (role.inDegree >= 20 && role.outDegree === 0) {
        role.role = "sink"; // Major aggregation point
      } else if (role.outDegree >= 4 && role.inDegree === 0) {
        role.role = "source"; // Distribution point
      } else if (role.inDegree >= 2 && role.outDegree >= 2) {
        role.role = "mule"; // Intermediary
      }
    });

    // Add role and size to nodes
    const enrichedNodes = normalizedNodes.map((n) => {
      const role = nodeRoles.get(n.id);
      let size = 6 + n.risk * 18; // Base size

      if (role?.role === "source") size *= 1.3; // Larger for sources
      if (role?.role === "sink") size *= 1.2; // Slightly larger for sinks
      if (role?.role === "mule") size *= 0.9; // Smaller for mules

      return {
        ...n,
        size,
        role: role?.role || "normal",
        inDegree: role?.inDegree || 0,
        outDegree: role?.outDegree || 0,
      };
    });

    // STEP 1: Find high-risk nodes (suspicionScore ≥ 0.7) - limit to top 4 for cleaner view
    const topHighRiskNodes = enrichedNodes
      .filter((n) => n.risk >= 0.7)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 4);

    const highRiskNodeIds = new Set(topHighRiskNodes.map((n) => n.id));

    // Remove medium-risk nodes entirely - too cluttered

    // STEP 2: Build visible set - strict single-pattern isolation
    let visibleNodeIds = new Set<string>();
    let coreNodeIds = new Set<string>();

    const focusWallet = focusPattern
      ? normalizedNodes.find((n) => n.hash === focusPattern.walletHash)
      : null;

    if (focusPattern && focusWallet) {
      setPrimaryNodeId(focusWallet.id);
      // SINGLE-CASE MODE: Render ONLY this pattern
      visibleNodeIds.add(focusWallet.id);
      coreNodeIds.add(focusWallet.id);

      const relatedIds = new Set<string>();
      const timestamps: string[] = [];

      edges.forEach((edge) => {
        const fromNode = normalizedNodes.find(
          (n) => n.hash === edge.from_wallet,
        );
        const toNode = normalizedNodes.find((n) => n.hash === edge.to_wallet);

        if (!fromNode || !toNode) return;

        // Handle different pattern types
        switch (focusPattern.type) {
          case "fan-in":
            // Incoming edges to focus wallet
            if (toNode.id === focusWallet.id) {
              relatedIds.add(fromNode.id);
              if (edge.timestamp) timestamps.push(edge.timestamp);
            }
            break;
          case "fan-out":
          case "high-volume":
            // Outgoing edges from focus wallet
            if (fromNode.id === focusWallet.id) {
              relatedIds.add(toNode.id);
              if (edge.timestamp) timestamps.push(edge.timestamp);
            }
            break;
          case "circular":
          case "layering":
          case "structuring":
          case "pass-through":
          case "peel-chain":
          case "mixer":
            // Show all edges connected to focus wallet (both in and out)
            if (fromNode.id === focusWallet.id) {
              relatedIds.add(toNode.id);
              if (edge.timestamp) timestamps.push(edge.timestamp);
            } else if (toNode.id === focusWallet.id) {
              relatedIds.add(fromNode.id);
              if (edge.timestamp) timestamps.push(edge.timestamp);
            }
            break;
        }
      });

      // Limit pattern mode to max 6 related nodes
      const limitedRelatedIds = Array.from(relatedIds).slice(0, 6);
      limitedRelatedIds.forEach((id) => visibleNodeIds.add(id));
    } else if (selectedNodeId) {
      setPrimaryNodeId(null);
      // FOCUSED MODE: Show ONE pattern only (max 7 neighbors = 8 total nodes)
      visibleNodeIds.add(selectedNodeId);
      coreNodeIds.add(selectedNodeId);

      // Strict limit: max 7 neighbors for clean pattern (1 source + 7 recipients = 8 total)
      const neighbors: string[] = [];
      edges.forEach((edge) => {
        const fromNode = enrichedNodes.find((n) => n.hash === edge.from_wallet);
        const toNode = enrichedNodes.find((n) => n.hash === edge.to_wallet);

        if (fromNode?.id === selectedNodeId && toNode && neighbors.length < 7) {
          if (!neighbors.includes(toNode.id)) {
            neighbors.push(toNode.id);
          }
        }
        if (toNode?.id === selectedNodeId && fromNode && neighbors.length < 7) {
          if (!neighbors.includes(fromNode.id)) {
            neighbors.push(fromNode.id);
          }
        }
      });

      neighbors.forEach((id) => visibleNodeIds.add(id));
    } else {
      setPrimaryNodeId(null);
      // DEFAULT MODE: Show ONLY top high-risk nodes + max 3 neighbors each (cleaner view)
      highRiskNodeIds.forEach((id) => {
        visibleNodeIds.add(id);
        coreNodeIds.add(id);
      });

      // Add max 3 neighbors per high-risk node for very clean pattern
      highRiskNodeIds.forEach((highRiskId) => {
        const neighborsForThisNode: string[] = [];

        edges.forEach((edge) => {
          const fromNode = enrichedNodes.find(
            (n) => n.hash === edge.from_wallet,
          );
          const toNode = enrichedNodes.find((n) => n.hash === edge.to_wallet);

          if (fromNode && toNode) {
            // If this high-risk node receives from someone, add first 3 senders
            if (toNode.id === highRiskId && neighborsForThisNode.length < 3) {
              if (!neighborsForThisNode.includes(fromNode.id)) {
                neighborsForThisNode.push(fromNode.id);
                visibleNodeIds.add(fromNode.id);
              }
            }
            // If this high-risk node sends to someone, add first 3 recipients
            if (fromNode.id === highRiskId && neighborsForThisNode.length < 3) {
              if (!neighborsForThisNode.includes(toNode.id)) {
                neighborsForThisNode.push(toNode.id);
                visibleNodeIds.add(toNode.id);
              }
            }
          }
        });
      });
    }

    // STEP 3: Filter nodes and edges (STRICT - both endpoints must be visible)
    // Hard cap: max 15 nodes to prevent off-screen stragglers
    const limitedVisibleNodeIds = new Set(
      Array.from(visibleNodeIds).slice(0, 15),
    );

    const visibleNodes = enrichedNodes
      .filter((n) => limitedVisibleNodeIds.has(n.id))
      .map((n) => {
        const isCore = coreNodeIds.has(n.id);

        // In pattern mode, strongest focus on primary node
        if (primaryNodeId) {
          if (n.id === primaryNodeId) {
            return {
              ...n,
              size: n.size * 1.6,
              opacity: 1.0,
            };
          }

          return {
            ...n,
            size: n.size * 0.75,
            opacity: 0.45,
            color: "#6b7280",
          };
        }

        // In focused mode, enhance visual hierarchy
        if (selectedNodeId) {
          if (n.id === selectedNodeId) {
            // Selected node: larger, full opacity
            return {
              ...n,
              size: n.size * 1.4, // Make source prominent
              opacity: 1.0,
            };
          } else {
            // Recipients: smaller, muted
            return {
              ...n,
              size: n.size * 0.8,
              opacity: 0.6, // Recipients are dimmed
              color: n.risk >= 0.7 ? n.color : "#9ca3af", // Gray for low-risk recipients
            };
          }
        }

        // Default mode: core nodes full opacity, neighbors dimmed
        return {
          ...n,
          opacity: isCore ? 1.0 : 0.4,
        };
      });

    const allLinks = edges
      .map((tx) => {
        const sourceNode = enrichedNodes.find((n) => n.hash === tx.from_wallet);
        const targetNode = enrichedNodes.find((n) => n.hash === tx.to_wallet);

        if (!sourceNode || !targetNode) return null;

        // STRICT: Both endpoints must be in limited visible set
        const isVisible =
          limitedVisibleNodeIds.has(sourceNode.id) &&
          limitedVisibleNodeIds.has(targetNode.id);

        if (!isVisible) return null;

        // Check if this edge is part of the pattern evidence
        let isPatternEdge = false;
        if (focusPattern && focusPattern.transactions) {
          isPatternEdge = focusPattern.transactions.some(
            (t) =>
              (t.from === tx.from_wallet && t.to === tx.to_wallet) ||
              (t.hash && t.hash === tx.id),
          );
        }

        // In pattern mode, only show direct edges with primary wallet
        if (focusPattern && focusWallet) {
          const isDirectToPrimary =
            sourceNode.id === focusWallet.id ||
            targetNode.id === focusWallet.id;
          if (!isDirectToPrimary) return null;
        }

        // In focused mode, only show direct edges (no multi-hop)
        if (!focusPattern && selectedNodeId) {
          const isDirect =
            sourceNode.id === selectedNodeId ||
            targetNode.id === selectedNodeId;
          if (!isDirect) return null; // Skip indirect edges in focused mode
        }

        return {
          source: sourceNode.id,
          target: targetNode.id,
          amount: tx.amount,
          width: 0.8,
          isPatternEdge, // Mark edges that are part of the detected pattern
        };
      })
      .filter((link) => link !== null) as any[];

    // Strict limit: max 10 edges in focused mode for clean pattern
    const finalLinks =
      !focusPattern && selectedNodeId ? allLinks.slice(0, 10) : allLinks;

    // SANITY CHECK: Warn if nodes but no edges
    if (visibleNodes.length > 0 && finalLinks.length === 0) {
      console.warn("⚠️ Graph rendering bug: Nodes visible but no edges.", {
        visibleNodes: visibleNodes.length,
        highRiskNodes: highRiskNodeIds.size,
      });
    }

    setFilteredData({
      nodes: visibleNodes,
      links: finalLinks,
    });
  }, [nodes, edges, selectedNodeId]);

  // Force tuning for a more spread out layout
  useEffect(() => {
    if (!graphRef.current) return;
    const fg = graphRef.current;

    // Longer edges + stronger repulsion for cleaner spacing
    const linkDistance = selectedNodeId ? 280 : 220;
    fg.d3Force("link")?.distance(linkDistance);
    fg.d3Force("charge")?.strength(-380);
    fg.d3ReheatSimulation();
  }, [selectedNodeId, filteredData.nodes.length, filteredData.links.length]);

  // Fit graph to screen on initial load and on data changes
  useEffect(() => {
    if (!graphRef.current || filteredData.nodes.length === 0) return;

    // Small delay to ensure graph is rendered
    const timer = setTimeout(() => {
      if (graphRef.current) {
        graphRef.current.zoomToFit(300, 50);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [filteredData.nodes.length]);

  // Auto-fit on window resize
  useEffect(() => {
    const handleResize = () => {
      if (graphRef.current && filteredData.nodes.length > 0) {
        graphRef.current.zoomToFit(300, 50);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [filteredData.nodes.length]);

  const handleNodeClick = (node: any) => {
    if (focusPattern) return;
    const nextId = node.id === selectedNodeId ? null : node.id;
    setSelectedNodeId(nextId);

    if (!nextId) {
      onWalletSelect?.(null);
      return;
    }

    onWalletSelect?.({
      id: node.id,
      hash: node.hash,
      riskScore: node.riskScore,
      transactionCount: node.transactionCount,
      inflow: node.inflow,
      outflow: node.outflow,
      role: node.role,
    });
  };

  const resetView = () => {
    setSelectedNodeId(null);
    setHoveredNodeId(null);
    onWalletSelect?.(null);
  };

  const zoomIn = () => {
    if (!graphRef.current) return;
    const current = graphRef.current.zoom();
    graphRef.current.zoom(current * 1.2, 250);
  };

  const zoomOut = () => {
    if (!graphRef.current) return;
    const current = graphRef.current.zoom();
    graphRef.current.zoom(current / 1.2, 250);
  };

  const fitToScreen = () => {
    if (!graphRef.current) return;
    graphRef.current.zoomToFit(400, 60);
  };

  // Node color with opacity handling
  const getNodeColor = (node: any) => {
    const baseColor = node.color;
    const opacity = node.opacity || 1.0;

    if (hoveredNodeId === node.id) {
      return baseColor + "ff"; // Full opacity for hover
    }

    // Convert opacity to hex (0.4 = 66, 1.0 = ff)
    const opacityHex = Math.round(opacity * 255)
      .toString(16)
      .padStart(2, "0");
    return baseColor + opacityHex;
  };

  // Subtle edge colors (kept for reference but not currently used)
  // const getLinkColor = (link: any) => { ... }

  return (
    <div className="w-full h-full flex flex-col bg-black relative">
      {/* Graph Canvas - Progressive Disclosure */}
      <div
        className="flex-1 relative w-full bg-black bg-[radial-gradient(circle,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:26px_26px]"
        ref={containerRef}
      >
        {filteredData.nodes.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
            <div className="text-center">
              <p className="mb-2">No suspicious activity detected</p>
              <p className="text-xs text-gray-600">
                All wallets have low risk scores
              </p>
            </div>
          </div>
        ) : dimensions.width > 100 ? (
          <>
            <ForceGraph2D
              ref={graphRef}
              graphData={filteredData}
              width={dimensions.width}
              height={dimensions.height}
              nodeLabel={(node: any) =>
                `${node.hash.slice(0, 16)}... (Risk: ${node.riskScore}/100)`
              }
              nodeRelSize={1}
              nodePointerAreaPaint={(
                node: any,
                color: string,
                ctx: CanvasRenderingContext2D,
              ) => {
                // Make entire sphere clickable - expand hit area
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.size * 1.3, 0, 2 * Math.PI);
                ctx.fill();
              }}
              nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
                // Skip rendering if node doesn't have valid position yet
                if (
                  !isFinite(node.x) ||
                  !isFinite(node.y) ||
                  !isFinite(node.size)
                ) {
                  return;
                }

                const baseColor = getNodeColor(node);

                // Draw simple 2D circle
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.size, 0, 2 * Math.PI);
                ctx.fill();

                // Add glow effect for special nodes
                if (primaryNodeId && primaryNodeId === node.id) {
                  // Red glow for pattern mode
                  ctx.strokeStyle = "rgba(239, 68, 68, 1  )";
                  ctx.lineWidth = 6;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, node.size + 5, 0, 2 * Math.PI);
                  ctx.stroke();

                  ctx.strokeStyle = "rgba(239, 68, 68, 0.3)";
                  ctx.lineWidth = 3;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, node.size + 10, 0, 2 * Math.PI);
                  ctx.stroke();
                } else if (selectedNodeId === node.id) {
                  // Green glow for selected node
                  ctx.strokeStyle = "rgba(0, 255, 136, 0.7)";
                  ctx.lineWidth = 5;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, node.size + 5, 0, 2 * Math.PI);
                  ctx.stroke();

                  ctx.strokeStyle = "rgba(0, 255, 136, 0.35)";
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, node.size + 10, 0, 2 * Math.PI);
                  ctx.stroke();
                } else if (hoveredNodeId === node.id) {
                  // Light glow for hovered node
                  ctx.strokeStyle = "rgba(0, 255, 136, 0.5)";
                  ctx.lineWidth = 3;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, node.size + 3, 0, 2 * Math.PI);
                  ctx.stroke();
                }

                // Add sink indicator (bright ring)
                if (node.role === "sink") {
                  ctx.strokeStyle = "rgba(251, 191, 36, 0.8)";
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, node.size + 4, 0, 2 * Math.PI);
                  ctx.stroke();
                }
              }}
              linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D) => {
                const start = link.source;
                const end = link.target;

                // Determine if this is a pattern edge
                const isPatternEdge = focusPattern && link.isPatternEdge;

                // Draw edge line with pattern highlighting
                if (isPatternEdge) {
                  // Pattern edges: bright, thick, prominent
                  ctx.strokeStyle = "#fbbf24"; // Bright amber for pattern edges
                  ctx.lineWidth = 2.8; // Thicker for visibility
                } else if (
                  hoveredNodeId &&
                  (link.source.id === hoveredNodeId ||
                    link.target.id === hoveredNodeId)
                ) {
                  ctx.strokeStyle = "rgba(156, 163, 175, 0.6)"; // Slightly brighter on hover
                  ctx.lineWidth = link.width;
                } else {
                  ctx.strokeStyle = "rgba(156, 163, 175, 0.27)"; // Light gray, subtle by default
                  ctx.lineWidth = link.width;
                }

                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();

                // Draw arrowhead (directional flow)
                const angle = Math.atan2(end.y - start.y, end.x - start.x);
                const arrowSize = isPatternEdge ? 10 : 8;
                const offsetDist = (end as any).size || 10;

                // Position arrow at edge of target node
                const arrowX = end.x - offsetDist * Math.cos(angle);
                const arrowY = end.y - offsetDist * Math.sin(angle);

                // Arrow color - pattern edges get bright amber
                let arrowColor = "rgba(156, 163, 175, 0.6)"; // Light gray normally
                if (isPatternEdge) {
                  arrowColor = "#fbbf24"; // Bright amber for pattern edges
                } else if (
                  hoveredNodeId &&
                  (link.source.id === hoveredNodeId ||
                    link.target.id === hoveredNodeId)
                ) {
                  arrowColor = "#22c55e"; // Bright green on hover
                }

                ctx.fillStyle = arrowColor;
                ctx.strokeStyle = arrowColor;
                ctx.lineWidth = 1.5;

                ctx.beginPath();
                ctx.moveTo(
                  arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
                  arrowY - arrowSize * Math.sin(angle - Math.PI / 6),
                );
                ctx.lineTo(arrowX, arrowY);
                ctx.lineTo(
                  arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
                  arrowY - arrowSize * Math.sin(angle + Math.PI / 6),
                );
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
              }}
              onNodeClick={handleNodeClick}
              onNodeHover={(node: any) => setHoveredNodeId(node?.id || null)}
              onLinkHover={() => {}}
              d3VelocityDecay={0.3}
              d3AlphaDecay={0.02}
              enableZoom={true}
              enablePan={true}
              minZoom={0.5}
              maxZoom={8}
              backgroundColor="transparent"
            />

            {/* Graph Controls */}
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
              <button
                onClick={zoomIn}
                className="h-9 w-9 rounded-lg border border-zinc-700/70 bg-zinc-900/80 text-gray-300 hover:text-white hover:border-[#00ff88]/50 transition"
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                onClick={zoomOut}
                className="h-9 w-9 rounded-lg border border-zinc-700/70 bg-zinc-900/80 text-gray-300 hover:text-white hover:border-[#00ff88]/50 transition"
                aria-label="Zoom out"
              >
                −
              </button>
              <button
                onClick={fitToScreen}
                className="h-9 w-9 rounded-lg border border-zinc-700/70 bg-zinc-900/80 text-gray-300 hover:text-white hover:border-[#00ff88]/50 transition"
                aria-label="Fit to screen"
              >
                ⤢
              </button>
              <button
                onClick={resetView}
                className="h-9 w-9 rounded-lg border border-zinc-700/70 bg-zinc-900/80 text-gray-300 hover:text-white hover:border-[#00ff88]/50 transition"
                aria-label="Reset view"
              >
                ⟲
              </button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-4 rounded-lg border border-zinc-800/70 bg-black/70 px-3 py-2 text-[11px] text-gray-300">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                <span>Low Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                <span>High Risk</span>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
            <p>Initializing investigation tool...</p>
          </div>
        )}
      </div>

      {/* Enhanced Tooltip */}
      {hoveredNodeId && (
        <div className="absolute bottom-4 left-4 z-50 bg-black/95 border border-[#00ff88]/50 rounded p-4 text-xs max-w-sm shadow-lg">
          {(() => {
            const node = filteredData.nodes.find((n) => n.id === hoveredNodeId);
            if (!node) return null;

            const outgoing = filteredData.links.filter(
              (l) => l.source.id === node.id,
            ).length;
            const incoming = filteredData.links.filter(
              (l) => l.target.id === node.id,
            ).length;
            const isFanOut = outgoing >= 4;
            const isFanIn = incoming >= 4;

            return (
              <div className="space-y-2">
                <div className="font-mono text-[#00ff88] font-semibold">
                  {node.hash.slice(0, 20)}...
                </div>
                <div className="grid grid-cols-2 gap-2 text-gray-300">
                  <div>Risk Score:</div>
                  <div className="text-white font-semibold">
                    {node.riskScore}/100
                  </div>
                  <div>Transactions:</div>
                  <div className="text-white">{node.transactionCount}</div>
                  <div>In:</div>
                  <div className="text-blue-400">
                    {(node.inflow / 1e6).toFixed(2)}M
                  </div>
                  <div>Out:</div>
                  <div className="text-yellow-400">
                    {(node.outflow / 1e6).toFixed(2)}M
                  </div>
                </div>
                {(isFanOut || isFanIn) && (
                  <div className="pt-2 border-t border-zinc-700 space-y-1">
                    {isFanOut && (
                      <div className="text-orange-400 font-semibold">
                        🔀 Fan-out Pattern ({outgoing} recipients)
                      </div>
                    )}
                    {isFanIn && (
                      <div className="text-red-400 font-semibold">
                        🔁 Fan-in Pattern ({incoming} senders)
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default GraphVisualization;
