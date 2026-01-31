import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import GraphVisualization from "../components/GraphVisualization";
import type { Project, AnalysisResult, Transaction } from "../types";
import { ArrowLeft } from "lucide-react";

export default function Dashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) {
      navigate("/projects");
      return;
    }

    fetchProjectAnalysis();
  }, [projectId, navigate]);

  const fetchProjectAnalysis = async () => {
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
        userId: user?.id || "",
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
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-[#00ff88] rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400">Loading analysis...</p>
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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-[#00ff88]/10 bg-black/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/projects")}
              className="text-[#00ff88] hover:text-[#00bb5a] transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-semibold">Back</span>
            </button>
            <div className="h-6 w-px bg-zinc-800" />
            <h1 className="text-xl font-bold text-[#00ff88]">
              {project?.name || "Project"}
            </h1>
          </div>

          <div className="px-3 py-1.5 rounded-full border border-[#00ff88]/20 bg-[#0a0a12] text-xs text-gray-300">
            {user?.user_metadata?.full_name ||
              user?.user_metadata?.name ||
              user?.email?.split("@")[0] ||
              "User"}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Statistics Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-[#00ff88]/30 transition-colors">
            <div className="text-sm text-gray-400 mb-2">Total Wallets</div>
            <div className="text-4xl font-bold text-[#00ff88]">
              {analysis?.statistics.uniqueWallets || 0}
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-[#00ff88]/30 transition-colors">
            <div className="text-sm text-gray-400 mb-2">Total Transactions</div>
            <div className="text-4xl font-bold text-[#00ff88]">
              {analysis?.statistics.totalTransactions || 0}
            </div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 hover:border-red-400 transition-colors">
            <div className="text-sm text-gray-400 mb-2">Suspicious Wallets</div>
            <div className="text-4xl font-bold text-red-400">
              {analysis?.statistics.suspiciousWallets || 0}
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-[#00ff88]/30 transition-colors">
            <div className="text-sm text-gray-400 mb-2">Total Volume</div>
            <div className="text-4xl font-bold text-[#00ff88]">
              {analysis
                ? (analysis.statistics.totalVolume / 1e6).toFixed(1)
                : 0}
              M
            </div>
          </div>
        </div>

        {/* Graph Section */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            Transaction Network
          </h2>
          <div className="w-full h-96 bg-black/50 border border-zinc-800 rounded-lg overflow-hidden">
            {analysis?.wallets && analysis?.transactions && (
              <GraphVisualization
                nodes={analysis.wallets}
                edges={analysis.transactions}
              />
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">
            Recent Transactions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-[#00ff88] px-4 py-3 text-left font-semibold">
                    From Address
                  </th>
                  <th className="text-[#00ff88] px-4 py-3 text-left font-semibold">
                    To Address
                  </th>
                  <th className="text-[#00ff88] px-4 py-3 text-left font-semibold">
                    Amount
                  </th>
                  <th className="text-[#00ff88] px-4 py-3 text-left font-semibold">
                    Token
                  </th>
                  <th className="text-[#00ff88] px-4 py-3 text-left font-semibold">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {analysis?.transactions.slice(0, 10).map((tx: any) => (
                  <tr
                    key={tx.id}
                    className="border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <code className="bg-black/50 px-2 py-1 rounded text-[#00ff88] text-xs font-mono border border-zinc-800">
                        {(tx.from_wallet || "").slice(0, 12)}...
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <code className="bg-black/50 px-2 py-1 rounded text-[#00ff88] text-xs font-mono border border-zinc-800">
                        {(tx.to_wallet || "").slice(0, 12)}...
                      </code>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {tx.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {tx.token_type || "ETH"}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(tx.timestamp).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {analysis && analysis.transactions.length > 10 && (
            <p className="text-gray-500 text-xs mt-4 text-right">
              Showing 10 of {analysis.transactions.length} transactions
            </p>
          )}
        </div>

        {/* Debug Panel */}
        <div className="mt-8 bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 text-xs font-mono text-gray-400">
          <div className="text-[#00ff88] mb-2">DEBUG INFO:</div>
          <div>Project ID: {projectId}</div>
          <div>Analysis Wallets: {analysis?.wallets?.length || 0}</div>
          <div>
            Analysis Transactions: {analysis?.transactions?.length || 0}
          </div>
          <div>Project Name: {project?.name || "N/A"}</div>
        </div>
      </main>
    </div>
  );
}
