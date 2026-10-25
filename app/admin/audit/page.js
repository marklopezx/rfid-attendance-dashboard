"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(15);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let isMounted = true;
    async function loadAuditLogs() {
      // Updated to query your exact 'attendance' table
      const { data, error } = await supabase
        .from("attendance")
        .select(
          "id, attendance_date, attendance_time, status, subject, device_id, teacher_email",
        )
        .order("attendance_date", { ascending: false })
        .order("attendance_time", { ascending: false })
        .limit(100);

      if (isMounted) {
        if (!error && data) setLogs(data);
        setLoading(false);
      }
    }
    loadAuditLogs();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const subject = (l.subject || "").toLowerCase();
      const teacher = (l.teacher_email || "").toLowerCase();
      const device = (l.device_id || "").toLowerCase();
      const search = searchTerm.toLowerCase();
      return (
        subject.includes(search) ||
        teacher.includes(search) ||
        device.includes(search)
      );
    });
  }, [logs, searchTerm]);

  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(0, visibleCount);
  }, [filteredLogs, visibleCount]);

  const uniqueInstructorsCount = useMemo(() => {
    return new Set(logs.map((l) => l.teacher_email).filter(Boolean)).size;
  }, [logs]);

  const uniqueTerminalsCount = useMemo(() => {
    return new Set(logs.map((l) => l.device_id).filter(Boolean)).size;
  }, [logs]);

  return (
    <div className="relative overflow-y-auto h-full p-6 sm:p-10 pb-20 font-sans">
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-slate-200/40 to-transparent pointer-events-none z-0"></div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider mb-3 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-slate-700"></span>
              Security & Compliance Center
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              Security Audit Trail
            </h1>
            <p className="text-slate-500 text-base mt-2 font-medium">
              Comprehensive security activity logs, terminal verification
              events, and system access history.
            </p>
          </div>
        </div>

        {/* Telemetry Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Total Audit Records
              </p>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-1.5">
                {logs.length}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Logged system events
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-600 group-hover:scale-105 transition-transform text-xl shadow-2xs">
              🛡️
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Instructors
              </p>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-1.5">
                {uniqueInstructorsCount}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Recorded in logs
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-600 group-hover:scale-105 transition-transform text-xl shadow-2xs">
              👨‍🏫
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-slate-300 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Reporting Terminals
              </p>
              <h2 className="text-3xl font-extrabold text-slate-900 mt-1.5">
                {uniqueTerminalsCount}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Unique room devices
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-600 group-hover:scale-105 transition-transform text-xl shadow-2xs">
              📡
            </div>
          </div>
        </div>

        {/* Audit Table Box */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                System Activity Logs
              </h2>
              <p className="text-slate-500 text-sm mt-1 font-medium">
                Showing {filteredLogs.length} matching event entries
              </p>
            </div>
          </div>

          {/* Search Bar Row */}
          <div className="px-6 py-4 border-b border-slate-100 bg-white">
            <input
              type="text"
              placeholder="Search by subject, instructor, or terminal device..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-800 outline-none focus:border-slate-400 shadow-inner w-full transition-all"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-100/75 text-slate-900 text-sm font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="p-5">Timestamp</th>
                  <th className="p-5">Subject</th>
                  <th className="p-5">Instructor Email</th>
                  <th className="p-5">Terminal Device</th>
                  <th className="p-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-base">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-12 text-center text-slate-400 font-medium"
                    >
                      Loading security audit trail...
                    </td>
                  </tr>
                ) : paginatedLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-12 text-center text-slate-400 font-medium"
                    >
                      No audit records found.
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((l) => (
                    <tr
                      key={l.id}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="p-5 text-slate-700 font-mono text-sm font-bold whitespace-nowrap">
                        {l.attendance_date}{" "}
                        <span className="text-slate-900 font-bold ml-1">
                          {l.attendance_time}
                        </span>
                      </td>
                      <td className="p-5 font-bold text-slate-900">
                        {l.subject || "General"}
                      </td>
                      <td className="p-5 text-slate-600 font-medium text-sm">
                        {l.teacher_email || "N/A"}
                      </td>
                      <td className="p-5 font-mono text-xs text-slate-700 font-bold uppercase">
                        {l.device_id?.replace(/_/g, " ") || "N/A"}
                      </td>
                      <td className="p-5">
                        <span className="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Button */}
          {filteredLogs.length > visibleCount && (
            <div className="p-6 bg-slate-50/80 border-t border-slate-100 text-center">
              <button
                onClick={() => setVisibleCount((prev) => prev + 15)}
                className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold px-8 py-3 rounded-xl shadow-sm transition-all text-sm cursor-pointer inline-flex items-center gap-2"
              >
                <span>Show More Records</span>
                <span className="text-xs bg-slate-100 px-2.5 py-0.5 rounded-full text-slate-700 font-extrabold">
                  Showing {paginatedLogs.length} of {filteredLogs.length}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
