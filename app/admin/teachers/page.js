"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(15);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("All");

  // Modal State for Role Toggling
  const [targetTeacher, setTargetTeacher] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchTeachers = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("username", { ascending: true });

    if (!error && data) setTeachers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadInitial() {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("username", { ascending: true });

      if (isMounted) {
        if (!error && data) setTeachers(data);
        setLoading(false);
      }
    }
    loadInitial();
    return () => {
      isMounted = false;
    };
  }, []);

  const executeRoleToggle = async () => {
    if (!targetTeacher) return;
    setIsUpdating(true);

    const newRole = targetTeacher.role === "teacher" ? "admin" : "teacher";

    try {
      const res = await fetch("/api/update-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetTeacher.id, newRole }),
      });

      const data = await res.json();

      if (!data.success) {
        alert("Failed to update role: " + data.error);
      } else {
        await fetchTeachers();
      }
    } catch (err) {
      alert("Network error: " + err.message);
    } finally {
      setIsUpdating(false);
      setTargetTeacher(null);
    }
  };

  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const name = (t.username || "").toLowerCase();
      const email = (t.email || "").toLowerCase();
      const role = (t.role || "").toLowerCase();
      const search = searchTerm.toLowerCase();

      const matchesSearch = name.includes(search) || email.includes(search);
      const matchesRole =
        filterRole === "All" || role === filterRole.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [teachers, searchTerm, filterRole]);

  const paginatedTeachers = useMemo(() => {
    return filteredTeachers.slice(0, visibleCount);
  }, [filteredTeachers, visibleCount]);

  const totalTeachersCount = teachers.filter(
    (t) => t.role === "teacher",
  ).length;
  const totalAdminsCount = teachers.filter((t) => t.role === "admin").length;

  return (
    <div className="relative overflow-y-auto h-full p-6 sm:p-10 pb-20 font-sans">
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none z-0"></div>

      {/* COMPACT & CLASSY ROLE TOGGLE CONFIRMATION MODAL */}
      {targetTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-scale-up">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-900 border border-blue-100 flex items-center justify-center text-xl mx-auto shadow-inner">
              🛡️
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-blue-950">
                Change User Role?
              </h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Switch{" "}
                <span className="font-bold text-slate-800">
                  {targetTeacher.username || targetTeacher.email}
                </span>{" "}
                to{" "}
                <span className="uppercase font-extrabold text-blue-900">
                  {targetTeacher.role === "teacher" ? "admin" : "teacher"}
                </span>
                ?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => setTargetTeacher(null)}
                disabled={isUpdating}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                onClick={executeRoleToggle}
                disabled={isUpdating}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold transition-all shadow-sm cursor-pointer text-xs disabled:opacity-50"
              >
                {isUpdating ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200/60 p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-900 text-xs font-bold uppercase tracking-wider mb-3 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-blue-900 animate-pulse"></span>
              Directory Access & Permissions
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-blue-950">
              Instructors & Faculty
            </h1>
            <p className="text-slate-500 text-base mt-2 font-medium">
              Manage faculty credentials, role privileges, and active system
              accounts.
            </p>
          </div>
        </div>

        {/* Telemetry Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-blue-900/30 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Profiles
              </p>
              <h2 className="text-3xl font-extrabold text-blue-950 mt-1.5">
                {teachers.length}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Registered in database
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-900 group-hover:scale-110 transition-transform text-xl shadow-inner">
              👥
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-blue-900/30 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Active Teachers
              </p>
              <h2 className="text-3xl font-extrabold text-blue-950 mt-1.5">
                {totalTeachersCount}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Classroom instructors
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-900 group-hover:scale-110 transition-transform text-xl shadow-inner">
              👨‍🏫
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-blue-900/30 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                System Admins
              </p>
              <h2 className="text-3xl font-extrabold text-blue-950 mt-1.5">
                {totalAdminsCount}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Elevated privileges
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-900 group-hover:scale-110 transition-transform text-xl shadow-inner">
              🛡️
            </div>
          </div>
        </div>

        {/* Directory Table Box */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-blue-950 tracking-tight">
                Faculty Directory
              </h2>
              <p className="text-slate-500 text-sm mt-1 font-medium">
                Showing {filteredTeachers.length} matching accounts
              </p>
            </div>

            <div className="w-full xl:w-auto">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full xl:w-48 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-900 shadow-sm cursor-pointer"
              >
                <option value="All">All Roles</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Search Bar Row */}
          <div className="px-6 py-4 border-b border-slate-100 bg-white">
            <input
              type="text"
              placeholder="Search by instructor name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-800 outline-none focus:border-blue-900 shadow-inner w-full transition-all"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-blue-900/10 text-blue-950 text-sm font-bold uppercase tracking-wider border-b border-blue-900/20">
                  <th className="p-5">Instructor Profile</th>
                  <th className="p-5">Email Address</th>
                  <th className="p-5">Role Permission</th>
                  <th className="p-5">Account Status</th>
                  <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-base">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-12 text-center text-slate-400 font-medium"
                    >
                      Loading instructors directory...
                    </td>
                  </tr>
                ) : paginatedTeachers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-12 text-center text-slate-400 font-medium"
                    >
                      No instructors match your search.
                    </td>
                  </tr>
                ) : (
                  paginatedTeachers.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-blue-50/40 transition-colors"
                    >
                      <td className="p-5 font-bold text-slate-900 flex items-center gap-3.5">
                        {t.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.avatar_url}
                            alt="Avatar"
                            className="w-11 h-11 rounded-full border border-slate-300 object-cover shadow-sm"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-blue-900 text-white font-bold flex items-center justify-center uppercase text-base shadow-sm">
                            {t.username ? t.username.charAt(0) : "T"}
                          </div>
                        )}
                        <div>
                          <div className="font-extrabold text-blue-950 text-base">
                            {t.username || "Unnamed Instructor"}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            ID: {t.id}
                          </div>
                        </div>
                      </td>
                      <td className="p-5 text-slate-700 font-medium text-sm">
                        {t.email || "No email provided"}
                      </td>
                      <td className="p-5">
                        <span
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider ${
                            t.role === "admin"
                              ? "bg-purple-100 text-purple-800 border border-purple-200 shadow-xs"
                              : "bg-slate-100 text-slate-700 border border-slate-200 shadow-xs"
                          }`}
                        >
                          {t.role || "teacher"}
                        </span>
                      </td>
                      <td className="p-5">
                        <span className="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
                          Active
                        </span>
                      </td>
                      <td className="p-5 text-right">
                        <button
                          onClick={() => setTargetTeacher(t)}
                          className="bg-white hover:bg-blue-900 hover:text-white text-blue-900 font-bold px-4 py-2 rounded-full text-xs border border-blue-200 transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                        >
                          <span>Toggle Role</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Button */}
          {filteredTeachers.length > visibleCount && (
            <div className="p-6 bg-slate-50/80 border-t border-slate-100 text-center">
              <button
                onClick={() => setVisibleCount((prev) => prev + 15)}
                className="bg-white hover:bg-slate-100 text-blue-900 border border-slate-200 font-bold px-8 py-3 rounded-xl shadow-sm transition-all text-sm cursor-pointer inline-flex items-center gap-2"
              >
                <span>Show More Records</span>
                <span className="text-xs bg-blue-50 px-2.5 py-0.5 rounded-full text-blue-700 font-extrabold">
                  Showing {paginatedTeachers.length} of{" "}
                  {filteredTeachers.length}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
