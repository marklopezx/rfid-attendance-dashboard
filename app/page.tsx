"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface AttendanceLog {
  id: string | number;
  attendance_date: string;
  attendance_time: string;
  status: string;
  subject: string;
  device_id: string;
  students?: {
    student_number: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    full_name?: string; // Fallback for old records
    program: string;
    section: string;
    year_level: string | number;
  };
}

// Helper: Format student names as "Surname, First Name Middle"
const formatStudentName = (student?: AttendanceLog["students"]) => {
  if (!student) return "Unknown";
  if (student.last_name && student.first_name) {
    const middle = student.middle_name ? ` ${student.middle_name}` : "";
    return `${student.last_name}, ${student.first_name}${middle}`.trim();
  }
  return student.full_name || "Unknown";
};

// Helper: Format 24h time to 12h AM/PM format
const formatTimeAMPM = (timeStr: string) => {
  if (!timeStr) return "N/A";
  const [hour, minute] = timeStr.split(":");
  if (!hour || !minute) return timeStr;

  const date = new Date();
  date.setHours(parseInt(hour, 10));
  date.setMinutes(parseInt(minute, 10));

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceOnline, setDeviceOnline] = useState(true);
  const [activeClassSession, setActiveClassSession] = useState<{
    subject: string;
    section: string;
    is_active: boolean;
  } | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [filterSubject, setFilterSubject] = useState("All");
  const [filterYear, setFilterYear] = useState("All");
  const [filterSection, setFilterSection] = useState("All");

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return router.push("/login");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (profile?.role === "teacher") return router.push("/teacher");

      setIsAuthenticating(false);
    };
    checkUser();
  }, [router]);

  useEffect(() => {
    if (isAuthenticating) return;
    let isMounted = true;

    async function fetchSystemData() {
      try {
        const res = await fetch("/api/logs");
        const data = await res.json();
        if (isMounted && data.success) setLogs(data.logs);

        const { data: activeData } = await supabase
          .from("active_classes")
          .select("*")
          .eq("device_id", "Smart_Classroom_1")
          .single();
        if (isMounted && activeData) {
          setActiveClassSession(activeData);
          setDeviceOnline(true);
        }
      } catch {
        if (isMounted) setDeviceOnline(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSystemData();
    const intervalId = setInterval(fetchSystemData, 4000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [isAuthenticating]);

  const presentToday = useMemo(() => {
    return logs.filter((log) => log.attendance_date === today).length;
  }, [logs, today]);

  const uniqueSubjects = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.subject).filter(Boolean)));
  }, [logs]);

  const uniqueYears = useMemo(() => {
    return Array.from(
      new Set(logs.map((log) => log.students?.year_level).filter(Boolean)),
    );
  }, [logs]);

  const uniqueSections = useMemo(() => {
    return Array.from(
      new Set(logs.map((log) => log.students?.section).filter(Boolean)),
    );
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const result = logs.filter((log) => {
      const matchesDate = log.attendance_date === selectedDate;
      const matchesSubject =
        filterSubject === "All" || log.subject === filterSubject;
      const matchesYear =
        filterYear === "All" ||
        String(log.students?.year_level) === String(filterYear);
      const matchesSection =
        filterSection === "All" || log.students?.section === filterSection;
      return matchesDate && matchesSubject && matchesYear && matchesSection;
    });

    // Default sorting: Alphabetical by student surname
    return result.sort((a, b) => {
      const nameA = formatStudentName(a.students).toLowerCase();
      const nameB = formatStudentName(b.students).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [logs, selectedDate, filterSubject, filterYear, filterSection]);

  const exportMasterCSV = () => {
    if (filteredLogs.length === 0) return alert("No records to export!");
    const headers = [
      "Date",
      "Time",
      "Student Number",
      "Student Name",
      "Program",
      "Year Level",
      "Section",
      "Subject",
      "Status",
      "Terminal",
    ];
    const csvRows = filteredLogs.map((log) =>
      [
        log.attendance_date,
        formatTimeAMPM(log.attendance_time),
        log.students?.student_number || "Unknown",
        `"${formatStudentName(log.students)}"`,
        `"${log.students?.program || "Unknown"}"`,
        log.students?.year_level || "N/A",
        `"${log.students?.section || "Unknown"}"`,
        `"${log.subject || "General"}"`,
        log.status,
        log.device_id,
      ].join(","),
    );

    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Master_Audit_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Network error during sign out, forcing redirect:", error);
    } finally {
      router.push("/login");
    }
  };

  if (isAuthenticating)
    return <div className="min-h-screen bg-[#030712]"></div>;

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 p-6 sm:p-10 font-sans relative overflow-hidden selection:bg-cyan-500/30">
      {/* Ambient Glowing Orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 pb-6 border-b border-white/5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-3 tracking-widest uppercase shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              Admin Control Center
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              System Operations
            </h1>
            <p className="text-slate-400 text-sm mt-2 font-light">
              Monitor hardware telemetry, manage students, and audit master
              logs.
            </p>
          </div>

          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            <Link
              href="/students"
              className="group bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold px-5 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] flex items-center gap-2 border border-white/10"
            >
              <svg
                className="w-4 h-4 group-hover:scale-110 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                ></path>
              </svg>
              Student Registry
            </Link>
            <button
              onClick={handleSignOut}
              className="text-slate-400 hover:text-rose-400 text-xs font-semibold transition-colors flex items-center gap-2 bg-white/5 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10 hover:border-rose-500/30 hover:bg-rose-500/10"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Telemetry Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Card 1 */}
          <div className="bg-[#0f172a]/60 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.4)] flex items-center justify-between group hover:border-cyan-500/30 transition-colors">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Terminal Status
              </p>
              <h2 className="text-xl font-bold text-white mt-1.5 flex items-center gap-2.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] ${deviceOnline ? "bg-emerald-400 text-emerald-400 animate-pulse" : "bg-rose-500 text-rose-500"}`}
                ></span>
                {deviceOnline ? "ONLINE" : "OFFLINE"}
              </h2>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                Smart_Classroom_1
              </p>
            </div>
            <div className="bg-cyan-500/10 p-4 rounded-2xl border border-cyan-500/20 text-cyan-400 group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                ></path>
              </svg>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-[#0f172a]/60 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.4)] flex items-center justify-between group hover:border-indigo-500/30 transition-colors">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Active Session
              </p>
              <h2 className="text-lg font-bold text-indigo-300 mt-1.5 truncate max-w-[180px]">
                {activeClassSession?.is_active
                  ? activeClassSession.subject
                  : "Standby Mode"}
              </h2>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {activeClassSession?.is_active
                  ? `Target: ${activeClassSession.section}`
                  : "Awaiting Teacher"}
              </p>
            </div>
            <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-[#0f172a]/60 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.4)] flex items-center justify-between group hover:border-blue-500/30 transition-colors">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Total Scans
              </p>
              <h2 className="text-3xl font-extrabold text-white mt-1.5">
                {presentToday}
              </h2>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Global DB Records: {logs.length}
              </p>
            </div>
            <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 text-blue-400 group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
            </div>
          </div>
        </div>

        {/* Glassmorphic Table Container */}
        <div className="bg-[#0f172a]/60 backdrop-blur-3xl rounded-3xl border border-white/10 overflow-hidden shadow-[0_8px_40px_rgb(0,0,0,0.5)]">
          <div className="p-6 sm:p-8 border-b border-white/5 bg-white/[0.01]">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">
                  Master Audit Logs
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Real-time global record of all physical terminal taps
                  (Alphabetical).
                </p>
              </div>

              <button
                onClick={exportMasterCSV}
                className="bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-5 py-3 rounded-xl border border-white/10 transition-all flex items-center gap-2 ml-auto lg:ml-0"
              >
                <svg
                  className="w-4 h-4 text-cyan-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  ></path>
                </svg>
                Export Master CSV ({filteredLogs.length})
              </button>
            </div>

            {/* Premium Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Subject
                </label>
                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all appearance-none"
                >
                  <option value="All">All Subjects</option>
                  {uniqueSubjects.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Year Level
                </label>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all appearance-none"
                >
                  <option value="All">All Years</option>
                  {uniqueYears.map((yr) => (
                    <option key={yr} value={yr}>
                      Year {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Section
                </label>
                <select
                  value={filterSection}
                  onChange={(e) => setFilterSection(e.target.value)}
                  className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all appearance-none"
                >
                  <option value="All">All Sections</option>
                  {uniqueSections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0a0f1c]/50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-white/5">
                  <th className="p-5">Timestamp</th>
                  <th className="p-5">Student Number</th>
                  <th className="p-5">Student Name</th>
                  <th className="p-5">Program</th>
                  <th className="p-5">Year & Section</th>
                  <th className="p-5">Subject Taught</th>
                  <th className="p-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-500">
                      Syncing encrypted logs...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-500">
                      No records match your exact parameters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="p-5 font-mono text-slate-400 text-xs whitespace-nowrap">
                        {log.attendance_date}{" "}
                        <span className="text-cyan-400 font-semibold ml-1">
                          {formatTimeAMPM(log.attendance_time)}
                        </span>
                      </td>
                      <td className="p-5 font-mono text-cyan-400 text-xs font-bold">
                        {log.students?.student_number || "Unknown"}
                      </td>
                      <td className="p-5 font-semibold text-slate-200">
                        {formatStudentName(log.students)}
                      </td>
                      <td className="p-5 text-slate-400 text-xs">
                        {log.students?.program || "N/A"}
                      </td>
                      <td className="p-5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300 text-[11px] font-semibold tracking-wide whitespace-nowrap">
                          Year {log.students?.year_level || "?"}{" "}
                          <span className="text-white/20">•</span> Sec{" "}
                          {log.students?.section || "?"}
                        </span>
                      </td>
                      <td className="p-5 font-medium text-indigo-300 text-xs">
                        {log.subject || "General"}
                      </td>
                      <td className="p-5">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
