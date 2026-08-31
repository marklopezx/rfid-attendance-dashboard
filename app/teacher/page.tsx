"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
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
    full_name?: string;
    program: string;
    section: string;
    year_level: string | number;
  };
}

interface TerminalData {
  device_id: string;
  is_active: boolean;
  last_seen: string | null;
}

type SortKey =
  | "time"
  | "student_number"
  | "name"
  | "program"
  | "year_section"
  | "subject"
  | "status";
type SortConfigType = { key: SortKey; direction: "asc" | "desc" } | null;

// Only showing your actual built hardware scanner (add others here as you build them)
const AVAILABLE_ROOMS = [
  { id: "Smart_Classroom_1", name: "Smart Classroom 1" },
  { id: "Smart_Classroom_2", name: "Smart Classroom 2" },
  { id: "Smart_Classroom_3", name: "Smart Classroom 3" },
  { id: "Smart_Classroom_4", name: "Smart Classroom 4" },
];

// Helper: Format time to AM/PM
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

// Helper: Format Student Name as "Surname, First Name Middle"
const formatStudentName = (student?: AttendanceLog["students"]) => {
  if (!student) return "Unknown";
  if (student.last_name && student.first_name) {
    const middle = student.middle_name ? ` ${student.middle_name}` : "";
    return `${student.last_name}, ${student.first_name}${middle}`.trim();
  }
  return student.full_name || "Unknown";
};

// SortIcon component declared outside the main component scope
const SortIcon = ({
  columnKey,
  sortConfig,
}: {
  columnKey: SortKey;
  sortConfig: SortConfigType;
}) => {
  if (sortConfig?.key !== columnKey) {
    return (
      <span className="text-blue-200 opacity-0 group-hover:opacity-100 ml-1 transition-opacity">
        ↕
      </span>
    );
  }
  return (
    <span className="text-blue-900 ml-1 font-extrabold">
      {sortConfig.direction === "asc" ? "↑" : "↓"}
    </span>
  );
};

export default function TeacherDashboard() {
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  // Toast Notification State
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Session Control State
  const [isClassActive, setIsClassActive] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(AVAILABLE_ROOMS[0].id);
  const [inputSubject, setInputSubject] = useState("");
  const [inputStartTime, setInputStartTime] = useState("");
  const [inputEndTime, setInputEndTime] = useState("");

  // History & UI States
  const [subjectHistory, setSubjectHistory] = useState<string[]>([]);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfigType>(null);

  // Data State
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [terminals, setTerminals] = useState<TerminalData[]>([]);
  const [loading, setLoading] = useState(true);

  // Live ticking clock for tracking scanner offline status
  const [nowTime, setNowTime] = useState<number>(() => Date.now());

  // Filter States
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [filterSubject, setFilterSubject] = useState("All");
  const [filterSection, setFilterSection] = useState("All");
  const [filterYear, setFilterYear] = useState("All");

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const initPortal = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role !== "teacher") {
        router.push("/");
        return;
      }

      const email = session.user.email || "";
      setUserEmail(email);
      setIsAuthenticating(false);

      const savedSubjects = localStorage.getItem(`teacher_subjects_${email}`);
      if (savedSubjects) setSubjectHistory(JSON.parse(savedSubjects));

      // Find if this specific teacher currently has an active session running in ANY room
      const { data: activeClass } = await supabase
        .from("active_classes")
        .select("*")
        .eq("teacher_email", email)
        .eq("is_active", true)
        .maybeSingle();

      if (activeClass) {
        setIsClassActive(true);
        setSelectedDevice(activeClass.device_id); // Set the dropdown to the room they are using
        setInputSubject(activeClass.subject || "");
        if (activeClass.subject) setFilterSubject(activeClass.subject);
      }
    };
    initPortal();
  }, [router]);

  useEffect(() => {
    if (isAuthenticating) return;
    let isMounted = true;

    async function fetchSystemData(isInitial = false) {
      try {
        if (isInitial && isMounted) setLoading(true);

        // Fetch both the logs AND the active hardware terminals status concurrently
        const [logsRes, { data: activeData }] = await Promise.all([
          fetch("/api/logs"),
          supabase
            .from("active_classes")
            .select("device_id, is_active, last_seen"),
        ]);

        const logsData = await logsRes.json();

        if (isMounted) {
          if (logsData.success) setLogs(logsData.logs);
          if (activeData) setTerminals(activeData);
        }
      } catch (error) {
        console.error("Failed to sync system data", error);
        if (isMounted && isInitial)
          showToast("Failed to connect to live stream.", "error");
      } finally {
        if (isInitial && isMounted) setLoading(false);
      }
    }

    fetchSystemData(true);
    const dataInterval = setInterval(() => fetchSystemData(false), 3000);
    const timeInterval = setInterval(() => setNowTime(Date.now()), 1000);

    return () => {
      isMounted = false;
      clearInterval(dataInterval);
      clearInterval(timeInterval);
    };
  }, [isAuthenticating]);

  const saveToHistory = (subject: string) => {
    if (!userEmail) return;
    if (subject && !subjectHistory.includes(subject)) {
      const updatedSubjects = [...subjectHistory, subject];
      setSubjectHistory(updatedSubjects);
      localStorage.setItem(
        `teacher_subjects_${userEmail}`,
        JSON.stringify(updatedSubjects),
      );
    }
  };

  const removeSubjectFromHistory = (
    subjectToRemove: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const updatedSubjects = subjectHistory.filter(
      (sub) => sub !== subjectToRemove,
    );
    setSubjectHistory(updatedSubjects);
    if (userEmail) {
      localStorage.setItem(
        `teacher_subjects_${userEmail}`,
        JSON.stringify(updatedSubjects),
      );
    }
    showToast(`Removed "${subjectToRemove}" from history.`, "info");
  };

  // Check if the currently selected room is online (Timezone safe)
  const isSelectedDeviceOnline = useMemo(() => {
    const terminal = terminals.find((t) => t.device_id === selectedDevice);
    if (!terminal || !terminal.last_seen) return false;

    let lastSeenTime = new Date(terminal.last_seen).getTime();
    if (lastSeenTime > nowTime + 3600000) lastSeenTime -= 8 * 60 * 60 * 1000;

    const diffSeconds = (nowTime - lastSeenTime) / 1000;
    return diffSeconds >= -2 && diffSeconds < 18;
  }, [terminals, selectedDevice, nowTime]);

  const handleToggleClass = async (turnOn: boolean) => {
    if (turnOn && (!inputSubject.trim() || !inputStartTime || !inputEndTime)) {
      showToast("Please specify the Subject and the Class Schedule.", "error");
      return;
    }

    let endTimestamp = null;
    if (turnOn) {
      const now = new Date();
      const phDate = new Date(now.getTime() + 8 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      endTimestamp = `${phDate}T${inputEndTime}:00+08:00`;
      saveToHistory(inputSubject.trim());
    }

    // Update the active status specifically for the room selected in the dropdown
    const { error } = await supabase
      .from("active_classes")
      .update({
        is_active: turnOn,
        subject: turnOn ? inputSubject.trim() : null,
        section: null,
        teacher_email: turnOn ? userEmail : null,
        end_time: endTimestamp,
      })
      .eq("device_id", selectedDevice);

    if (error) {
      showToast(
        `Database error updating room ${selectedDevice}. Check permissions.`,
        "error",
      );
      return;
    }

    setIsClassActive(turnOn);

    if (turnOn) {
      setFilterSubject(inputSubject.trim());
      showToast(
        `Class session started successfully in ${selectedDevice.replace(/_/g, " ")}!`,
        "success",
      );
    } else {
      setInputSubject("");
      setInputStartTime("");
      setInputEndTime("");
      showToast(
        `Class session ended for ${selectedDevice.replace(/_/g, " ")}.`,
        "info",
      );
    }
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

  const resetFilters = () => {
    setSelectedDate(today);
    setFilterSubject("All");
    setFilterSection("All");
    setFilterYear("All");
    setSortConfig(null);
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null;
      }
      return { key, direction: "asc" };
    });
  };

  const teacherLogs = useMemo(
    () => logs.filter((log) => log.teacher_email === userEmail),
    [logs, userEmail],
  );

  const uniqueSubjects = useMemo(
    () =>
      Array.from(
        new Set(teacherLogs.map((log) => log.subject).filter(Boolean)),
      ),
    [teacherLogs],
  );
  const uniqueSections = useMemo(
    () =>
      Array.from(
        new Set(
          teacherLogs.map((log) => log.students?.section).filter(Boolean),
        ),
      ),
    [teacherLogs],
  );
  const uniqueYears = useMemo(
    () =>
      Array.from(
        new Set(
          teacherLogs.map((log) => log.students?.year_level).filter(Boolean),
        ),
      ),
    [teacherLogs],
  );

  const filteredLogs = useMemo(() => {
    let result = teacherLogs.filter((log) => {
      const matchesDate = log.attendance_date === selectedDate;
      const matchesSubject =
        filterSubject === "All" || log.subject === filterSubject;
      const matchesSection =
        filterSection === "All" || log.students?.section === filterSection;
      const matchesYear =
        filterYear === "All" ||
        String(log.students?.year_level) === String(filterYear);
      return matchesDate && matchesSubject && matchesSection && matchesYear;
    });

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const { key, direction } = sortConfig;
        const modifier = direction === "asc" ? 1 : -1;

        switch (key) {
          case "time":
            return (
              a.attendance_time.localeCompare(b.attendance_time) * modifier
            );
          case "student_number":
            return (
              (a.students?.student_number || "").localeCompare(
                b.students?.student_number || "",
              ) * modifier
            );
          case "name":
            return (
              formatStudentName(a.students).localeCompare(
                formatStudentName(b.students),
              ) * modifier
            );
          case "program":
            return (
              (a.students?.program || "").localeCompare(
                b.students?.program || "",
              ) * modifier
            );
          case "year_section":
            return (
              (a.students?.section || "").localeCompare(
                b.students?.section || "",
              ) * modifier
            );
          case "subject":
            return (a.subject || "").localeCompare(b.subject || "") * modifier;
          case "status":
            return a.status.localeCompare(b.status) * modifier;
          default:
            return 0;
        }
      });
    } else {
      // Default: Alphabetical by student surname
      result = [...result].sort((a, b) => {
        const nameA = formatStudentName(a.students).toLowerCase();
        const nameB = formatStudentName(b.students).toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }
    return result;
  }, [
    teacherLogs,
    selectedDate,
    filterSubject,
    filterSection,
    filterYear,
    sortConfig,
  ]);

  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      showToast("No attendance records to export!", "error");
      return;
    }

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
        `"${log.subject || "N/A"}"`,
        log.status,
      ].join(","),
    );

    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute(
      "download",
      `Attendance_${selectedDate}_${filterSubject === "All" ? "AllSubjects" : filterSubject}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("CSV Exported successfully!", "success");
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
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 sm:p-8 font-sans selection:bg-blue-200 relative pb-20">
      {/* Ambient Decorative Background */}
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none z-0"></div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] font-bold flex items-center gap-3 transition-all transform scale-100 animate-fade-in-up ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : toast.type === "error"
                ? "bg-rose-600 text-white"
                : "bg-blue-950 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* HEADER BOX */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200/60 p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-900 text-xs font-bold uppercase tracking-wider mb-3 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-blue-900 animate-pulse"></span>{" "}
              Instructor Portal
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-950 tracking-tight">
              Classroom Dashboard
            </h1>
            <p className="text-slate-500 text-base mt-2 font-medium">
              Welcome back,{" "}
              <span className="font-bold text-slate-800">{userEmail}</span>
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-slate-600 hover:text-rose-600 text-sm font-bold transition-all bg-white hover:bg-rose-50 px-6 py-3 rounded-xl border border-slate-200 hover:border-rose-200 shadow-sm"
          >
            Sign Out
          </button>
        </div>

        {/* SESSION CONTROL CARD */}
        <div
          className={`p-6 sm:p-8 rounded-3xl border transition-all duration-500 ${
            isClassActive
              ? "bg-gradient-to-br from-blue-50/80 via-white to-white border-blue-200 shadow-[0_8px_30px_rgba(30,58,138,0.1)]"
              : "bg-white border-slate-200 shadow-sm"
          }`}
        >
          <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
            <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-6 xl:pr-10">
              {/* ROOM SELECTION INPUT */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Select Room / Scanner
                </label>
                <select
                  value={selectedDevice}
                  onChange={(e) => setSelectedDevice(e.target.value)}
                  disabled={isClassActive}
                  className={`w-full border rounded-xl px-4 py-3.5 text-base font-bold outline-none disabled:opacity-60 focus:ring-4 focus:ring-blue-900/15 shadow-inner transition-all appearance-none ${
                    isSelectedDeviceOnline
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700 focus:border-emerald-500"
                      : "bg-rose-50 border-rose-200 text-rose-600 focus:border-rose-500"
                  }`}
                >
                  {AVAILABLE_ROOMS.map((room) => {
                    const term = terminals.find((t) => t.device_id === room.id);
                    let isRoomOnline = false;
                    if (term && term.last_seen) {
                      let lastSeenTime = new Date(term.last_seen).getTime();
                      if (lastSeenTime > nowTime + 3600000)
                        lastSeenTime -= 8 * 60 * 60 * 1000;
                      isRoomOnline = (nowTime - lastSeenTime) / 1000 < 18;
                    }
                    return (
                      <option
                        key={room.id}
                        value={room.id}
                        className={
                          isRoomOnline
                            ? "text-emerald-700 font-bold bg-white"
                            : "text-rose-600 font-bold bg-white"
                        }
                      >
                        {room.name} {isRoomOnline ? "(Online)" : "(Offline)"}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* SUBJECT INPUT */}
              <div className="relative">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Subject Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g., Data Structures"
                    value={inputSubject}
                    onChange={(e) => setInputSubject(e.target.value)}
                    onFocus={() => setShowSubjectDropdown(true)}
                    onBlur={() =>
                      setTimeout(() => setShowSubjectDropdown(false), 200)
                    }
                    disabled={isClassActive}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:border-blue-900 focus:ring-4 focus:ring-blue-900/15 outline-none disabled:opacity-60 pr-8 transition-all shadow-inner"
                  />
                </div>

                {showSubjectDropdown &&
                  subjectHistory.length > 0 &&
                  !isClassActive && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
                      {subjectHistory.map((sub) => (
                        <div
                          key={sub}
                          className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 cursor-pointer transition-colors group"
                          onMouseDown={() => setInputSubject(sub)}
                        >
                          <span className="font-medium text-slate-700 px-2 py-2 flex-1">
                            {sub}
                          </span>

                          <button
                            onMouseDown={(e) =>
                              removeSubjectFromHistory(sub, e)
                            }
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-100 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Remove from history"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2.5"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              {/* SCHEDULE INPUT */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Class Schedule
                </label>
                <div
                  className={`flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus-within:border-blue-900 focus-within:ring-4 focus-within:ring-blue-900/15 transition-all shadow-inner ${isClassActive ? "opacity-60 pointer-events-none bg-slate-100" : ""}`}
                >
                  <input
                    type="time"
                    value={inputStartTime}
                    onChange={(e) => setInputStartTime(e.target.value)}
                    className="bg-transparent outline-none w-full text-slate-800 font-medium"
                    style={{ colorScheme: "light" }}
                  />
                  <span className="font-bold text-slate-300">-</span>
                  <input
                    type="time"
                    value={inputEndTime}
                    onChange={(e) => setInputEndTime(e.target.value)}
                    className="bg-transparent outline-none w-full text-slate-800 font-medium"
                    style={{ colorScheme: "light" }}
                  />
                </div>
              </div>
            </div>

            <div className="w-full xl:w-auto xl:min-w-[280px]">
              {isClassActive ? (
                <button
                  onClick={() => handleToggleClass(false)}
                  className="w-full bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-bold py-4 px-8 rounded-2xl shadow-[0_8px_20px_rgba(225,29,72,0.3)] hover:shadow-[0_10px_25px_rgba(225,29,72,0.4)] flex items-center justify-center gap-3 transition-all transform hover:-translate-y-0.5"
                >
                  <span className="w-3 h-3 bg-white rounded-full animate-pulse shadow-sm"></span>{" "}
                  End Class Session
                </button>
              ) : (
                <button
                  onClick={() => handleToggleClass(true)}
                  disabled={!isSelectedDeviceOnline}
                  className={`w-full font-bold py-4 px-8 rounded-2xl shadow-[0_8px_20px_rgba(30,58,138,0.3)] transition-all transform ${
                    isSelectedDeviceOnline
                      ? "bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-950 hover:to-indigo-950 text-white hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(30,58,138,0.4)] cursor-pointer"
                      : "bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed shadow-none"
                  }`}
                >
                  {isSelectedDeviceOnline
                    ? "Start Class Session"
                    : "Scanner Offline - Cannot Start"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* DATA TABLE SECTION */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-blue-950">
                  Live Attendance Stream
                </h2>
                <p className="text-slate-500 mt-1 font-medium">
                  Showing {filteredLogs.length} records sorted alphabetically by
                  surname.
                </p>
              </div>

              <div className="flex gap-3 w-full lg:w-auto">
                <button
                  onClick={resetFilters}
                  className="bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all w-full lg:w-auto text-base"
                >
                  Reset Filters
                </button>
                <button
                  onClick={exportToCSV}
                  className="bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-950 font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all w-full lg:w-auto text-base"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {/* Filter Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-slate-200">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-800 outline-none focus:border-blue-900 shadow-sm transition-all"
                style={{ colorScheme: "light" }}
              />

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
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-blue-900/10 text-blue-950 text-sm font-bold uppercase tracking-wider border-b border-blue-900/20 cursor-pointer select-none">
                  <th
                    className="p-5 hover:bg-blue-900/20 group transition-colors"
                    onClick={() => handleSort("time")}
                  >
                    Time <SortIcon columnKey="time" sortConfig={sortConfig} />
                  </th>
                  <th
                    className="p-5 hover:bg-blue-900/20 group transition-colors"
                    onClick={() => handleSort("student_number")}
                  >
                    Student Number{" "}
                    <SortIcon
                      columnKey="student_number"
                      sortConfig={sortConfig}
                    />
                  </th>
                  <th
                    className="p-5 hover:bg-blue-900/20 group transition-colors"
                    onClick={() => handleSort("name")}
                  >
                    Student Name (Surname First){" "}
                    <SortIcon columnKey="name" sortConfig={sortConfig} />
                  </th>
                  <th
                    className="p-5 hover:bg-blue-900/20 group transition-colors"
                    onClick={() => handleSort("program")}
                  >
                    Program{" "}
                    <SortIcon columnKey="program" sortConfig={sortConfig} />
                  </th>
                  <th
                    className="p-5 hover:bg-blue-900/20 group transition-colors"
                    onClick={() => handleSort("year_section")}
                  >
                    Yr & Sec{" "}
                    <SortIcon
                      columnKey="year_section"
                      sortConfig={sortConfig}
                    />
                  </th>
                  <th
                    className="p-5 hover:bg-blue-900/20 group transition-colors"
                    onClick={() => handleSort("subject")}
                  >
                    Subject{" "}
                    <SortIcon columnKey="subject" sortConfig={sortConfig} />
                  </th>
                  <th
                    className="p-5 hover:bg-blue-900/20 group transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    Status{" "}
                    <SortIcon columnKey="status" sortConfig={sortConfig} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-base">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400">
                      Syncing live records...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="p-12 text-center text-slate-400 font-medium"
                    >
                      No records match your active filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-blue-50/50 transition-colors"
                    >
                      <td className="p-5 text-slate-700 font-mono text-sm font-bold whitespace-nowrap">
                        {formatTimeAMPM(log.attendance_time)}
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
                      <td className="p-5">
                        <span className="px-4 py-1.5 rounded-md text-sm font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
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
