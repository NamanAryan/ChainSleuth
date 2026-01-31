import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { Project } from "../types";
import { Shield, Upload } from "lucide-react";

export function ProjectsPage() {
  const { user, signOut } = useAuth();
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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 border-b border-[#00ff88]/10 bg-black/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-[#00ff88]/30 blur-md rounded-lg" />
              <div className="relative bg-[#00ff88] p-2 rounded-lg shadow-[0_0_15px_rgba(0,255,136,0.5)]">
                <Shield className="w-5 h-5 text-black" />
              </div>
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">
                CHAIN<span className="text-[#00ff88]">SLEUTH</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-[#00ff88]/60">
                Forensics Console
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="px-3 py-1.5 rounded-full border border-[#00ff88]/20 bg-[#0a0a12] text-xs text-gray-300">
              {user?.user_metadata?.full_name ||
                user?.user_metadata?.name ||
                user?.email?.split("@")[0] ||
                "User"}
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-black bg-[#00ff88] hover:bg-[#00cc6a] transition-colors shadow-[0_0_10px_rgba(0,255,136,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Section Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2">Projects</h1>
              <p className="text-gray-400">
                Create and analyze transaction networks
              </p>
            </div>
            <button
              onClick={() => setShowNewProject(!showNewProject)}
              className="group relative px-6 py-3 bg-gradient-to-r from-[#00ff88] to-[#00cc6a] hover:from-[#00ff88] hover:to-[#00bb5a] text-black font-semibold rounded-lg transition-all shadow-lg shadow-[#00ff88]/25 hover:shadow-[#00ff88]/40 hover:scale-105 flex items-center gap-2"
            >
              <span>+ New Project</span>
            </button>
          </div>

          {/* Create Project Form */}
          {showNewProject && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8">
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Bitcoin Mixer Analysis"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    disabled={creating}
                    className="w-full bg-black border border-zinc-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] disabled:opacity-50 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    placeholder="Describe what you want to analyze..."
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    disabled={creating}
                    rows={3}
                    className="w-full bg-black border border-zinc-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] disabled:opacity-50 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Upload CSV (optional)
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                      disabled={creating}
                      className="w-full bg-black border border-zinc-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[#00ff88] focus:ring-1 focus:ring-[#00ff88] disabled:opacity-50 transition-all file:mr-3 file:py-1 file:px-2 file:bg-[#00ff88]/20 file:border file:border-[#00ff88]/50 file:rounded file:text-xs file:text-[#00ff88] file:cursor-pointer"
                    />
                  </div>
                  {csvFile && (
                    <p className="text-xs text-[#00ff88] mt-2">
                      ✓ {csvFile.name} selected
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    CSV should contain: from_address, to_address, amount,
                    timestamp
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={creating || !newProjectName.trim()}
                    className="flex-1 bg-gradient-to-r from-[#00ff88] to-[#00cc6a] hover:from-[#00ff88] hover:to-[#00bb5a] text-black font-bold py-3 rounded-lg transition-all shadow-lg shadow-[#00ff88]/25 hover:shadow-[#00ff88]/40 disabled:opacity-60 disabled:cursor-not-allowed"
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
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg mb-8 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-zinc-700 border-t-[#00ff88] rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/30 border border-zinc-800 rounded-xl">
            <Upload className="w-12 h-12 text-zinc-600 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              No projects yet
            </h3>
            <p className="text-gray-500 mb-6">
              Create a new project to start analyzing transaction networks
            </p>
            <button
              onClick={() => setShowNewProject(true)}
              className="px-6 py-2 bg-[#00ff88] text-black font-semibold rounded-lg hover:bg-[#00cc6a] transition-colors"
            >
              Create First Project
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-zinc-900/50 border border-zinc-800 hover:border-[#00ff88]/50 rounded-xl p-6 transition-all hover:shadow-lg hover:shadow-[#00ff88]/10 group cursor-pointer"
              >
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-[#00ff88] transition-colors">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 py-3 border-t border-b border-zinc-800 my-4">
                  <span className="flex items-center gap-1">
                    📊 {project.walletCount || 0} wallets
                  </span>
                  {project.createdAt && (
                    <span>
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewProject(project.id)}
                    className="flex-1 bg-gradient-to-r from-[#00ff88] to-[#00cc6a] hover:from-[#00ff88] hover:to-[#00bb5a] text-black font-semibold py-2 rounded-lg text-sm transition-all shadow-lg shadow-[#00ff88]/20 hover:shadow-[#00ff88]/30"
                  >
                    Analyze
                  </button>
                  <button
                    onClick={() => handleDeleteProject(project.id)}
                    disabled={deletingId === project.id}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold py-2 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {deletingId === project.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
