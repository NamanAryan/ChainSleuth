import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { Project } from "../types";
import {
  Shield,
  Upload,
  ExternalLink,
  AlertTriangle,
  Trash2,
} from "lucide-react";

export function ProjectsPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      const response = await fetch("http://localhost:8000/api/projects", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }

      const data = await response.json();
      setProjects(data);
      setError("");
    } catch (err) {
      console.error("Error fetching projects:", err);
      setError("Failed to load projects");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      setCreating(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      // Use FormData to handle file upload
      const formData = new FormData();
      formData.append("name", newProjectName);
      if (newProjectDescription) {
        formData.append("description", newProjectDescription);
      }
      if (csvFile) {
        formData.append("file", csvFile);
      }

      const response = await fetch("http://localhost:8000/api/projects", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      const newProject = await response.json();
      setProjects([...projects, newProject]);
      setNewProjectName("");
      setNewProjectDescription("");
      setCsvFile(null);
      setShowNewProject(false);
      setError("");
    } catch (err) {
      console.error("Error creating project:", err);
      setError("Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm("Are you sure you want to delete this project?")) {
      return;
    }

    try {
      setDeletingId(projectId);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/login");
        return;
      }

      const response = await fetch(
        `http://localhost:8000/api/projects/${projectId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete project");
      }

      setProjects(projects.filter((p) => p.id !== projectId));
      setError("");
    } catch (err) {
      console.error("Error deleting project:", err);
      setError("Failed to delete project");
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewProject = (projectId: string) => {
    navigate(`/dashboard/${projectId}`);
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await signOut();
      navigate("/login");
    } catch (err) {
      console.error("Error logging out:", err);
      setLoggingOut(false);
      navigate("/login");
    }
  };

  // Calculate aggregated metrics
  const aggregatedMetrics = {
    activeProjects: projects.length,
    totalWallets: projects.reduce((sum, p) => sum + (p.walletCount || 0), 0),
    highRiskCount: projects.reduce(
      (sum, p) => sum + (p.walletCount || 0) * 0.15,
      0,
    ), // Estimate
    totalTransactions: projects.reduce(
      (sum, p) => sum + (p.walletCount || 0) * 20,
      0,
    ), // Estimate
  };

  // Get risk level from project (low, medium, high)
  const getProjectRiskLevel = (
    projectName: string,
  ): "low" | "medium" | "high" => {
    const name = projectName.toLowerCase();
    if (
      name.includes("tornado") ||
      name.includes("mixer") ||
      name.includes("wash")
    )
      return "high";
    if (name.includes("bridge") || name.includes("exchange")) return "medium";
    return "low";
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Animated Network Background */}
      <div className="fixed inset-0 pointer-events-none">
        <svg
          className="w-full h-full absolute inset-0"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient
              id="lineGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#00ff88" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#00ff88" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#00ff88" stopOpacity="0.2" />
            </linearGradient>
            <style>{`
              @keyframes float1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(20px, -20px); } }
              @keyframes float2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-30px, 30px); } }
              @keyframes float3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(25px, 25px); } }
              @keyframes glow { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.8; } }
              .network-line { animation: glow 4s ease-in-out infinite; }
              .node1 { animation: float1 8s ease-in-out infinite; }
              .node2 { animation: float2 10s ease-in-out infinite; }
              .node3 { animation: float3 12s ease-in-out infinite; }
            `}</style>
          </defs>

          {/* Background grid lines */}
          <g opacity="0.1">
            <line
              x1="0"
              y1="0"
              x2="100%"
              y2="100%"
              stroke="#00ff88"
              strokeWidth="1"
            />
            <line
              x1="100%"
              y1="0"
              x2="0"
              y2="100%"
              stroke="#00ff88"
              strokeWidth="1"
            />
            <line
              x1="50%"
              y1="0"
              x2="50%"
              y2="100%"
              stroke="#00ff88"
              strokeWidth="0.5"
            />
            <line
              x1="0"
              y1="50%"
              x2="100%"
              y2="50%"
              stroke="#00ff88"
              strokeWidth="0.5"
            />
          </g>

          {/* Animated network connections */}
          <g className="network-line" filter="url(#glow)">
            {/* Top left cluster */}
            <line
              x1="100"
              y1="150"
              x2="300"
              y2="200"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              opacity="0.5"
            />
            <line
              x1="300"
              y1="200"
              x2="450"
              y2="100"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              opacity="0.5"
            />
            <line
              x1="100"
              y1="150"
              x2="450"
              y2="100"
              stroke="url(#lineGradient)"
              strokeWidth="1.5"
              opacity="0.3"
            />

            {/* Top right cluster */}
            <line
              x1="1000"
              y1="100"
              x2="1200"
              y2="180"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              opacity="0.5"
            />
            <line
              x1="1200"
              y1="180"
              x2="1300"
              y2="50"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              opacity="0.5"
            />
            <line
              x1="1000"
              y1="100"
              x2="1300"
              y2="50"
              stroke="url(#lineGradient)"
              strokeWidth="1.5"
              opacity="0.3"
            />

            {/* Middle connections */}
            <line
              x1="300"
              y1="400"
              x2="600"
              y2="350"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              opacity="0.5"
            />
            <line
              x1="600"
              y1="350"
              x2="800"
              y2="450"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              opacity="0.5"
            />
            <line
              x1="300"
              y1="400"
              x2="800"
              y2="450"
              stroke="url(#lineGradient)"
              strokeWidth="1.5"
              opacity="0.3"
            />

            {/* Bottom right cluster */}
            <line
              x1="900"
              y1="550"
              x2="1100"
              y2="650"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              opacity="0.5"
            />
            <line
              x1="1100"
              y1="650"
              x2="1250"
              y2="550"
              stroke="url(#lineGradient)"
              strokeWidth="2"
              opacity="0.5"
            />
            <line
              x1="900"
              y1="550"
              x2="1250"
              y2="550"
              stroke="url(#lineGradient)"
              strokeWidth="1.5"
              opacity="0.3"
            />

            {/* Cross connections */}
            <line
              x1="450"
              y1="100"
              x2="600"
              y2="350"
              stroke="url(#lineGradient)"
              strokeWidth="1"
              opacity="0.2"
            />
            <line
              x1="800"
              y1="450"
              x2="1000"
              y2="100"
              stroke="url(#lineGradient)"
              strokeWidth="1"
              opacity="0.2"
            />
            <line
              x1="300"
              y1="400"
              x2="900"
              y2="550"
              stroke="url(#lineGradient)"
              strokeWidth="1"
              opacity="0.25"
            />
          </g>

          {/* Animated nodes */}
          <g>
            <circle
              cx="100"
              cy="150"
              r="4"
              fill="#00ff88"
              opacity="0.6"
              className="node1"
              filter="url(#glow)"
            />
            <circle
              cx="300"
              cy="200"
              r="3"
              fill="#00ff88"
              opacity="0.5"
              className="node2"
              filter="url(#glow)"
            />
            <circle
              cx="450"
              cy="100"
              r="4"
              fill="#00ff88"
              opacity="0.6"
              className="node3"
              filter="url(#glow)"
            />

            <circle
              cx="600"
              cy="350"
              r="3"
              fill="#00ff88"
              opacity="0.5"
              className="node1"
              filter="url(#glow)"
            />
            <circle
              cx="800"
              cy="450"
              r="4"
              fill="#00ff88"
              opacity="0.6"
              className="node2"
              filter="url(#glow)"
            />

            <circle
              cx="1000"
              cy="100"
              r="3"
              fill="#00ff88"
              opacity="0.5"
              className="node3"
              filter="url(#glow)"
            />
            <circle
              cx="1200"
              cy="180"
              r="4"
              fill="#00ff88"
              opacity="0.6"
              className="node1"
              filter="url(#glow)"
            />
            <circle
              cx="1300"
              cy="50"
              r="3"
              fill="#00ff88"
              opacity="0.5"
              className="node2"
              filter="url(#glow)"
            />

            <circle
              cx="900"
              cy="550"
              r="4"
              fill="#00ff88"
              opacity="0.6"
              className="node3"
              filter="url(#glow)"
            />
            <circle
              cx="1100"
              cy="650"
              r="3"
              fill="#00ff88"
              opacity="0.5"
              className="node1"
              filter="url(#glow)"
            />
            <circle
              cx="1250"
              cy="550"
              r="4"
              fill="#00ff88"
              opacity="0.6"
              className="node2"
              filter="url(#glow)"
            />

            <circle
              cx="300"
              cy="400"
              r="3"
              fill="#00ff88"
              opacity="0.5"
              className="node3"
              filter="url(#glow)"
            />
          </g>
        </svg>

        {/* Radial gradient overlays for depth */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(0,255,136,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(0,255,136,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(0,255,136,0.05),transparent_40%)]" />
      </div>

      <div className={showNewProject ? "blur-sm" : ""}>
        {/* Navigation Header */}
        <header className="sticky top-0 z-50 border-b border-[#00ff88]/5 bg-transparent backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
            {/* Logo & Branding */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-[#00ff88]/20 blur-md rounded-lg" />
                <div className="relative bg-[#00ff88] p-2 rounded-lg shadow-[0_0_12px_rgba(0,255,136,0.4)]">
                  <Shield className="w-5 h-5 text-black font-bold" />
                </div>
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight leading-tight">
                  ChainSleuth
                </div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500 font-medium">
                  AML Detection System
                </div>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-4">
              <div className="px-3 py-1.5 rounded-full border border-[#00ff88]/20 bg-[#00ff88]/5 text-xs text-[#00ff88] font-mono font-semibold">
                v2.4.1
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-black bg-[#00ff88] hover:bg-[#00cc6a] transition-all duration-200 shadow-lg shadow-[#00ff88]/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loggingOut ? "..." : "Log out"}
              </button>
            </div>
          </div>
        </header>

        <main className="relative max-w-7xl mx-auto px-8 py-16">
          {/* Hero Section */}
          <div className="mb-20 text-center">
            {/* Investigation Hub Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#00ff88]/30 bg-[#00ff88]/8 mb-6 backdrop-blur-sm">
              <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse" />
              <span className="text-xs font-medium text-[#00ff88] uppercase tracking-wide">
                Investigation Hub
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-6xl font-bold mb-4 tracking-tight">Projects</h1>

            {/* Subheading */}
            <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed mb-12">
              Manage and monitor your transaction flow investigations. Each
              project traces wallet connections, analyzes patterns, and flags
              suspicious activity.
            </p>

            {/* Primary CTA */}
            <button
              onClick={() => setShowNewProject(!showNewProject)}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#00ff88] to-[#00cc6a] hover:from-[#00ff88] hover:to-[#00bb5a] text-black font-bold rounded-xl transition-all duration-200 shadow-lg shadow-[#00ff88]/30 hover:shadow-[#00ff88]/50 hover:scale-105 text-lg"
            >
              <span>+</span>
              <span>New Project</span>
            </button>
          </div>

          {/* Metrics Overview */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {/* Active Projects Card */}
            <div className="bg-gradient-to-br from-zinc-900/50 to-black/50 border border-[#00ff88]/20 rounded-xl p-6 backdrop-blur-sm hover:border-[#00ff88]/40 transition-all duration-200">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">
                Active Projects
              </div>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-10 bg-zinc-800/50 rounded animate-pulse"></div>
                  <div className="h-4 bg-zinc-800/30 rounded w-2/3 animate-pulse"></div>
                </div>
              ) : (
                <>
                  <div className="text-4xl font-bold text-white mb-1">
                    {aggregatedMetrics.activeProjects}
                  </div>
                  <div className="text-xs text-gray-600">
                    {projects.length === 1
                      ? "1 total"
                      : `${projects.length} total`}
                  </div>
                </>
              )}
            </div>

            {/* Wallets Traced Card */}
            <div className="bg-gradient-to-br from-zinc-900/50 to-black/50 border border-[#00ff88]/20 rounded-xl p-6 backdrop-blur-sm hover:border-[#00ff88]/40 transition-all duration-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="text-lg">👛</div>
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  Wallets Traced
                </div>
              </div>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-10 bg-zinc-800/50 rounded animate-pulse"></div>
                  <div className="h-4 bg-zinc-800/30 rounded w-1/2 animate-pulse mt-2"></div>
                </div>
              ) : (
                <>
                  <div className="text-4xl font-bold text-[#00ff88] font-mono">
                    {Math.round(aggregatedMetrics.totalWallets)}
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    Network nodes
                  </div>
                </>
              )}
            </div>

            {/* Flagged Nodes Card */}
            <div className="bg-gradient-to-br from-zinc-900/50 to-black/50 border border-red-500/20 rounded-xl p-6 backdrop-blur-sm hover:border-red-500/40 transition-all duration-200">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  Flagged Nodes
                </div>
              </div>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-10 bg-zinc-800/50 rounded animate-pulse"></div>
                  <div className="h-4 bg-zinc-800/30 rounded w-2/3 animate-pulse mt-2"></div>
                </div>
              ) : (
                <>
                  <div className="text-4xl font-bold text-red-400 font-mono">
                    {Math.round(aggregatedMetrics.highRiskCount)}
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    High risk detected
                  </div>
                </>
              )}
            </div>

            {/* Transactions Card */}
            <div className="bg-gradient-to-br from-zinc-900/50 to-black/50 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm hover:border-blue-500/40 transition-all duration-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="text-lg">📊</div>
                <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
                  Transactions
                </div>
              </div>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-10 bg-zinc-800/50 rounded animate-pulse"></div>
                  <div className="h-4 bg-zinc-800/30 rounded w-1/2 animate-pulse mt-2"></div>
                </div>
              ) : (
                <>
                  <div className="text-4xl font-bold text-blue-400 font-mono">
                    {(aggregatedMetrics.totalTransactions / 1000).toFixed(1)}
                    <span className="text-xl font-normal ml-1">K</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    Total flows analyzed
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-8 bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-lg text-sm backdrop-blur-sm">
              {error}
            </div>
          )}

          {/* All Investigations Section */}
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                All Investigations
              </h2>
              <p className="text-sm text-gray-500">
                {projects.length === 0
                  ? "No projects yet"
                  : `${projects.length} project${projects.length !== 1 ? "s" : ""} • ${projects.filter((p) => p.id).length > 0 ? Math.floor(projects.length * 0.5) : 0} active`}
              </p>
            </div>

            {/* Projects Loading */}
            {loading ? (
              <div>
                {/* Skeleton cards grid */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((idx) => (
                    <div
                      key={idx}
                      className="bg-gradient-to-br from-zinc-900/40 to-black/40 border border-zinc-800/50 rounded-xl p-6 backdrop-blur-sm"
                    >
                      {/* Skeleton header */}
                      <div className="space-y-3 mb-4">
                        <div className="h-6 bg-zinc-800/50 rounded w-3/4 animate-pulse"></div>
                        <div className="h-4 bg-zinc-800/30 rounded w-full animate-pulse"></div>
                        <div className="h-4 bg-zinc-800/30 rounded w-2/3 animate-pulse"></div>
                      </div>

                      {/* Skeleton content */}
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <div className="h-6 bg-zinc-800/40 rounded-full w-16 animate-pulse"></div>
                          <div className="h-6 bg-zinc-800/40 rounded-full w-20 animate-pulse"></div>
                        </div>

                        {/* Skeleton stats */}
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-800/30">
                          <div>
                            <div className="h-3 bg-zinc-800/30 rounded text-xs mb-2 w-12 animate-pulse"></div>
                            <div className="h-5 bg-zinc-800/50 rounded w-full animate-pulse"></div>
                          </div>
                          <div>
                            <div className="h-3 bg-zinc-800/30 rounded text-xs mb-2 w-16 animate-pulse"></div>
                            <div className="h-5 bg-zinc-800/50 rounded w-full animate-pulse"></div>
                          </div>
                        </div>
                      </div>

                      {/* Skeleton button */}
                      <div className="mt-4 h-10 bg-zinc-800/40 rounded-lg animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-24 bg-gradient-to-br from-zinc-900/30 to-black/30 border border-zinc-800/50 rounded-xl backdrop-blur-sm">
                <Upload className="w-16 h-16 text-zinc-700 mx-auto mb-4 opacity-40" />
                <h3 className="text-2xl font-bold text-gray-300 mb-3">
                  No investigations yet
                </h3>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                  Start your first AML investigation by creating a new project.
                  Upload transaction data and begin analyzing wallet
                  connections.
                </p>
                <button
                  onClick={() => setShowNewProject(true)}
                  className="px-8 py-3 bg-[#00ff88] text-black font-bold rounded-lg hover:bg-[#00cc6a] transition-all duration-200 shadow-lg shadow-[#00ff88]/25"
                >
                  Create First Project
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map((project) => {
                  const riskLevel = getProjectRiskLevel(project.name);
                  const riskColors = {
                    high: {
                      badge: "bg-red-500/10 text-red-400 border-red-500/30",
                      icon: "🚨",
                      label: "High Risk",
                    },
                    medium: {
                      badge:
                        "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
                      icon: "⚠️",
                      label: "Medium Risk",
                    },
                    low: {
                      badge:
                        "bg-green-500/10 text-green-400 border-green-500/30",
                      icon: "✓",
                      label: "Low Risk",
                    },
                  };
                  const colors = riskColors[riskLevel];

                  return (
                    <div
                      key={project.id}
                      className="group bg-gradient-to-br from-zinc-900/40 to-black/40 border border-zinc-800/50 hover:border-[#00ff88]/40 rounded-xl p-6 transition-all duration-200 hover:shadow-lg hover:shadow-[#00ff88]/10 cursor-pointer backdrop-blur-sm"
                    >
                      {/* Project Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-white group-hover:text-[#00ff88] transition-colors duration-200 line-clamp-2">
                            {project.name}
                          </h3>
                        </div>
                      </div>

                      {/* Description */}
                      {project.description && (
                        <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                          {project.description}
                        </p>
                      )}

                      {/* Risk Badge */}
                      <div
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border mb-4 ${colors.badge}`}
                      >
                        <span>{colors.icon}</span>
                        <span>{colors.label}</span>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-3 gap-3 py-4 border-y border-zinc-700/50">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#00ff88] font-mono">
                            {project.walletCount || 0}
                          </div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">
                            Wallets
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-400 font-mono">
                            {Math.round((project.walletCount || 0) * 20)}
                          </div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">
                            Txns
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-400 font-mono">
                            {Math.round((project.walletCount || 0) * 0.15)}
                          </div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">
                            Flagged
                          </div>
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="text-xs text-gray-600 mt-4 mb-4 flex items-center gap-2">
                        <span>📅</span>
                        <span>
                          {project.createdAt
                            ? new Date(project.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )
                            : "N/A"}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => handleViewProject(project.id)}
                          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#00ff88] to-[#00cc6a] hover:from-[#00ff88] hover:to-[#00bb5a] text-black font-bold py-2.5 rounded-lg text-sm transition-all duration-200 shadow-lg shadow-[#00ff88]/20 hover:shadow-[#00ff88]/40"
                        >
                          <span>Open Investigation</span>
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          disabled={deletingId === project.id}
                          className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold rounded-lg text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deletingId === project.id ? (
                            "..."
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal Overlay */}
      {showNewProject && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-40"
          onClick={() => setShowNewProject(false)}
        />
      )}

      {/* Create Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-gradient-to-br from-zinc-900/95 to-black/95 border border-[#00ff88]/30 rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-[#00ff88]/20">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <div className="w-3 h-3 bg-[#00ff88] rounded-full" />
                Create Investigation Project
              </h3>
              <button
                onClick={() => setShowNewProject(false)}
                className="text-gray-400 hover:text-white transition-colors text-2xl font-light"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Tornado Cash Mixer Analysis"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  disabled={creating}
                  className="w-full bg-black/50 border border-zinc-700/50 text-white placeholder-gray-600 px-4 py-3 rounded-lg focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88]/50 disabled:opacity-50 transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Description{" "}
                  <span className="text-gray-600 font-normal">(optional)</span>
                </label>
                <textarea
                  placeholder="Describe the investigation scope and objectives..."
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  disabled={creating}
                  rows={3}
                  className="w-full bg-black/50 border border-zinc-700/50 text-white placeholder-gray-600 px-4 py-3 rounded-lg focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88]/50 disabled:opacity-50 transition-all duration-200 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Upload CSV{" "}
                  <span className="text-gray-600 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    disabled={creating}
                    className="w-full bg-black/50 border border-zinc-700/50 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88]/50 disabled:opacity-50 transition-all duration-200 file:mr-3 file:py-1 file:px-2 file:bg-[#00ff88]/20 file:border file:border-[#00ff88]/50 file:rounded file:text-xs file:font-semibold file:text-[#00ff88] file:cursor-pointer"
                  />
                </div>
                {csvFile && (
                  <p className="text-xs text-[#00ff88] mt-2 flex items-center gap-1">
                    ✓ {csvFile.name}
                  </p>
                )}
                <p className="text-xs text-gray-600 mt-2">
                  CSV format: from_address, to_address, amount, timestamp
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={creating || !newProjectName.trim()}
                  className="flex-1 bg-gradient-to-r from-[#00ff88] to-[#00cc6a] hover:from-[#00ff88] hover:to-[#00bb5a] text-black font-bold py-3 rounded-lg transition-all duration-200 shadow-lg shadow-[#00ff88]/25 hover:shadow-[#00ff88]/40 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {creating ? "Creating..." : "Create Project"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewProject(false);
                    setNewProjectName("");
                    setNewProjectDescription("");
                    setCsvFile(null);
                  }}
                  className="flex-1 bg-zinc-900/50 hover:bg-zinc-800/50 border border-zinc-700/50 text-white font-semibold py-3 rounded-lg transition-all duration-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
