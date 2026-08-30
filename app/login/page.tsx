"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profile) {
      setError("User profile or role not found in database.");
      setLoading(false);
      await supabase.auth.signOut();
      return;
    }

    if (profile.role === "teacher") {
      router.push("/teacher");
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex items-center justify-center p-6 relative overflow-hidden selection:bg-sky-500 selection:text-white">
      {/* Aesthetic Mesh Gradient Background Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-sky-600/15 to-indigo-600/15 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Main Glassmorphic Card */}
      <div className="max-w-md w-full bg-slate-900/60 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] relative z-10 transition-all duration-300">
        {/* Top Header Badge & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium mb-6 tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
            Secure Portal
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Welcome back
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 font-normal">
            Smart Classroom RFID Dashboard
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl text-sm mb-6 text-center backdrop-blur-md animate-shake">
            {error}
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2 tracking-wide">
              Email address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all duration-200 text-sm font-light shadow-inner"
              placeholder="name@institution.edu"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-medium text-slate-300 tracking-wide">
                Password
              </label>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3.5 text-slate-100 placeholder-slate-600 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all duration-200 text-sm font-light shadow-inner"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-medium py-3.5 px-4 rounded-xl transition-all duration-200 mt-6 shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 active:scale-[0.99] disabled:opacity-50 cursor-pointer text-sm tracking-wide"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Authenticating...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="mt-8 text-center border-t border-white/5 pt-6">
          <p className="text-[11px] text-slate-500 tracking-wider uppercase font-medium">
            Authorized Personnel Only
          </p>
        </div>
      </div>
    </div>
  );
}
