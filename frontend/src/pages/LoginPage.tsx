import { useState } from "react";
import { Shield } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle } = useAuth();

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      await signInWithGoogle();
      // Don't navigate immediately - let OAuth callback handle redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google login failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated Grey Grid Background */}
      <div className="absolute inset-0">
        <svg
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="rgba(100, 116, 139, 0.5)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#00ff88]/10 rounded-full blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#00ff88]/10 rounded-full blur-3xl opacity-20 animate-pulse" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo & Branding */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-[#00ff88]/30 blur-md rounded-lg" />
              <div className="relative bg-[#00ff88] p-3 rounded-lg shadow-[0_0_15px_rgba(0,255,136,0.5)]">
                <Shield className="w-8 h-8 text-black" />
              </div>
            </div>
          </div>

          <h1 className="text-4xl font-bold mb-3">
            CHAIN<span className="text-[#00ff88]">SLEUTH</span>
          </h1>
          <p className="text-gray-400 text-base mb-2">Forensics Console</p>
          <p className="text-gray-500 text-sm">
            Detect money laundering patterns in crypto transactions
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#00ff88] to-[#00cc6a] hover:from-[#00ff88] hover:to-[#00bb5a] text-grey font-bold py-4 px-6 rounded-lg transition-all shadow-lg shadow-[#00ff88]/25 hover:shadow-[#00ff88]/40 hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {loading ? "Signing in..." : "Sign in with Google"}
        </button>

        {/* Divider */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-3 bg-black text-gray-500 text-xs">or</span>
          </div>
        </div>

        {/* Alternative Info */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 text-center">
          <p className="text-gray-400 text-sm mb-3">
            No account needed. Sign in securely with your Google account to
            access the forensics console.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-[#00ff88]">
            <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse" />
            <span>Enterprise-grade security</span>
          </div>
        </div>

        {/* Footer Info */}
        <p className="text-center text-gray-500 text-xs mt-8">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
