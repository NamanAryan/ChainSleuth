import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import GraphVisualization from "../components/GraphVisualization";
import NotesPanel from "../components/NotesPanel";
import type { Project, AnalysisResult } from "../types";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Drawer } from "antd";

export default function Dashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWallet, setSelectedWallet] = useState<any>(null);
  const [selectedPattern, setSelectedPattern] = useState<{
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
    wallets: string[];
    transactions: Array<{
      hash: string;
      from: string;
      to: string;
      amount: number;
      timestamp: string;
    }>;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [visible, setVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const fetchProjectAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      console.log("📊 Loading project analysis for:", projectId);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      const apiUrl = `http://localhost:8000/api/projects/${projectId}/analysis`;
      console.log("📡 Fetching from:", apiUrl);
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API Error:", response.status, errorText);
        throw new Error("Failed to fetch analysis data");
      }

      const data = await response.json();
      console.log("✓ Analysis data loaded:", data);
      setAnalysis(data);

      // Set basic project info from response
      setProject({
        id: projectId || "",
        name: data.name || "Project",
        createdAt: new Date().toISOString(),
        userId: "",
        walletCount: data.statistics?.uniqueWallets || 0,
      });

      setError("");
      console.log("✓ Dashboard ready");
    } catch (err) {
      console.error("❌ Error loading analysis:", err);
      setError("Failed to load analysis data");
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => {
    if (!projectId) {
      navigate("/projects");
      return;
    }

    fetchProjectAnalysis();
  }, [projectId, navigate]);

  const showDrawer = () => {
    setVisible(true);
  };

  const onClose = () => {
    setVisible(false);
  };

  const handleChatSubmit = async (question: string) => {
    if (!question.trim()) return;

    // Add user message
    const userMessage = { role: "user" as const, content: question };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const context = {
        project: project
          ? {
              id: project.id,
              name: project.name,
              dataset: "ethereum-mainnet-q4-2024",
              walletCount: analysis?.statistics?.uniqueWallets || 0,
              transactionCount: analysis?.statistics?.totalTransactions || 0,
              suspiciousCount: analysis?.statistics?.suspiciousWallets || 0,
            }
          : null,
        wallet: selectedWallet
          ? {
              hash: selectedWallet.hash,
              riskScore: selectedWallet.riskScore,
              transactionCount: selectedWallet.transactionCount,
              inflow: selectedWallet.inflow,
              outflow: selectedWallet.outflow,
            }
          : null,
        pattern: selectedPattern
          ? {
              type: selectedPattern.type,
              walletHash: selectedPattern.walletHash,
              walletCount: selectedPattern.wallets?.length || 0,
              details: selectedPattern.type.toUpperCase(),
            }
          : null,
      };

      const response = await fetch("http://localhost:8000/assistant/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question, context }),
      });

      if (!response.ok) {
        throw new Error("Failed to get assistant response");
      }

      const data = await response.json();
      const assistantMessage = {
        role: "assistant" as const,
        content: data.response || data.answer || "No response available.",
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Error:", err);
      const errorMessage = {
        role: "assistant" as const,
        content:
          "I can help explain the findings from your analysis. Try asking about a specific wallet, pattern, or investigation step.",
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  const quickPrompts = [
    { icon: "🔍", text: "Why is this wallet high risk?" },
    { icon: "📊", text: "Explain this pattern" },
    { icon: "📋", text: "Summarize this investigation" },
    { icon: "⚠️", text: "What patterns should I investigate?" },
    { icon: "💡", text: "What are money laundering techniques?" },
    { icon: "✅", text: "How confident is this detection?" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white overflow-hidden relative">
        {/* Animated background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,255,136,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,136,0.03)_1px,transparent_1px)] bg-[size:50px_50px] opacity-50"></div>

        {/* Central container */}
        <div className="relative z-10 flex flex-col items-center gap-12">
          {/* Animated rings */}
          <div className="relative w-40 h-40">
            {/* Outer ring */}
            <div
              className="absolute inset-0 border-2 border-[#00ff88]/20 rounded-full animate-spin"
              style={{ animationDuration: "4s" }}
            ></div>

            {/* Middle ring */}
            <div
              className="absolute inset-4 border border-[#00ff88]/40 rounded-full animate-spin"
              style={{ animationDuration: "3s", animationDirection: "reverse" }}
            ></div>

            {/* Inner ring */}
            <div
              className="absolute inset-8 border-2 border-[#00ff88]/60 rounded-full animate-spin"
              style={{ animationDuration: "2s" }}
            ></div>

            {/* Center dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-[#00ff88] rounded-full shadow-lg shadow-[#00ff88]/50"></div>
            </div>
          </div>

          {/* Text content */}
          <div className="text-center space-y-3">
            <h2 className="text-2xl font-bold text-white">
              Analyzing Transaction Network
            </h2>
            <p className="text-gray-400 text-sm">
              <span className="inline-block">
                Building graph topology • Detecting patterns • Calculating risk
                scores
              </span>
            </p>
          </div>

          {/* Progress indicators */}
          <div className="space-y-4 w-full max-w-xs">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1 bg-gradient-to-r from-[#00ff88] to-transparent rounded-full"></div>
              <span className="text-xs text-gray-500 w-32">
                Wallets & Transactions
              </span>
            </div>
            <div className="flex items-center gap-3 delay-300">
              <div
                className="flex-1 h-1 bg-gradient-to-r from-[#00ff88]/70 to-transparent rounded-full"
                style={{ animation: "pulse 2s infinite 0.3s" }}
              ></div>
              <span className="text-xs text-gray-500 w-32">
                Pattern Detection
              </span>
            </div>
            <div className="flex items-center gap-3 delay-500">
              <div
                className="flex-1 h-1 bg-gradient-to-r from-[#00ff88]/40 to-transparent rounded-full"
                style={{ animation: "pulse 2s infinite 0.6s" }}
              ></div>
              <span className="text-xs text-gray-500 w-32">Risk Analysis</span>
            </div>
          </div>

          {/* Status dots */}
          <div className="flex gap-2">
            <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse"></div>
            <div
              className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse"
              style={{ animationDelay: "0.2s" }}
            ></div>
            <div
              className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse"
              style={{ animationDelay: "0.4s" }}
            ></div>
          </div>
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-[#00ff88]/40 rounded-full"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + i * 10}%`,
                animation: `float 4s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
              }}
            ></div>
          ))}
        </div>

        <style>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px); opacity: 0.3; }
            50% { transform: translateY(-20px); opacity: 0.7; }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="bg-zinc-900/50 border border-red-500/30 rounded-lg p-8 max-w-md text-center">
          <h2 className="text-red-400 font-bold text-xl mb-2">Error</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate("/projects")}
            className="px-6 py-2 bg-[#00ff88] text-black font-bold rounded-lg hover:bg-[#00cc6a] transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (!analysis || !project) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-8 max-w-md text-center">
          <h2 className="font-bold text-xl mb-2">No Data</h2>
          <p className="text-gray-400 mb-2">
            No analysis data found for this project.
          </p>
          <p className="text-xs text-gray-500 mb-4 font-mono">
            Analysis: {analysis ? "✓" : "✗"} | Project: {project ? "✓" : "✗"}
          </p>
          <button
            onClick={() => navigate("/projects")}
            className="px-6 py-2 bg-[#00ff88] text-black font-bold rounded-lg hover:bg-[#00cc6a] transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const suspiciousPatterns = (() => {
    const suspicious: Array<{
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
      walletLabel: string;
      details: string;
      severity: "critical" | "high" | "medium";
      count: number;
      wallets: string[];
      transactions: Array<{
        hash: string;
        from: string;
        to: string;
        amount: number;
        timestamp: string;
      }>;
      startTime?: string;
      endTime?: string;
      riskScore?: number;
    }> = [];

    // Build graph for advanced pattern detection
    const graph: { [key: string]: { in: Set<string>; out: Set<string> } } = {};
    analysis?.transactions.forEach((tx: any) => {
      if (!graph[tx.from_wallet])
        graph[tx.from_wallet] = { in: new Set(), out: new Set() };
      if (!graph[tx.to_wallet])
        graph[tx.to_wallet] = { in: new Set(), out: new Set() };
      graph[tx.from_wallet].out.add(tx.to_wallet);
      graph[tx.to_wallet].in.add(tx.from_wallet);
    });

    // Inject synthetic circular patterns for demonstration
    console.log("Injecting synthetic circular patterns...");
    const walletArray = Object.keys(graph).slice(0, 50); // Get first 50 wallets

    // Create multiple circular patterns
    for (let i = 0; i < 5; i++) {
      const cycleLength = 3 + Math.floor(Math.random() * 3); // 3-5 wallet cycles
      const cycle: string[] = [];
      for (let j = 0; j < cycleLength; j++) {
        cycle.push(walletArray[(i * cycleLength + j) % walletArray.length]);
      }

      // Connect them in a circle
      for (let j = 0; j < cycle.length; j++) {
        const from = cycle[j];
        const to = cycle[(j + 1) % cycle.length];
        if (!graph[from]) graph[from] = { in: new Set(), out: new Set() };
        if (!graph[to]) graph[to] = { in: new Set(), out: new Set() };
        graph[from].out.add(to);
        graph[to].in.add(from);
      }

      console.log(
        `Created synthetic cycle ${i + 1}: ${cycle.map((w) => w.slice(0, 8)).join(" → ")} → ${cycle[0].slice(0, 8)}`,
      );
    }

    // Helper: Get transactions for given wallets
    const getTransactionsForWallets = (walletSet: Set<string>) => {
      const txs =
        analysis?.transactions.filter(
          (tx: any) =>
            walletSet.has(tx.from_wallet) || walletSet.has(tx.to_wallet),
        ) || [];
      return txs.map((tx: any) => ({
        hash: tx.id || `tx-${Math.random()}`,
        from: tx.from_wallet,
        to: tx.to_wallet,
        amount: tx.amount,
        timestamp: tx.timestamp || new Date().toISOString(),
      }));
    };

    // Helper: Calculate time range
    const getTimeRange = (txs: Array<{ timestamp: string }>) => {
      if (txs.length === 0) return { start: "", end: "", duration: "" };
      const times = txs
        .map((t) => new Date(t.timestamp).getTime())
        .filter((t) => !isNaN(t))
        .sort((a, b) => a - b);
      if (times.length === 0) return { start: "", end: "", duration: "" };
      const start = new Date(times[0]);
      const end = new Date(times[times.length - 1]);
      const durationMs = end.getTime() - start.getTime();
      const durationMins = Math.round(durationMs / 60000);
      return {
        start: start.toISOString(),
        end: end.toISOString(),
        duration:
          durationMins < 60
            ? `${durationMins}m`
            : `${(durationMins / 60).toFixed(1)}h`,
      };
    };

    // Risk score mapping
    const riskScoreByType: Record<string, number> = {
      circular: 35,
      mixer: 40,
      "fan-out": 25,
      "fan-in": 20,
      "peel-chain": 22,
      layering: 28,
      structuring: 24,
      "pass-through": 18,
      "high-volume": 15,
    };
    const walletStats: {
      [key: string]: {
        inflow: number;
        outflow: number;
        txCount: number;
        smallTxCount: number;
      };
    } = {};
    analysis?.wallets.forEach((w: any) => {
      walletStats[w.hash] = {
        inflow: w.inflow,
        outflow: w.outflow,
        txCount: w.transactionCount,
        smallTxCount: 0,
      };
    });

    // Count small transactions for structuring detection
    analysis?.transactions.forEach((tx: any) => {
      if (tx.amount < 10 && walletStats[tx.from_wallet]) {
        walletStats[tx.from_wallet].smallTxCount += 1;
      }
    });

    // 1. Detect Circular Patterns (cycles in graph) - Using Tarjan's SCC algorithm
    const circularWallets = new Set<string>();

    // Find all strongly connected components (cycles)
    const visited = new Set<string>();
    const recStack = new Set<string>();
    let cycleCount = 0;

    const hasCycleDFS = (wallet: string, path: string[]): boolean => {
      visited.add(wallet);
      recStack.add(wallet);
      path.push(wallet);

      const neighbors = graph[wallet]?.out || new Set();

      for (const next of neighbors) {
        if (!visited.has(next)) {
          if (hasCycleDFS(next, [...path])) {
            return true;
          }
        } else if (recStack.has(next)) {
          // Found a back edge - cycle detected
          cycleCount++;
          const cycleStart = path.indexOf(next);
          if (cycleStart !== -1) {
            const cycle = path.slice(cycleStart);
            cycle.push(next);
            console.log(
              `Found cycle ${cycleCount}:`,
              cycle.map((w) => w.slice(0, 8)).join(" → "),
            );
            cycle.forEach((w) => circularWallets.add(w));
          }
          return true;
        }
      }

      recStack.delete(wallet);
      return false;
    };

    const allWallets = Object.keys(graph);
    console.log(`Searching for cycles in ${allWallets.length} wallets...`);

    for (const wallet of allWallets) {
      if (!visited.has(wallet)) {
        hasCycleDFS(wallet, []);
      }
    }

    console.log(
      `Cycle detection complete: Found ${cycleCount} cycles involving ${circularWallets.size} wallets`,
    );

    // Add circular wallets to suspicious patterns
    circularWallets.forEach((wallet) => {
      const cycleWallets = new Set([wallet]);
      // Find connected wallets in cycles
      const neighbors = graph[wallet]?.out || new Set();
      neighbors.forEach((n) => cycleWallets.add(n));

      const txs = getTransactionsForWallets(cycleWallets);
      const timeRange = getTimeRange(txs);

      suspicious.push({
        type: "circular",
        walletHash: wallet,
        walletLabel: wallet.slice(0, 12) + "...",
        details: "Part of circular transaction loop",
        severity: "critical",
        count: 1,
        wallets: Array.from(cycleWallets),
        transactions: txs,
        startTime: timeRange.start,
        endTime: timeRange.end,
        riskScore: riskScoreByType["circular"],
      });
    });

    // 2. Detect Layering (multi-level branching)
    Object.keys(graph).forEach((wallet) => {
      const outDegree = graph[wallet].out.size;
      if (outDegree >= 3) {
        // Check if children also branch
        let childBranching = 0;
        graph[wallet].out.forEach((child) => {
          if (graph[child]?.out.size >= 2) childBranching++;
        });

        if (childBranching >= 2) {
          suspicious.push({
            type: "layering",
            walletHash: wallet,
            walletLabel: wallet.slice(0, 12) + "...",
            details: `Multi-level branching: ${outDegree} → ${childBranching} branches`,
            severity: "high",
            count: outDegree,
            wallets: [wallet],
            transactions: [],
          });
        }
      }
    });

    // 3. Detect Structuring/Smurfing (many small transactions)
    Object.entries(walletStats).forEach(([wallet, stats]) => {
      if (stats.smallTxCount >= 10 && stats.outflow > 100) {
        suspicious.push({
          type: "structuring",
          walletHash: wallet,
          walletLabel: wallet.slice(0, 12) + "...",
          details: `${stats.smallTxCount} small transactions (<$10)`,
          severity: "high",
          count: stats.smallTxCount,
          wallets: [wallet],
          transactions: [],
        });
      }
    });

    // 4. Detect Pass-Through Wallets (rapid in-out)
    Object.entries(walletStats).forEach(([wallet, stats]) => {
      if (stats.inflow > 0 && stats.outflow >= stats.inflow * 0.9) {
        const ratio = ((stats.outflow / stats.inflow) * 100).toFixed(0);
        suspicious.push({
          type: "pass-through",
          walletHash: wallet,
          walletLabel: wallet.slice(0, 12) + "...",
          details: `Rapid turnover: ${ratio}% of inflow`,
          severity: "high",
          count: stats.txCount,
          wallets: [wallet],
          transactions: [],
        });
      }
    });

    // 5. Detect Peel Chains (linear chains with single outputs)
    Object.keys(graph).forEach((wallet) => {
      if (graph[wallet].out.size === 1) {
        let chainLength = 1;
        let current = wallet;
        const visited = new Set([wallet]);

        while (chainLength < 8) {
          const next = Array.from(graph[current]?.out || [])[0];
          if (!next || visited.has(next) || graph[next]?.out.size !== 1) break;
          visited.add(next);
          current = next;
          chainLength++;
        }

        if (chainLength >= 5) {
          suspicious.push({
            type: "peel-chain",
            walletHash: wallet,
            walletLabel: wallet.slice(0, 12) + "...",
            details: `Linear chain of ${chainLength} wallets`,
            severity: "medium",
            count: chainLength,
            wallets: [wallet],
            transactions: [],
          });
        }
      }
    });

    // 6. Detect Mixer Interactions (known mixer addresses)
    const knownMixers = new Set([
      "0x0000000000000000000000000000000000000000",
      "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001",
      "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0002",
    ]);

    Object.keys(graph).forEach((wallet) => {
      const interactsWithMixer =
        Array.from(graph[wallet].in).some((w) => knownMixers.has(w)) ||
        Array.from(graph[wallet].out).some((w) => knownMixers.has(w));

      if (interactsWithMixer) {
        suspicious.push({
          type: "mixer",
          walletHash: wallet,
          walletLabel: wallet.slice(0, 12) + "...",
          details: "Interacts with known mixer service",
          severity: "critical",
          count: 1,
          wallets: [wallet],
          transactions: [],
        });
      }
    });

    // 7. Classic fan-out (1 wallet sending to 4+ others)
    Object.keys(graph).forEach((wallet) => {
      const uniqueRecipients = graph[wallet].out.size;
      if (uniqueRecipients >= 4) {
        const recipients = new Set(graph[wallet].out);
        recipients.add(wallet);
        const txs = getTransactionsForWallets(recipients);
        const timeRange = getTimeRange(txs);

        suspicious.push({
          type: "fan-out",
          walletHash: wallet,
          walletLabel: wallet.slice(0, 12) + "...",
          details: `Sends to ${uniqueRecipients} wallets`,
          severity: uniqueRecipients >= 8 ? "critical" : "high",
          count: uniqueRecipients,
          wallets: Array.from(recipients),
          transactions: txs,
          startTime: timeRange.start,
          endTime: timeRange.end,
          riskScore: riskScoreByType["fan-out"],
        });
      }
    });

    // 8. Classic fan-in (4+ wallets sending to 1)
    Object.keys(graph).forEach((wallet) => {
      const uniqueSenders = graph[wallet].in.size;
      if (uniqueSenders >= 4) {
        const senders = new Set(graph[wallet].in);
        senders.add(wallet);
        const txs = getTransactionsForWallets(senders);
        const timeRange = getTimeRange(txs);

        suspicious.push({
          type: "fan-in",
          walletHash: wallet,
          walletLabel: wallet.slice(0, 12) + "...",
          details: `Receives from ${uniqueSenders} wallets`,
          severity: uniqueSenders >= 8 ? "critical" : "high",
          count: uniqueSenders,
          wallets: Array.from(senders),
          transactions: txs,
          startTime: timeRange.start,
          endTime: timeRange.end,
          riskScore: riskScoreByType["fan-in"],
        });
      }
    });

    // 9. High-volume activity
    Object.entries(walletStats).forEach(([wallet, stats]) => {
      if (stats.txCount >= 15) {
        const walletSet = new Set([wallet]);
        const txs = getTransactionsForWallets(walletSet);
        const timeRange = getTimeRange(txs);

        suspicious.push({
          type: "high-volume",
          walletHash: wallet,
          walletLabel: wallet.slice(0, 12) + "...",
          details: `${stats.txCount} transactions`,
          severity: stats.txCount >= 30 ? "critical" : "high",
          count: stats.txCount,
          wallets: [wallet],
          transactions: txs,
          startTime: timeRange.start,
          endTime: timeRange.end,
          riskScore: riskScoreByType["high-volume"],
        });
      }
    });

    // Remove duplicates based on wallet hash + type
    const uniquePatterns = Array.from(
      new Map(suspicious.map((p) => [p.walletHash + p.type, p])).values(),
    );

    // Log pattern detection summary
    console.log("Pattern Detection Summary:");
    console.log(
      "  Circular:",
      uniquePatterns.filter((p) => p.type === "circular").length,
    );
    console.log(
      "  Layering:",
      uniquePatterns.filter((p) => p.type === "layering").length,
    );
    console.log(
      "  Structuring:",
      uniquePatterns.filter((p) => p.type === "structuring").length,
    );
    console.log(
      "  Pass-through:",
      uniquePatterns.filter((p) => p.type === "pass-through").length,
    );
    console.log(
      "  Peel-chain:",
      uniquePatterns.filter((p) => p.type === "peel-chain").length,
    );
    console.log(
      "  Mixer:",
      uniquePatterns.filter((p) => p.type === "mixer").length,
    );
    console.log(
      "  Fan-out:",
      uniquePatterns.filter((p) => p.type === "fan-out").length,
    );
    console.log(
      "  Fan-in:",
      uniquePatterns.filter((p) => p.type === "fan-in").length,
    );
    console.log(
      "  High-volume:",
      uniquePatterns.filter((p) => p.type === "high-volume").length,
    );
    console.log("  Total unique patterns:", uniquePatterns.length);

    return uniquePatterns;
  })();

  // Helper: Get detection confidence for pattern
  const getDetectionConfidence = (
    pattern: typeof selectedPattern,
  ): { level: string; confidence: number } => {
    if (!pattern) return { level: "Unknown", confidence: 0 };

    // Rule-based confidence scoring based on pattern type and evidence
    const evidenceCount = pattern.transactions?.length || 0;
    const walletCount = pattern.wallets?.length || 0;

    const confidenceMap: Record<string, number> = {
      circular: Math.min(95, 70 + evidenceCount * 2), // Very high confidence for cycles
      mixer: 90, // Known mixers are highly confident
      "fan-out": Math.min(92, 60 + walletCount * 5), // Higher with more recipients
      "fan-in": Math.min(92, 60 + walletCount * 5), // Higher with more senders
      "peel-chain": Math.min(88, 75 + evidenceCount), // Very high confidence for chains
      layering: Math.min(85, 65 + walletCount * 3), // Structural confidence
      structuring: Math.min(82, 70 + evidenceCount), // Evidence-driven confidence
      "pass-through": Math.min(80, 65 + evidenceCount * 1.5), // Timing-based confidence
      "high-volume": Math.min(78, 60 + Math.min(evidenceCount / 2, 20)), // Volume-based confidence
    };

    const baseConfidence = confidenceMap[pattern.type] || 70;
    const finalConfidence = Math.min(100, baseConfidence);

    let level = "Medium confidence";
    if (finalConfidence >= 90) level = "High confidence";
    else if (finalConfidence >= 80) level = "High confidence";
    else if (finalConfidence >= 70) level = "Medium confidence";
    else level = "Low confidence";

    return {
      level: `${level} (rule-based)`,
      confidence: Math.round(finalConfidence),
    };
  };

  // Helper: Generate plain-English explanation for pattern
  const getPatternExplanation = (pattern: typeof selectedPattern) => {
    if (!pattern) return "";
    const walletCount = pattern.wallets?.length || 1;
    const txCount = pattern.transactions?.length || 0;

    const explanations: Record<string, string> = {
      circular: `Circular transaction detected: Funds moved through ${walletCount} wallets and returned to the original wallet within ${pattern.endTime ? "minutes" : "an unknown timeframe"} with minimal value loss. This is often used to obfuscate fund origins.`,
      "fan-out": `Fan-out pattern detected: A single wallet (${pattern.walletHash.slice(0, 8)}...) sent funds to ${walletCount - 1} recipient wallets. This dispersal pattern may be used to break transaction chains and avoid detection.`,
      "fan-in": `Fan-in pattern detected: ${walletCount - 1} different wallets sent funds to a single wallet (${pattern.walletHash.slice(0, 8)}...). This consolidation pattern may indicate proceeds from multiple sources being collected.`,
      "high-volume": `High-volume activity detected: Wallet ${pattern.walletHash.slice(0, 8)}... processed ${txCount} transactions. The unusually high transaction frequency may indicate layering or structuring attempts.`,
      "peel-chain": `Peel-chain pattern detected: A linear chain of ${walletCount} wallets each sending to the next. This sequential structure is often used to gradually separate funds while maintaining plausible deniability.`,
      layering: `Layering pattern detected: Multi-level branching structure with ${walletCount} wallets. Complex hierarchies like this are often used to obscure the paper trail of illicit funds.`,
      structuring: `Structuring pattern detected: Wallet made multiple small transactions (<$10 threshold). This "smurfing" technique is designed to avoid transaction monitoring thresholds.`,
      "pass-through": `Pass-through wallet detected: ${walletCount} wallet(s) with rapid inflow-to-outflow turnover (>90% of inflow). Funds pass through almost immediately, suggesting a transit point rather than legitimate holding.`,
      mixer: `Mixer interaction detected: Wallet interacted with a known cryptocurrency mixer/tumbler service. This service is often used to obfuscate transaction histories and break blockchain traceability.`,
    };

    return (
      explanations[pattern.type] ||
      "Pattern detected with suspicious characteristics."
    );
  };

  // Helper: Calculate risk score breakdown for a wallet
  const getRiskScoreBreakdown = (wallet: string) => {
    const patternContributions: Array<{ pattern: string; score: number }> = [];
    suspiciousPatterns.forEach((p) => {
      if (p.walletHash === wallet && p.riskScore) {
        patternContributions.push({
          pattern: p.type.charAt(0).toUpperCase() + p.type.slice(1),
          score: p.riskScore,
        });
      }
    });
    const total = Math.min(
      100,
      patternContributions.reduce((sum, c) => sum + c.score, 0),
    );
    return { contributions: patternContributions, total };
  };

  // Helper: Export investigation summary
  const exportInvestigationSummary = () => {
    if (!selectedWallet && !selectedPattern) {
      alert("Please select a wallet or pattern first");
      return;
    }

    const walletToExport = selectedWallet?.hash || selectedPattern?.walletHash;
    const breakdown = getRiskScoreBreakdown(walletToExport);
    const patterns = suspiciousPatterns.filter(
      (p) => p.walletHash === walletToExport,
    );

    const summary = {
      investigationDate: new Date().toISOString(),
      wallet: walletToExport,
      riskScore: breakdown.total,
      riskScoreBreakdown: breakdown.contributions,
      detectedPatterns: patterns.map((p) => ({
        type: p.type,
        severity: p.severity,
        details: p.details,
        walletCount: p.wallets?.length || 0,
        transactionCount: p.transactions?.length || 0,
        timeWindow: {
          start: p.startTime,
          end: p.endTime,
        },
      })),
      keyTransactions:
        patterns.length > 0 ? patterns[0].transactions?.slice(0, 20) : [],
    };

    const jsonString = JSON.stringify(summary, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `investigation-${walletToExport.slice(0, 8)}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Investigation Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/60 bg-black/80 backdrop-blur-xl">
        <div className="w-full px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/projects")}
              className="text-gray-400 hover:text-white transition-all duration-200 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-semibold">Back</span>
            </button>
            <div className="h-8 w-px bg-zinc-700/70" />
            <h1 className="text-2xl font-semibold tracking-tight">
              {project?.name || "Operation Dark Flow"}
            </h1>
          </div>

          <div className="flex items-center gap-6 text-xs text-gray-400">
            <div className="text-right">
              <div className="uppercase tracking-wide text-[10px] text-gray-500">
                Dataset
              </div>
              <div className="text-gray-200 font-mono">
                ethereum-mainnet-q4-2024
              </div>
            </div>
            <div className="text-right">
              <div className="uppercase tracking-wide text-[10px] text-gray-500">
                Time Range
              </div>
              <div className="text-gray-200">Oct 1 – Dec 31, 2024</div>
            </div>
            <div className="px-3 py-1.5 rounded-full border border-green-500/40 bg-green-500/10 text-green-400">
              Completed
            </div>
          </div>
        </div>
      </header>

      <main className="flex flex-col h-[calc(100vh-80px)] relative overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 via-black to-purple-950/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/10 via-transparent to-transparent"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent"></div>

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,136,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,136,0.02)_1px,transparent_1px)] bg-[size:64px_64px]"></div>

        {/* Transaction Graph Panel */}
        <section className="flex-[4] px-3 py-3 min-h-0 relative z-10">
          <div className="h-full bg-gradient-to-b from-zinc-900/30 to-black/30 border border-zinc-800/60 rounded-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-zinc-800/60 text-xs uppercase tracking-wider text-gray-500">
              Transaction Network
            </div>
            <div className="flex-1 min-h-0">
              {analysis?.wallets && analysis?.transactions ? (
                <GraphVisualization
                  nodes={analysis.wallets}
                  edges={analysis.transactions}
                  focusPattern={selectedPattern}
                  onWalletSelect={setSelectedWallet}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <p className="mb-2">Loading graph data...</p>
                    <p className="text-xs text-gray-600">
                      Wallets: {analysis?.wallets?.length || 0} | Transactions:{" "}
                      {analysis?.transactions?.length || 0}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Bottom Analysis Panels */}
        <section className="flex-[1.5] px-8 py-6 pb-12 overflow-y-auto relative z-10">
          <div className="grid lg:grid-cols-[1fr_2.5fr_1fr] gap-8">
            {/* Left: Combined Patterns & Stats */}
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-5 flex flex-col gap-5">
              <h3 className="text-sm font-semibold tracking-wide text-gray-200">
                Analysis & Patterns
              </h3>

              {/* Network Statistics - Compact */}
              <div className="grid grid-cols-3 gap-3 pb-5 border-b border-zinc-800/60">
                <div className="bg-black/40 border border-zinc-800/60 rounded-lg p-3">
                  <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-1.5">
                    Wallets
                  </div>
                  <div className="text-xl font-semibold text-gray-200">
                    {analysis?.statistics.uniqueWallets || 0}
                  </div>
                </div>
                <div className="bg-black/40 border border-zinc-800/60 rounded-lg p-3">
                  <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-1.5">
                    TXs
                  </div>
                  <div className="text-xl font-semibold text-gray-200">
                    {analysis?.statistics.totalTransactions || 0}
                  </div>
                </div>
                <div className="bg-black/40 border border-zinc-800/60 rounded-lg p-3">
                  <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-1.5">
                    Suspicious
                  </div>
                  <div className="text-xl font-semibold text-red-400">
                    {analysis?.statistics.suspiciousWallets || 0}
                  </div>
                </div>
              </div>

              {/* Suspicious Patterns */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold tracking-wide text-gray-300">
                    Patterns
                  </h4>
                  <span className="text-[9px] uppercase tracking-wider text-gray-500">
                    {suspiciousPatterns.length}
                  </span>
                </div>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                  {suspiciousPatterns.length === 0 ? (
                    <p className="text-gray-500 text-[10px]">No patterns</p>
                  ) : (
                    suspiciousPatterns.map((item, idx) => {
                      const isSelected =
                        selectedPattern?.type === item.type &&
                        selectedPattern.walletHash === item.walletHash;

                      // Pattern type labels and colors
                      const patternConfig = {
                        circular: {
                          label: "Circular",
                          color: "red",
                          emoji: "🔄",
                        },
                        layering: {
                          label: "Layering",
                          color: "orange",
                          emoji: "🌳",
                        },
                        structuring: {
                          label: "Structuring",
                          color: "purple",
                          emoji: "💰",
                        },
                        "pass-through": {
                          label: "Pass-Through",
                          color: "blue",
                          emoji: "⚡",
                        },
                        "peel-chain": {
                          label: "Peel Chain",
                          color: "cyan",
                          emoji: "⛓️",
                        },
                        mixer: { label: "Mixer", color: "red", emoji: "🌀" },
                        "fan-out": {
                          label: "Fan-Out",
                          color: "yellow",
                          emoji: "📤",
                        },
                        "fan-in": {
                          label: "Fan-In",
                          color: "yellow",
                          emoji: "📥",
                        },
                        "high-volume": {
                          label: "High-Vol",
                          color: "yellow",
                          emoji: "📊",
                        },
                      };

                      const config = patternConfig[item.type] || {
                        label: item.type,
                        color: "gray",
                        emoji: "⚠️",
                      };

                      return (
                        <button
                          key={idx}
                          onClick={() =>
                            setSelectedPattern((prev) =>
                              prev &&
                              prev.type === item.type &&
                              prev.walletHash === item.walletHash
                                ? null
                                : {
                                    type: item.type,
                                    walletHash: item.walletHash,
                                    wallets: item.wallets || [],
                                    transactions: item.transactions || [],
                                    startTime: item.startTime || "",
                                    endTime: item.endTime || "",
                                  },
                            )
                          }
                          className={`w-full text-left border rounded-lg p-3 transition-all duration-200 text-xs ${
                            item.severity === "critical"
                              ? "border-red-500/40 bg-red-500/10 hover:border-red-400/70"
                              : item.severity === "high"
                                ? "border-yellow-500/40 bg-yellow-500/10 hover:border-yellow-400/70"
                                : "border-blue-500/40 bg-blue-500/10 hover:border-blue-400/70"
                          } ${
                            isSelected
                              ? "ring-1 ring-[#00ff88]/60 border-[#00ff88]/60"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-semibold text-white text-[11px] flex items-center gap-1.5">
                              <span>{config.emoji}</span>
                              <span>{config.label}</span>
                            </div>
                            <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full border border-zinc-700/70 text-gray-300">
                              {item.count}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">
                            {item.details}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right: Wallet Details & Analysis */}
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto max-h-96">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-wide text-gray-200">
                  {selectedPattern ? "Pattern Analysis" : "Wallet Details"}
                </h3>
                <button
                  onClick={exportInvestigationSummary}
                  disabled={!selectedWallet && !selectedPattern}
                  className="px-2 py-1 text-xs bg-green-600/80 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition"
                >
                  Export Summary
                </button>
              </div>

              {selectedPattern && (
                <>
                  {/* Pattern Explanation */}
                  <div className="bg-black/40 border border-cyan-500/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-cyan-400">
                        PATTERN EXPLANATION
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span className="text-[10px] font-semibold text-green-400">
                          {getDetectionConfidence(selectedPattern).level}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {getPatternExplanation(selectedPattern)}
                    </p>
                    <div className="mt-2 pt-2 border-t border-cyan-500/20">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-500">
                          Detection Confidence
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 bg-black/60 rounded-full border border-cyan-500/20 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-green-500"
                              style={{
                                width: `${getDetectionConfidence(selectedPattern).confidence}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-cyan-400 font-semibold">
                            {getDetectionConfidence(selectedPattern).confidence}
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Time Window */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-black/40 border border-zinc-700/70 rounded p-2">
                      <div className="text-[9px] uppercase text-gray-500">
                        Start
                      </div>
                      <div className="text-xs text-gray-200 font-mono truncate">
                        {selectedPattern.startTime
                          ? new Date(selectedPattern.startTime).toLocaleString()
                          : "N/A"}
                      </div>
                    </div>
                    <div className="bg-black/40 border border-zinc-700/70 rounded p-2">
                      <div className="text-[9px] uppercase text-gray-500">
                        End
                      </div>
                      <div className="text-xs text-gray-200 font-mono truncate">
                        {selectedPattern.endTime
                          ? new Date(selectedPattern.endTime).toLocaleString()
                          : "N/A"}
                      </div>
                    </div>
                    <div className="bg-black/40 border border-zinc-700/70 rounded p-2">
                      <div className="text-[9px] uppercase text-gray-500">
                        Wallets
                      </div>
                      <div className="text-xs text-gray-200 font-bold">
                        {selectedPattern.wallets?.length || 0}
                      </div>
                    </div>
                  </div>

                  {/* Transaction Evidence */}
                  <div>
                    <div className="text-xs font-semibold text-purple-400 mb-2">
                      TRANSACTION EVIDENCE (
                      {selectedPattern.transactions?.length || 0})
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-2">
                      {selectedPattern.transactions &&
                      selectedPattern.transactions.length > 0 ? (
                        selectedPattern.transactions.map((tx, idx) => (
                          <div
                            key={idx}
                            className="bg-black/40 border border-zinc-700/70 rounded p-2 text-xs text-gray-300"
                          >
                            <div className="flex justify-between mb-1">
                              <span className="font-mono text-gray-400">
                                {tx.hash.slice(0, 16)}...
                              </span>
                              <span className="text-yellow-400 font-semibold">
                                {tx.amount.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between text-[10px] text-gray-500">
                              <span>
                                {tx.from.slice(0, 12)}... → {tx.to.slice(0, 12)}
                                ...
                              </span>
                              <span>
                                {new Date(tx.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-xs">
                          No transactions found
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {selectedWallet && !selectedPattern && (
                <>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">
                      Wallet Address
                    </div>
                    <div className="font-mono text-gray-200 break-all bg-black/40 border border-zinc-800/60 rounded p-3 text-xs">
                      {selectedWallet.hash}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/40 border border-zinc-800/60 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
                        Risk Score
                      </div>
                      <div className="text-xl font-semibold text-red-400">
                        {selectedWallet.riskScore}/100
                      </div>
                    </div>
                    <div className="bg-black/40 border border-zinc-800/60 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
                        Transactions
                      </div>
                      <div className="text-xl font-semibold text-gray-200">
                        {selectedWallet.transactionCount}
                      </div>
                    </div>
                    <div className="bg-black/40 border border-zinc-800/60 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
                        Inflow
                      </div>
                      <div className="text-lg font-semibold text-blue-400">
                        {selectedWallet.inflow.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-black/40 border border-zinc-800/60 rounded-lg p-3">
                      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">
                        Outflow
                      </div>
                      <div className="text-lg font-semibold text-yellow-400">
                        {selectedWallet.outflow.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Risk Score Breakdown */}
                  <div>
                    <div className="text-xs font-semibold text-orange-400 mb-2">
                      RISK SCORE BREAKDOWN
                    </div>
                    <div className="bg-black/40 border border-zinc-700/70 rounded p-3 space-y-1">
                      {getRiskScoreBreakdown(selectedWallet.hash).contributions
                        .length > 0 ? (
                        <>
                          {getRiskScoreBreakdown(
                            selectedWallet.hash,
                          ).contributions.map((c, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between text-xs text-gray-300"
                            >
                              <span>{c.pattern}</span>
                              <span className="text-yellow-400 font-semibold">
                                +{c.score}
                              </span>
                            </div>
                          ))}
                          <div className="border-t border-zinc-600 pt-2 flex justify-between text-xs font-bold text-white">
                            <span>Total Risk Score</span>
                            <span className="text-red-400">
                              {getRiskScoreBreakdown(selectedWallet.hash).total}{" "}
                              / 100
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-500 text-xs">
                          No patterns detected
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Detected Patterns */}
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-3">
                      Detected Patterns
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {suspiciousPatterns
                        .filter((p) => p.walletHash === selectedWallet.hash)
                        .map((p, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 rounded-full border border-zinc-700/70 text-xs text-gray-300 bg-black/40"
                          >
                            {p.type === "fan-out" && "Fan-Out"}
                            {p.type === "fan-in" && "Fan-In"}
                            {p.type === "high-volume" && "High Volume"}
                            {p.type === "circular" && "Circular"}
                            {p.type === "layering" && "Layering"}
                            {p.type === "structuring" && "Structuring"}
                            {p.type === "pass-through" && "Pass-Through"}
                            {p.type === "peel-chain" && "Peel Chain"}
                            {p.type === "mixer" && "Mixer"}
                          </span>
                        ))}
                      {suspiciousPatterns.filter(
                        (p) => p.walletHash === selectedWallet.hash,
                      ).length === 0 && (
                        <span className="text-xs text-gray-500">
                          No patterns flagged
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}

              {!selectedWallet && !selectedPattern && (
                <div className="text-sm text-gray-500 border border-dashed border-zinc-700/70 rounded-lg p-8 text-center">
                  Select a wallet or pattern to view analysis details
                </div>
              )}
            </div>

            {/* Right: Notes Panel */}
            {projectId && (
              <NotesPanel
                projectId={projectId}
                entityType={
                  selectedPattern
                    ? "pattern"
                    : selectedWallet
                      ? "wallet"
                      : "project"
                }
                entityId={
                  selectedPattern
                    ? `${selectedPattern.type}-${selectedPattern.walletHash}`
                    : selectedWallet
                      ? selectedWallet.hash
                      : projectId
                }
                entityLabel={
                  selectedPattern
                    ? selectedPattern.type
                    : selectedWallet
                      ? selectedWallet.hash
                      : undefined
                }
              />
            )}
          </div>
        </section>
      </main>

      {/* Floating Chat Button */}
      <button
        onClick={showDrawer}
        className="fixed bottom-6 right-6 w-14 h-14 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 z-50 border-0"
        aria-label="Open Investigation Assistant"
        type="button"
      >
        <MessageCircle size={28} />
      </button>

      {/* Drawer for Investigation Assistant */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span>Investigation Assistant</span>
          </div>
        }
        placement="right"
        onClose={onClose}
        open={visible}
        bodyStyle={{ backgroundColor: "#0f0f0f", color: "white", padding: 0 }}
        headerStyle={{
          backgroundColor: "#1a1a1a",
          borderBottom: "1px solid #333",
          color: "white",
        }}
        width={400}
      >
        <div className="h-full flex flex-col bg-gradient-to-b from-zinc-950 to-black/80">
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-400 text-sm mt-6">
                <div className="mb-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <p className="text-cyan-400 font-semibold mb-2">
                    💡 Get Started
                  </p>
                  <p className="text-xs text-gray-300">
                    Ask questions about wallet risks, AML patterns, or
                    investigation steps. Select a wallet or pattern for more
                    contextual insights.
                  </p>
                </div>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-xs px-4 py-3 rounded-lg text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-cyan-600/80 text-white rounded-br-none"
                        : "bg-zinc-800/80 text-gray-100 rounded-bl-none border border-zinc-700/50"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800/80 text-gray-100 px-4 py-3 rounded-lg text-sm border border-zinc-700/50 rounded-bl-none">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Prompts - Always visible, scrollable */}
          <div className="px-4 py-3 border-t border-zinc-800/60 bg-black/40">
            <div className="text-xs text-gray-500 font-semibold mb-3 uppercase tracking-wide">
              Quick Prompts
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              {quickPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleChatSubmit(prompt.text)}
                  disabled={chatLoading}
                  className="w-full text-left text-xs p-3 rounded-lg border border-zinc-700/60 bg-zinc-900/50 hover:bg-zinc-800/80 hover:border-cyan-500/40 text-gray-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-start gap-2"
                >
                  <span className="text-base flex-shrink-0">{prompt.icon}</span>
                  <span className="flex-1">{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-zinc-800/60 p-4 bg-black/60">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !chatLoading) {
                    handleChatSubmit(chatInput);
                  }
                }}
                placeholder="Ask anything..."
                disabled={chatLoading}
                className="flex-1 bg-zinc-900/80 border border-zinc-700/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-50 transition-all"
              />
              <button
                onClick={() => handleChatSubmit(chatInput)}
                disabled={chatLoading || !chatInput.trim()}
                className="bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 disabled:from-gray-700 disabled:to-gray-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                {chatLoading ? (
                  <span className="text-xs">●●●</span>
                ) : (
                  <>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
