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
  teacher_email?: string;
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

interface TerminalData {
  device_id: string;
  subject: string | null;
  section: string | null;
  is_active: boolean;
  teacher_email: string | null;
  last_seen: string | null;
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

  // Array to hold all hardware terminals connected to the system
  const [terminals, setTerminals] = useState<TerminalData[]>([]);
  // Live ticking clock initialized lazily to satisfy React purity rules
  const [nowTime, setNowTime] = useState<number>(() => Date.now());

  // Get today's date correctly in Philippine Time (UTC+8)
  const now = new Date();
  const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const today = phTime.toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(today);
  const [filterTeacher, setFilterTeacher] = useState("All");
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
        if (isMounted && data.success) {
          setLogs(data.logs);
        }

        // Fetch all registered terminals instead of just one
        const { data: activeData, error: activeError } = await supabase
          .from("active_classes")
          .select("*")
          .order("device_id");

        if (isMounted && !activeError && activeData) {
          setTerminals(activeData);
        }
      } catch {
        // Suppress network errors from breaking UI
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSystemData();
    const dataInterval = setInterval(fetchSystemData, 3000);
    const timeInterval = setInterval(() => setNowTime(Date.now()), 1000); // 1-second tick for heartbeat

    return () => {
      isMounted = false;
      clearInterval(dataInterval);
      clearInterval(timeInterval);
    };
  }, [isAuthenticating]);

  const uniqueTeachers = useMemo(() => {
    return Array.from(
      new Set(logs.map((log) => log.teacher_email).filter(Boolean)),
    );
  }, [logs]);

  // Dynamically filter options based on selected teacher so dropdowns cascade
  const teacherFilteredLogsForDropdowns = useMemo(() => {
    if (filterTeacher === "All") return logs;
    return logs.filter((log) => log.teacher_email === filterTeacher);
  }, [logs, filterTeacher]);

  const uniqueSubjects = useMemo(() => {
    return Array.from(
      new Set(
        teacherFilteredLogsForDropdowns
          .map((log) => log.subject)
          .filter(Boolean),
      ),
    );
  }, [teacherFilteredLogsForDropdowns]);

  const uniqueYears = useMemo(() => {
    return Array.from(
      new Set(
        teacherFilteredLogsForDropdowns
          .map((log) => log.students?.year_level)
          .filter(Boolean),
      ),
    );
  }, [teacherFilteredLogsForDropdowns]);

  const uniqueSections = useMemo(() => {
    return Array.from(
      new Set(
        teacherFilteredLogsForDropdowns
          .map((log) => log.students?.section)
          .filter(Boolean),
      ),
    );
  }, [teacherFilteredLogsForDropdowns]);

  const filteredLogs = useMemo(() => {
    const result = logs.filter((log) => {
      const logDate = log.attendance_date
        ? log.attendance_date.split("T")[0]
        : "";
      const matchesDate = logDate === selectedDate;

      const matchesTeacher =
        filterTeacher === "All" || log.teacher_email === filterTeacher;
      const matchesSubject =
        filterSubject === "All" || log.subject === filterSubject;
      const matchesYear =
        filterYear === "All" ||
        String(log.students?.year_level) === String(filterYear);
      const matchesSection =
        filterSection === "All" || log.students?.section === filterSection;

      return (
        matchesDate &&
        matchesTeacher &&
        matchesSubject &&
        matchesYear &&
        matchesSection
      );
    });

    return result.sort((a, b) => {
      const nameA = formatStudentName(a.students).toLowerCase();
      const nameB = formatStudentName(b.students).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [
    logs,
    selectedDate,
    filterTeacher,
    filterSubject,
    filterYear,
    filterSection,
  ]);

  // Total scans dynamically reflecting the currently selected date and filters
  const totalScansForSelectedDate = useMemo(() => {
    return filteredLogs.length;
  }, [filteredLogs]);

  // Calculate live global stats for the cards (Timezone safe)
  const onlineTerminalsCount = terminals.filter((t) => {
    if (!t.last_seen) return false;
    let lastSeenTime = new Date(t.last_seen).getTime();
    if (lastSeenTime > nowTime + 3600000) lastSeenTime -= 8 * 60 * 60 * 1000;

    const diffSeconds = (nowTime - lastSeenTime) / 1000;
    return diffSeconds >= -2 && diffSeconds < 18;
  }).length;

  const activeSessionsCount = terminals.filter((t) => t.is_active).length;

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
      "Instructor",
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
        `"${log.teacher_email || "N/A"}"`,
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

  if (isAuthenticating) return <div className="min-h-screen bg-slate-50"></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 sm:p-10 font-sans relative overflow-hidden selection:bg-blue-200 pb-20">
      {/* Ambient Light Navy Blue Background Gradient */}
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none z-0"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200/60 p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-900 text-xs font-bold uppercase tracking-wider mb-3 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-blue-900 animate-pulse"></span>
              Admin Control Center
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-blue-950">
              System Operations
            </h1>
            <p className="text-slate-500 text-base mt-2 font-medium">
              Monitor multi-room hardware telemetry, live sessions, and master
              audit logs.
            </p>
          </div>

          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            <Link
              href="/students"
              className="group bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-950 hover:to-indigo-950 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all shadow-[0_8px_20px_rgba(30,58,138,0.3)] flex items-center gap-2"
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
                  strokeWidth="2.5"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                ></path>
              </svg>
              Student Registry
            </Link>
            <button
              onClick={handleSignOut}
              className="text-slate-600 hover:text-rose-600 text-sm font-bold transition-all bg-white hover:bg-rose-50 px-6 py-3 rounded-xl border border-slate-200 hover:border-rose-200 shadow-sm"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Global Telemetry Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Scans Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-blue-900/30 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Filtered Scans
              </p>
              <h2 className="text-3xl font-extrabold text-blue-950 mt-1.5">
                {totalScansForSelectedDate}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                For selected date
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-900 group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
            </div>
          </div>

          {/* Global DB Records */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-blue-900/30 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Global DB Logs
              </p>
              <h2 className="text-3xl font-extrabold text-blue-950 mt-1.5">
                {logs.length}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                All time records
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-900 group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                ></path>
              </svg>
            </div>
          </div>

          {/* Active Hardware */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-blue-900/30 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Live Hardware
              </p>
              <h2 className="text-3xl font-extrabold text-blue-950 mt-1.5">
                {onlineTerminalsCount}{" "}
                <span className="text-lg text-slate-400">
                  / {terminals.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Terminals Online
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-900 group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                ></path>
              </svg>
            </div>
          </div>

          {/* Active Sessions */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group hover:border-blue-900/30 transition-colors">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Live Sessions
              </p>
              <h2 className="text-3xl font-extrabold text-blue-950 mt-1.5">
                {activeSessionsCount}
              </h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                Classes actively running
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-blue-900 group-hover:scale-110 transition-transform">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
            </div>
          </div>
        </div>

        {/* Multi-Room Hardware Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-extrabold text-blue-950 mb-4 flex items-center gap-2 tracking-tight">
            Connected Terminals
          </h2>

          {terminals.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-slate-500 font-medium shadow-sm">
              No hardware terminals registered in database yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {terminals.map((t) => {
                let isOnline = false;
                if (t.last_seen) {
                  let lastSeenTime = new Date(t.last_seen).getTime();
                  if (lastSeenTime > nowTime + 3600000)
                    lastSeenTime -= 8 * 60 * 60 * 1000;
                  const diffSeconds = (nowTime - lastSeenTime) / 1000;
                  isOnline = diffSeconds >= -2 && diffSeconds < 18;
                }

                return (
                  <div
                    key={t.device_id}
                    className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between group hover:border-blue-900/30 transition-all"
                  >
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <h3 className="text-lg font-bold text-blue-950 truncate max-w-[200px]">
                          {t.device_id.replace(/_/g, " ")}
                        </h3>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shadow-sm ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}
                          ></span>
                          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                            {isOnline ? "ONLINE" : "OFFLINE"}
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-slate-400 group-hover:text-blue-900 group-hover:bg-blue-50 group-hover:border-blue-100 transition-all">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                          ></path>
                        </svg>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-5 border-t border-slate-100">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Session
                        </p>
                        <p
                          className={`text-sm font-bold truncate ${t.is_active ? "text-blue-900" : "text-slate-700"}`}
                        >
                          {t.is_active ? t.subject : "Standby"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Instructor
                        </p>
                        <p className="text-sm font-bold text-slate-700 truncate">
                          {t.is_active && t.teacher_email
                            ? t.teacher_email.split("@")[0]
                            : "None"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-blue-950">
                  Master Audit Logs
                </h2>
                <p className="text-slate-500 mt-1 text-sm font-medium">
                  Real-time global record of all physical terminal taps.
                </p>
              </div>

              <button
                onClick={exportMasterCSV}
                className="bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-900 font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all w-full lg:w-auto text-base"
              >
                Export Master CSV ({filteredLogs.length})
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-6 border-t border-slate-200">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-800 outline-none focus:border-blue-900 shadow-sm transition-all"
                style={{ colorScheme: "light" }}
              />

              <select
                value={filterTeacher}
                onChange={(e) => setFilterTeacher(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-800 outline-none focus:border-blue-900 shadow-sm appearance-none transition-all"
              >
                <option value="All">All Instructors</option>
                {uniqueTeachers.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </select>

              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-800 outline-none focus:border-blue-900 shadow-sm appearance-none transition-all"
              >
                <option value="All">All Subjects</option>
                {uniqueSubjects.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>

              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-800 outline-none focus:border-blue-900 shadow-sm appearance-none transition-all"
              >
                <option value="All">All Years</option>
                {uniqueYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Year {yr}
                  </option>
                ))}
              </select>

              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-800 outline-none focus:border-blue-900 shadow-sm appearance-none transition-all"
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

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-blue-900/10 text-blue-950 text-sm font-bold uppercase tracking-wider border-b border-blue-900/20">
                  <th className="p-5">Timestamp</th>
                  <th className="p-5">Student Number</th>
                  <th className="p-5">Student Name</th>
                  <th className="p-5">Program</th>
                  <th className="p-5">Year & Section</th>
                  <th className="p-5">Subject Taught</th>
                  <th className="p-5">Instructor</th>
                  <th className="p-5">Terminal Room</th>
                  <th className="p-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-base">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-400">
                      Syncing encrypted logs...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-12 text-center text-slate-400 font-medium"
                    >
                      No records match your exact parameters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-blue-50/50 transition-colors"
                    >
                      <td className="p-5 text-slate-700 font-mono text-sm font-bold whitespace-nowrap">
                        {log.attendance_date}{" "}
                        <span className="text-blue-900 font-bold ml-1">
                          {formatTimeAMPM(log.attendance_time)}
                        </span>
                      </td>
                      <td className="p-5 font-bold text-blue-900 font-mono text-sm">
                        {log.students?.student_number || "Unknown"}
                      </td>
                      <td className="p-5 font-extrabold text-slate-900">
                        {formatStudentName(log.students)}
                      </td>
                      <td className="p-5 text-slate-600 font-medium">
                        {log.students?.program || "N/A"}
                      </td>
                      <td className="p-5">
                        <span className="bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200/60 text-slate-700 font-bold text-sm whitespace-nowrap shadow-sm">
                          Yr {log.students?.year_level || "?"} • Sec{" "}
                          {log.students?.section || "?"}
                        </span>
                      </td>
                      <td className="p-5 font-bold text-slate-700">
                        {log.subject || "General"}
                      </td>
                      <td className="p-5 font-medium text-slate-600 text-sm">
                        {log.teacher_email || "N/A"}
                      </td>
                      <td className="p-5 font-mono text-xs text-slate-500 font-bold uppercase">
                        {log.device_id?.replace(/_/g, " ") || "Unknown"}
                      </td>
                      <td className="p-5">
                        <span className="px-4 py-1.5 rounded-md text-sm font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
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
