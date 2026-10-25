"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [userName, setUserName] = useState("Admin");
  const [userEmail, setUserEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return router.push("/login");

      const email = session.user.email || "";
      setUserEmail(email);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, username, avatar_url")
        .eq("id", session.user.id)
        .single();

      if (profile?.role === "teacher") return router.push("/teacher");

      setUserName(profile?.username || email.split("@")[0] || "Admin");
      setAvatarUrl(profile?.avatar_url || "");
      setIsAuthenticating(false);
    };
    checkUser();
  }, [router]);

  const executeSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Network error during sign out:", error);
    } finally {
      router.push("/login");
    }
  };

  if (isAuthenticating) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden selection:bg-blue-200">
      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center text-2xl mx-auto shadow-inner">
              🚪
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-blue-950">
                Sign Out?
              </h3>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                Are you sure you want to log out? You will need your credentials
                to sign back in.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  executeSignOut();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-sm cursor-pointer text-xs"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERSISTENT SIDEBAR */}
      <aside
        className={`${isSidebarOpen ? "w-64" : "w-20"} bg-[#1e293b] text-white flex flex-col shadow-2xl z-20 relative transition-all duration-300 ease-in-out shrink-0`}
      >
        <div className="p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700/60">
            {isSidebarOpen ? (
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center shrink-0 shadow-inner">
                  <span className="w-3.5 h-3.5 bg-blue-400 rounded-full animate-pulse shadow-[0_0_10px_#60a5fa]"></span>
                </span>
                <div className="font-extrabold text-xs tracking-tight text-blue-100 uppercase leading-tight">
                  <div>ADMIN</div>
                  <div>DASHBOARD</div>
                </div>
              </div>
            ) : (
              <div className="mx-auto">
                <span className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center shadow-inner">
                  <span className="w-3.5 h-3.5 bg-blue-400 rounded-full animate-pulse"></span>
                </span>
              </div>
            )}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700 shadow-sm"
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-300 ${isSidebarOpen ? "" : "rotate-180"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </div>

          <nav className="space-y-1.5 flex-1">
            <Link
              href="/"
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold transition-all ${
                pathname === "/"
                  ? "bg-slate-700/50 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <span className="text-lg shrink-0">📊</span>
              {isSidebarOpen && (
                <span className="text-sm tracking-wide truncate">
                  System Operations
                </span>
              )}
            </Link>

            <Link
              href="/students"
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold transition-all ${
                pathname === "/students"
                  ? "bg-slate-700/50 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <span className="text-lg shrink-0">👥</span>
              {isSidebarOpen && (
                <span className="text-sm tracking-wide truncate">
                  Student Registry
                </span>
              )}
            </Link>

            <Link
              href="/teachers"
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold transition-all ${
                pathname === "/teachers"
                  ? "bg-slate-700/50 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <span className="text-lg shrink-0">👨‍🏫</span>
              {isSidebarOpen && (
                <span className="text-sm tracking-wide truncate">
                  Instructors
                </span>
              )}
            </Link>

            <Link
              href="/terminals"
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold transition-all ${
                pathname === "/terminals"
                  ? "bg-slate-700/50 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <span className="text-lg shrink-0">📡</span>
              {isSidebarOpen && (
                <span className="text-sm tracking-wide truncate">
                  Hardware Terminals
                </span>
              )}
            </Link>

            <Link
              href="/audit"
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold transition-all ${
                pathname === "/audit"
                  ? "bg-slate-700/50 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <span className="text-lg shrink-0">🛡️</span>
              {isSidebarOpen && (
                <span className="text-sm tracking-wide truncate">
                  Security Audit
                </span>
              )}
            </Link>
          </nav>

          <div className="mt-auto pt-4 border-t border-slate-700/60 bg-slate-900/60 rounded-2xl p-3">
            {isSidebarOpen ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full border border-slate-500 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white uppercase">
                      {userName ? userName.charAt(0) : "A"}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-slate-100 truncate mb-0.5">
                      {userName}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {userEmail}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="w-full py-2 rounded-xl border border-rose-500/20 bg-transparent hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full border border-slate-500 object-cover"
                  />
                ) : (
                  <span
                    className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center uppercase shadow-inner"
                    title={userName}
                  >
                    {userName ? userName.charAt(0) : "A"}
                  </span>
                )}
                <button
                  onClick={() => setShowLogoutModal(true)}
                  title="Sign Out"
                  className="p-2 rounded-xl border border-rose-500/20 bg-transparent hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  🚪
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN DYNAMIC CONTENT */}
      <main className="flex-1 relative overflow-y-auto">{children}</main>
    </div>
  );
}
