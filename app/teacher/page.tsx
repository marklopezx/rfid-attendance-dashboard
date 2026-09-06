"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  section?: string | null;
  device_id: string;
  teacher_email?: string;
  student_id?: string;
  students?: {
    id: string;
    student_number: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    full_name?: string;
    program: string;
    section: string;
    year_level: string | number;
    rfid_uid?: string;
  };
}

interface TerminalData {
  device_id: string;
  is_active: boolean;
  last_seen: string | null;
}

interface SubjectData {
  id: number;
  teacher_email: string;
  subject_name: string;
  section: string | null;
}

interface EnrolledStudent {
  id: string;
  student_number: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  full_name?: string;
  program: string;
  section: string;
  year_level: string | number;
  rfid_uid?: string;
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

const AVAILABLE_ROOMS = [
  { id: "Smart_Classroom_1", name: "Smart Classroom 1" },
  { id: "Smart_Classroom_2", name: "Smart Classroom 2" },
  { id: "Smart_Classroom_3", name: "Smart Classroom 3" },
  { id: "Smart_Classroom_4", name: "Smart Classroom 4" },
];

const formatTimeAMPM = (timeStr: string) => {
  if (!timeStr || timeStr === "00:00:00") return "";
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

const formatStudentName = (student?: {
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  full_name?: string;
}) => {
  if (!student) return "Unknown";
  if (student.last_name && student.first_name) {
    const middle = student.middle_name ? ` ${student.middle_name}` : "";
    return `${student.last_name}, ${student.first_name}${middle}`.trim();
  }
  return student.full_name || "Unknown";
};

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
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "subjects" | "reports" | "settings"
  >("dashboard");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // Custom Delete Modal State
  const [subjectToDelete, setSubjectToDelete] = useState<SubjectData | null>(
    null,
  );

  // Session Control State
  const [isClassActive, setIsClassActive] = useState(false);
  const [hasSessionRunToday, setHasSessionRunToday] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(AVAILABLE_ROOMS[0].id);
  const [inputSubject, setInputSubject] = useState("");
  const [inputStartTime, setInputStartTime] = useState("");
  const [inputEndTime, setInputEndTime] = useState("");

  // History & UI States
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfigType>(null);

  // Table Expansion States
  const [isStreamExpanded, setIsStreamExpanded] = useState(false);
  const [isRosterExpanded, setIsRosterExpanded] = useState(false);
  const [isReportExpanded, setIsReportExpanded] = useState(false);

  // Data State
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const prevLogCount = useRef(0);
  const [terminals, setTerminals] = useState<TerminalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowTime, setNowTime] = useState<number>(() => Date.now());

  // Subjects States
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectData | null>(
    null,
  );
  const [allStudents, setAllStudents] = useState<EnrolledStudent[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>(
    [],
  );
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectSection, setNewSubjectSection] = useState("");
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");

  // Settings States
  const [settingsUsername, setSettingsUsername] = useState("");
  const [settingsPassword, setSettingsPassword] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Filter States - Live Stream
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [streamSearchTerm, setStreamSearchTerm] = useState("");

  // Filter States - Reports Tab
  const [reportDate, setReportDate] = useState(today);
  const [selectedReportSubject, setSelectedReportSubject] =
    useState<SubjectData | null>(null);
  const [reportEnrolledStudents, setReportEnrolledStudents] = useState<
    EnrolledStudent[]
  >([]);
  const [reportSearchTerm, setReportSearchTerm] = useState("");

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 4000);
    },
    [],
  );

  const fetchSubjects = useCallback(async (email: string) => {
    if (!email) return;
    const { data, error } = await supabase
      .from("subjects")
      .select("*")
      .eq("teacher_email", email)
      .order("subject_name", { ascending: true });

    if (!error && data) setSubjects(data);
  }, []);

  const fetchMasterStudents = useCallback(async () => {
    const { data } = await supabase
      .from("students")
      .select("*")
      .order("last_name", { ascending: true });
    if (data) setAllStudents(data);
  }, []);

  // Fetch roster for Dashboard / Subjects tab
  const fetchRoster = useCallback(async (subjectId: number) => {
    const { data, error } = await supabase
      .from("subject_enrollments")
      .select(
        `id, students ( id, student_number, first_name, last_name, middle_name, program, year_level, section, rfid_uid )`,
      )
      .eq("subject_id", subjectId);

    if (!error && data) {
      const formattedRoster = (
        data as unknown as Array<{
          students: EnrolledStudent | EnrolledStudent[] | null;
        }>
      )
        .map((item) => {
          if (Array.isArray(item.students)) return item.students[0] || null;
          return item.students;
        })
        .filter((s): s is EnrolledStudent => Boolean(s));
      setEnrolledStudents(formattedRoster);
    }
  }, []);

  // Fetch roster specifically for the Reports tab
  const fetchReportRoster = useCallback(async (subjectId: number) => {
    const { data, error } = await supabase
      .from("subject_enrollments")
      .select(
        `id, students ( id, student_number, first_name, last_name, middle_name, program, year_level, section, rfid_uid )`,
      )
      .eq("subject_id", subjectId);

    if (!error && data) {
      const formattedRoster = (
        data as unknown as Array<{
          students: EnrolledStudent | EnrolledStudent[] | null;
        }>
      )
        .map((item) => {
          if (Array.isArray(item.students)) return item.students[0] || null;
          return item.students;
        })
        .filter((s): s is EnrolledStudent => Boolean(s));
      setReportEnrolledStudents(formattedRoster);
    }
  }, []);

  useEffect(() => {
    const initPortal = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const email = session.user.email || "";
      setUserEmail(email);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, username")
        .eq("id", session.user.id)
        .single();

      if (profile?.role !== "teacher") {
        router.push("/");
        return;
      }

      const displayName = profile?.username || email;
      setUserName(displayName);
      setSettingsUsername(profile?.username || "");
      setIsAuthenticating(false);

      const { data: activeClass } = await supabase
        .from("active_classes")
        .select("*")
        .eq("teacher_email", email)
        .eq("is_active", true)
        .maybeSingle();

      if (activeClass) {
        setIsClassActive(true);
        setHasSessionRunToday(true);
        setSelectedDevice(activeClass.device_id);
        setInputSubject(activeClass.subject || "");

        if (activeClass.subject) {
          const found = subjects.find(
            (s) =>
              s.subject_name === activeClass.subject &&
              s.section === activeClass.section,
          );
          if (found) {
            setSelectedSubject(found);
            fetchRoster(found.id);
          } else {
            const fallbackFound = subjects.find(
              (s) => s.subject_name === activeClass.subject,
            );
            if (fallbackFound) {
              setSelectedSubject(fallbackFound);
              fetchRoster(fallbackFound.id);
            }
          }
        }
      }

      if (email) {
        fetchSubjects(email);
        fetchMasterStudents();
      }
    };
    initPortal();
  }, [router, fetchSubjects, fetchMasterStudents, subjects, fetchRoster]);

  useEffect(() => {
    if (isAuthenticating) return;
    let isMounted = true;

    async function fetchSystemData(isInitial = false) {
      try {
        if (isInitial && isMounted) setLoading(true);

        const [logsRes, { data: activeData }] = await Promise.all([
          fetch("/api/logs", { cache: "no-store" }),
          supabase
            .from("active_classes")
            .select("device_id, is_active, last_seen"),
        ]);

        const logsData = await logsRes.json();

        if (isMounted) {
          if (logsData.success) {
            setLogs(logsData.logs);
          }
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
  }, [isAuthenticating, showToast]);

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
      setHasSessionRunToday(true);
      const now = new Date();
      const phDate = new Date(now.getTime() + 8 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      endTimestamp = `${phDate}T${inputEndTime}:00+08:00`;
    } else {
      const res = await fetch("/api/logs", { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
        prevLogCount.current = data.logs.length;
      }
    }

    const { error } = await supabase
      .from("active_classes")
      .update({
        is_active: turnOn,
        subject: turnOn ? inputSubject.trim() : null,
        section: turnOn && selectedSubject ? selectedSubject.section : null,
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
      showToast(
        `Class session started successfully in ${selectedDevice.replace(/_/g, " ")}!`,
        "success",
      );
    } else {
      setInputSubject("");
      setInputStartTime("");
      setInputEndTime("");
      showToast(`Class session ended successfully.`, "info");
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    setIsCreatingSubject(true);

    const { error } = await supabase.from("subjects").insert([
      {
        teacher_email: userEmail,
        subject_name: newSubjectName.trim(),
        section: newSubjectSection.trim() || null,
      },
    ]);

    if (error) {
      showToast("Error creating subject: " + error.message, "error");
    } else {
      setNewSubjectName("");
      setNewSubjectSection("");
      fetchSubjects(userEmail);
      showToast("Subject created successfully!", "success");
    }
    setIsCreatingSubject(false);
  };

  const confirmDeleteSubject = async () => {
    if (!subjectToDelete) return;

    await supabase
      .from("subject_enrollments")
      .delete()
      .eq("subject_id", subjectToDelete.id);

    const { error } = await supabase
      .from("subjects")
      .delete()
      .eq("id", subjectToDelete.id);
    if (!error) {
      if (selectedSubject?.id === subjectToDelete.id) {
        setSelectedSubject(null);
        setEnrolledStudents([]);
        setInputSubject("");
      }
      if (selectedReportSubject?.id === subjectToDelete.id) {
        setSelectedReportSubject(null);
        setReportEnrolledStudents([]);
      }
      fetchSubjects(userEmail);
      showToast("Subject and roster deleted successfully.", "info");
    } else {
      showToast("Failed to delete subject.", "error");
    }
    setSubjectToDelete(null);
  };

  const handleEnrollStudent = async (studentId: string) => {
    if (!selectedSubject) return;

    const { error } = await supabase.from("subject_enrollments").insert([
      {
        subject_id: selectedSubject.id,
        student_id: studentId,
      },
    ]);

    if (error) {
      if (error.code === "23505") {
        showToast("Student is already enrolled in this subject.", "error");
      } else {
        showToast("Failed to enroll student: " + error.message, "error");
      }
    } else {
      fetchRoster(selectedSubject.id);
      if (selectedReportSubject?.id === selectedSubject.id) {
        fetchReportRoster(selectedSubject.id);
      }
      showToast("Student enrolled successfully!", "success");
    }
  };

  const handleRemoveEnrollment = async (studentId: string) => {
    if (!selectedSubject) return;

    const { error } = await supabase
      .from("subject_enrollments")
      .delete()
      .eq("subject_id", selectedSubject.id)
      .eq("student_id", studentId);

    if (!error) {
      fetchRoster(selectedSubject.id);
      if (selectedReportSubject?.id === selectedSubject.id) {
        fetchReportRoster(selectedSubject.id);
      }
      showToast("Student removed from roster.", "info");
    } else {
      showToast("Failed to remove student.", "error");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ username: settingsUsername.trim() })
        .eq("id", session.user.id);

      if (profileError) throw profileError;

      if (settingsPassword.trim()) {
        const { error: authError } = await supabase.auth.updateUser({
          password: settingsPassword,
        });
        if (authError) throw authError;
        setSettingsPassword("");
      }

      setUserName(settingsUsername.trim() || userEmail);
      showToast("Account settings updated successfully!", "success");
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to save settings.";
      showToast(errMsg, "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Network error during sign out:", error);
    } finally {
      router.push("/login");
    }
  };

  const resetFilters = () => {
    setSelectedDate(today);
    setSelectedSubject(null);
    setEnrolledStudents([]);
    setInputSubject("");
    setStreamSearchTerm("");
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

  // --- LIVE DASHBOARD LOGIC ---
  const activeStreamRows = useMemo(() => {
    let result = [];

    if (!selectedSubject) {
      result = teacherLogs.filter(
        (log) => log.attendance_date === selectedDate,
      );
    } else {
      const dateLogs = teacherLogs.filter((log) => {
        if (
          log.attendance_date !== selectedDate ||
          log.subject !== selectedSubject.subject_name
        ) {
          return false;
        }
        const logSec = log.section ? String(log.section).trim() : null;
        const targetSec = selectedSubject.section
          ? String(selectedSubject.section).trim()
          : null;
        return logSec === targetSec;
      });

      const scannedMap = new Map<string, AttendanceLog>();
      dateLogs.forEach((log) => {
        const studId = log.students?.id || log.student_id;
        if (studId) {
          const existing = scannedMap.get(String(studId));
          if (!existing || log.status === "Present") {
            scannedMap.set(String(studId), log);
          }
        }
      });

      const mapRows = new Map<string, AttendanceLog>();
      const hasClassOccurred =
        isClassActive || hasSessionRunToday || dateLogs.length > 0;

      enrolledStudents.forEach((s) => {
        const existingLog = scannedMap.get(String(s.id));

        const defaultTime = existingLog
          ? existingLog.attendance_time
          : hasClassOccurred
            ? "00:00:00"
            : "";

        const defaultStatus = existingLog
          ? existingLog.status
          : hasClassOccurred
            ? "Absent"
            : "";

        mapRows.set(s.id, {
          id: existingLog ? existingLog.id : `pending_${s.id}`,
          attendance_date: selectedDate,
          attendance_time: defaultTime,
          status: defaultStatus,
          subject: selectedSubject.subject_name,
          section: selectedSubject.section || null,
          device_id: existingLog ? existingLog.device_id : "",
          teacher_email: userEmail,
          student_id: s.id,
          students: s,
        });
      });

      result = Array.from(mapRows.values());
    }

    if (streamSearchTerm.trim()) {
      const termLower = streamSearchTerm.toLowerCase();
      result = result.filter(
        (log) =>
          formatStudentName(log.students).toLowerCase().includes(termLower) ||
          (log.students?.student_number || "")
            .toLowerCase()
            .includes(termLower),
      );
    }

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const { key, direction } = sortConfig;
        const modifier = direction === "asc" ? 1 : -1;
        switch (key) {
          case "time":
            return (
              (a.attendance_time || "").localeCompare(b.attendance_time || "") *
              modifier
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
            return (a.status || "").localeCompare(b.status || "") * modifier;
          default:
            return 0;
        }
      });
    } else {
      result = [...result].sort((a, b) => {
        const nameA = formatStudentName(a.students).toLowerCase();
        const nameB = formatStudentName(b.students).toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }

    return result;
  }, [
    selectedSubject,
    teacherLogs,
    selectedDate,
    enrolledStudents,
    streamSearchTerm,
    sortConfig,
    userEmail,
    isClassActive,
    hasSessionRunToday,
  ]);

  // --- REPORTS TAB LOGIC ---
  const reportRows = useMemo(() => {
    let result = [];

    if (!selectedReportSubject) {
      result = teacherLogs.filter((log) => log.attendance_date === reportDate);
    } else {
      const dateLogs = teacherLogs.filter((log) => {
        if (
          log.attendance_date !== reportDate ||
          log.subject !== selectedReportSubject.subject_name
        ) {
          return false;
        }
        const logSec = log.section ? String(log.section).trim() : null;
        const targetSec = selectedReportSubject.section
          ? String(selectedReportSubject.section).trim()
          : null;
        return logSec === targetSec;
      });

      const scannedMap = new Map<string, AttendanceLog>();
      dateLogs.forEach((log) => {
        const studId = log.students?.id || log.student_id;
        if (studId) {
          const existing = scannedMap.get(String(studId));
          if (!existing || log.status === "Present") {
            scannedMap.set(String(studId), log);
          }
        }
      });

      const mapRows = new Map<string, AttendanceLog>();
      const hasClassOccurred =
        dateLogs.length > 0 ||
        (reportDate === today && (isClassActive || hasSessionRunToday));

      reportEnrolledStudents.forEach((s) => {
        const existingLog = scannedMap.get(String(s.id));
        const defaultTime = existingLog
          ? existingLog.attendance_time
          : hasClassOccurred
            ? "00:00:00"
            : "";
        const defaultStatus = existingLog
          ? existingLog.status
          : hasClassOccurred
            ? "Absent"
            : "";

        mapRows.set(s.id, {
          id: existingLog ? existingLog.id : `report_pending_${s.id}`,
          attendance_date: reportDate,
          attendance_time: defaultTime,
          status: defaultStatus,
          subject: selectedReportSubject.subject_name,
          section: selectedReportSubject.section || null,
          device_id: existingLog ? existingLog.device_id : "",
          teacher_email: userEmail,
          student_id: s.id,
          students: s,
        });
      });

      result = Array.from(mapRows.values());
    }

    if (reportSearchTerm.trim()) {
      const termLower = reportSearchTerm.toLowerCase();
      result = result.filter(
        (log) =>
          formatStudentName(log.students).toLowerCase().includes(termLower) ||
          (log.students?.student_number || "")
            .toLowerCase()
            .includes(termLower),
      );
    }

    result = [...result].sort((a, b) => {
      const nameA = formatStudentName(a.students).toLowerCase();
      const nameB = formatStudentName(b.students).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return result;
  }, [
    selectedReportSubject,
    teacherLogs,
    reportDate,
    reportEnrolledStudents,
    reportSearchTerm,
    userEmail,
    today,
    isClassActive,
    hasSessionRunToday,
  ]);

  const reportStats = useMemo(() => {
    let present = 0;
    let absent = 0;

    if (!selectedReportSubject) {
      reportRows.forEach((log) => {
        if (log.status === "Present") present++;
        else if (log.status === "Absent") absent++;
      });
      const total = reportRows.length;
      return {
        total,
        present,
        absent,
        rate:
          total > 0 ? Math.round((present / (present + absent)) * 100) || 0 : 0,
      };
    }

    reportRows.forEach((log) => {
      if (log.status === "Present") present++;
      else if (log.status === "Absent") absent++;
    });

    const total = reportRows.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;

    return { present, absent, total, rate };
  }, [reportRows, selectedReportSubject]);

  const exportToCSV = () => {
    if (activeStreamRows.length === 0) {
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
    const csvRows = activeStreamRows.map((log) =>
      [
        log.attendance_date,
        log.status === "Absent"
          ? "N/A"
          : log.attendance_time && log.attendance_time !== "00:00:00"
            ? formatTimeAMPM(log.attendance_time)
            : "—",
        log.students?.student_number || "Unknown",
        `"${formatStudentName(log.students)}"`,
        `"${log.students?.program || "Unknown"}"`,
        log.students?.year_level || "N/A",
        `"${log.students?.section || "Unknown"}"`,
        `"${log.subject || "N/A"}"`,
        log.status || "—",
      ].join(","),
    );

    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute(
      "download",
      `LiveDashboard_${selectedDate}_${selectedSubject ? selectedSubject.subject_name : "AllSubjects"}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV Exported successfully!", "success");
  };

  const exportReportsToCSV = () => {
    if (reportRows.length === 0) {
      showToast("No historical reports found to export!", "error");
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
    const csvRows = reportRows.map((log) =>
      [
        log.attendance_date,
        log.status === "Absent"
          ? "N/A"
          : log.attendance_time && log.attendance_time !== "00:00:00"
            ? formatTimeAMPM(log.attendance_time)
            : "—",
        log.students?.student_number || "Unknown",
        `"${formatStudentName(log.students)}"`,
        `"${log.students?.program || "Unknown"}"`,
        log.students?.year_level || "N/A",
        `"${log.students?.section || "Unknown"}"`,
        `"${log.subject || "N/A"}"`,
        log.status || "—",
      ].join(","),
    );

    const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute(
      "download",
      `Attendance_Report_${reportDate}_${selectedReportSubject ? selectedReportSubject.subject_name : "All"}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Report Exported successfully!", "success");
  };

  const availableStudentsForEnrollment = useMemo(() => {
    const enrolledIds = new Set(enrolledStudents.map((s) => s?.id));
    return allStudents.filter((s) => {
      if (!s || enrolledIds.has(s.id)) return false;
      const name = formatStudentName(s).toLowerCase();
      const num = (s.student_number || "").toLowerCase();
      const search = studentSearchTerm.toLowerCase();
      return name.includes(search) || num.includes(search);
    });
  }, [allStudents, enrolledStudents, studentSearchTerm]);

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
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] font-bold flex items-center gap-3 transition-all transform scale-100 animate-fade-in-up ${
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

      {subjectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center text-2xl mx-auto shadow-inner">
              ⚠️
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-blue-950">
                Delete Subject?
              </h3>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-bold text-slate-800">
                  &ldquo;{subjectToDelete.subject_name}&rdquo;
                </span>
                ? This will permanently remove it.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => setSubjectToDelete(null)}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSubject}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-sm cursor-pointer text-xs"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <aside
        className={`${isSidebarOpen ? "w-64" : "w-20"} bg-[#1e293b] text-white flex flex-col shadow-2xl z-20 relative transition-all duration-300 ease-in-out`}
      >
        <div className="p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700/60">
            {isSidebarOpen ? (
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center shrink-0 shadow-inner">
                  <span className="w-3.5 h-3.5 bg-blue-400 rounded-full animate-pulse shadow-[0_0_10px_#60a5fa]"></span>
                </span>
                <div className="font-extrabold text-xs tracking-tight text-blue-100 uppercase leading-tight">
                  <div>TEACHERS</div>
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

          <nav className="space-y-2 flex-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              title="Live Classroom"
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold transition-all cursor-pointer group ${
                activeTab === "dashboard"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              <span className="text-lg shrink-0">🔴</span>
              {isSidebarOpen && (
                <span className="text-sm tracking-wide truncate">
                  Live Classroom
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("subjects")}
              title="Subjects"
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold transition-all cursor-pointer group ${
                activeTab === "subjects"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              <span className="text-lg shrink-0">📚</span>
              {isSidebarOpen && (
                <span className="text-sm tracking-wide truncate">Subjects</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("reports")}
              title="Attendance Reports"
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold transition-all cursor-pointer group ${
                activeTab === "reports"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              <span className="text-lg shrink-0">📊</span>
              {isSidebarOpen && (
                <span className="text-sm tracking-wide truncate">
                  Attendance Reports
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              title="Account Settings"
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl font-bold transition-all cursor-pointer group ${
                activeTab === "settings"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              <span className="text-lg shrink-0">⚙️</span>
              {isSidebarOpen && (
                <span className="text-sm tracking-wide truncate">
                  Account Settings
                </span>
              )}
            </button>
          </nav>

          <div className="mt-auto pt-4 border-t border-slate-700/60 bg-slate-900/60 rounded-2xl p-3">
            {isSidebarOpen ? (
              <>
                <div className="text-xs font-bold text-slate-100 truncate mb-0.5">
                  {userName}
                </div>
                <div className="text-[11px] text-slate-400 truncate mb-3">
                  {userEmail}
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-bold text-xs transition-all cursor-pointer shadow-sm"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span
                  className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center uppercase shadow-inner"
                  title={userName}
                >
                  {userName ? userName.charAt(0) : "U"}
                </span>
                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="p-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition-all cursor-pointer"
                >
                  🚪
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 relative overflow-y-auto">
        <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none z-0"></div>

        <div className="p-6 sm:p-10 relative z-10 max-w-7xl mx-auto pb-20">
          {/* TAB 1: LIVE CLASSROOM */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm mb-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-900 text-xs font-bold uppercase tracking-wider mb-3">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                    Live Environment
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-950 tracking-tight">
                    Classroom Dashboard
                  </h1>
                  <p className="text-slate-500 text-base mt-1 font-medium">
                    Welcome back,{" "}
                    <span className="font-bold text-slate-800">{userName}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 px-5 py-3 rounded-2xl shadow-inner">
                  <span className="text-2xl font-black text-blue-950">
                    {isClassActive ? "1" : "0"}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900/60">
                    Active
                    <br />
                    Session
                  </span>
                </div>
              </div>

              {/* SESSION CONTROL CARD */}
              <div
                className={`p-6 sm:p-8 rounded-3xl border transition-all duration-500 flex flex-col gap-6 ${
                  isClassActive
                    ? "bg-gradient-to-br from-blue-50/80 via-white to-white border-blue-200 shadow-[0_8px_30px_rgba(30,58,138,0.1)]"
                    : "bg-white border-slate-200 shadow-sm"
                }`}
              >
                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Select Room / Scanner
                    </label>
                    <select
                      value={selectedDevice}
                      onChange={(e) => setSelectedDevice(e.target.value)}
                      disabled={isClassActive}
                      className={`w-full border rounded-xl px-4 py-3.5 text-base font-bold outline-none disabled:opacity-60 focus:ring-4 focus:ring-blue-900/15 shadow-inner transition-all appearance-none cursor-pointer ${
                        isSelectedDeviceOnline
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 focus:border-emerald-500"
                          : "bg-rose-50 border-rose-200 text-rose-600 focus:border-rose-500"
                      }`}
                    >
                      {AVAILABLE_ROOMS.map((room) => {
                        const term = terminals.find(
                          (t) => t.device_id === room.id,
                        );
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
                            {room.name}{" "}
                            {isRoomOnline ? "(Online)" : "(Offline)"}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Subject Name
                    </label>
                    <div className="relative flex items-center w-full">
                      <input
                        type="text"
                        placeholder="Select or type subject"
                        value={inputSubject}
                        onChange={(e) => {
                          setInputSubject(e.target.value);
                          setHasSessionRunToday(false);
                        }}
                        onFocus={() => setShowSubjectDropdown(true)}
                        onBlur={() =>
                          setTimeout(() => setShowSubjectDropdown(false), 200)
                        }
                        disabled={isClassActive}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 placeholder-slate-400 focus:border-blue-900 focus:ring-4 focus:ring-blue-900/15 outline-none disabled:opacity-60 pr-24 transition-all shadow-inner"
                      />
                      {/* Section Badge inside the Input */}
                      {inputSubject &&
                        selectedSubject &&
                        selectedSubject.subject_name === inputSubject &&
                        selectedSubject.section && (
                          <span className="absolute right-3 bg-blue-100 border border-blue-200 text-blue-800 text-[10px] font-extrabold px-2 py-1 rounded shadow-sm pointer-events-none">
                            SEC: {selectedSubject.section}
                          </span>
                        )}
                    </div>

                    {showSubjectDropdown &&
                      subjects.length > 0 &&
                      !isClassActive && (
                        <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
                          {subjects.map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors"
                              onMouseDown={() => {
                                setInputSubject(sub.subject_name);
                                setSelectedSubject(sub);
                                setHasSessionRunToday(false);
                                fetchRoster(sub.id);
                              }}
                            >
                              <span className="font-bold text-slate-800 text-sm">
                                {sub.subject_name}
                              </span>
                              {sub.section && (
                                <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md font-medium">
                                  Sec: {sub.section}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Class Schedule
                    </label>
                    <div
                      className={`flex items-center justify-between gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-3 focus-within:border-blue-900 focus-within:ring-4 focus-within:ring-blue-900/15 transition-all shadow-inner ${isClassActive ? "opacity-60 pointer-events-none bg-slate-100" : ""}`}
                    >
                      <input
                        type="time"
                        value={inputStartTime}
                        onChange={(e) => setInputStartTime(e.target.value)}
                        className="bg-transparent outline-none flex-1 w-full text-slate-800 font-medium text-xs sm:text-sm cursor-pointer min-w-[75px]"
                        style={{ colorScheme: "light" }}
                      />
                      <span className="font-bold text-slate-400 shrink-0 px-0.5">
                        -
                      </span>
                      <input
                        type="time"
                        value={inputEndTime}
                        onChange={(e) => setInputEndTime(e.target.value)}
                        className="bg-transparent outline-none flex-1 w-full text-slate-800 font-medium text-xs sm:text-sm cursor-pointer min-w-[75px]"
                        style={{ colorScheme: "light" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="w-full pt-2 border-t border-slate-100/60">
                  {isClassActive ? (
                    <button
                      onClick={() => handleToggleClass(false)}
                      className="w-full bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-bold py-4 px-8 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all cursor-pointer"
                    >
                      <span className="w-3 h-3 bg-white rounded-full animate-pulse shadow-sm"></span>{" "}
                      End Class Session
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleClass(true)}
                      disabled={!isSelectedDeviceOnline}
                      className={`w-full font-bold py-4 px-8 rounded-2xl shadow-md transition-all ${
                        isSelectedDeviceOnline
                          ? "bg-gradient-to-r from-blue-900 to-indigo-900 text-white cursor-pointer hover:shadow-lg hover:brightness-110"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                      }`}
                    >
                      {isSelectedDeviceOnline
                        ? "Start Class Session"
                        : "Scanner Offline"}
                    </button>
                  )}
                </div>
              </div>

              {/* DATA TABLE SECTION */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                    <div>
                      <h2 className="text-2xl font-extrabold text-blue-950">
                        Live Attendance Stream
                      </h2>
                      <p className="text-slate-500 mt-1 font-medium">
                        Showing {activeStreamRows.length} records.
                      </p>
                    </div>

                    <div className="flex gap-3 w-full lg:w-auto">
                      <button
                        onClick={resetFilters}
                        className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all w-full lg:w-auto text-base cursor-pointer"
                      >
                        Reset Filters
                      </button>
                      <button
                        onClick={exportToCSV}
                        className="bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-950 font-bold px-6 py-2.5 rounded-xl shadow-sm transition-all w-full lg:w-auto text-base cursor-pointer"
                      >
                        Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setHasSessionRunToday(false);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-900 shadow-sm cursor-pointer"
                      style={{ colorScheme: "light" }}
                    />
                    <select
                      value={
                        selectedSubject ? selectedSubject.id.toString() : "All"
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "All") {
                          setSelectedSubject(null);
                          setEnrolledStudents([]);
                          setInputSubject("");
                          setHasSessionRunToday(false);
                        } else {
                          const found = subjects.find(
                            (s) => s.id.toString() === val,
                          );
                          if (found) {
                            setSelectedSubject(found);
                            setHasSessionRunToday(false);
                            fetchRoster(found.id);
                            setInputSubject(found.subject_name);
                          }
                        }
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-900 shadow-sm cursor-pointer"
                    >
                      <option value="All">All Subjects</option>
                      {subjects.map((subj) => (
                        <option key={subj.id} value={subj.id.toString()}>
                          {subj.subject_name}{" "}
                          {subj.section ? `(Sec: ${subj.section})` : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Search name or ID..."
                      value={streamSearchTerm}
                      onChange={(e) => setStreamSearchTerm(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-900 shadow-sm transition-all"
                    />
                  </div>
                </div>

                <div
                  className={`overflow-x-auto w-full transition-all duration-300 ${!isStreamExpanded ? "max-h-[380px] overflow-y-auto" : "h-auto"}`}
                >
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                      <tr className="bg-blue-900/10 text-blue-950 text-sm font-bold uppercase tracking-wider border-b border-blue-900/20 cursor-pointer select-none">
                        <th className="p-5" onClick={() => handleSort("time")}>
                          Time{" "}
                          <SortIcon columnKey="time" sortConfig={sortConfig} />
                        </th>
                        <th
                          className="p-5"
                          onClick={() => handleSort("student_number")}
                        >
                          Student Number{" "}
                          <SortIcon
                            columnKey="student_number"
                            sortConfig={sortConfig}
                          />
                        </th>
                        <th className="p-5" onClick={() => handleSort("name")}>
                          Student Name{" "}
                          <SortIcon columnKey="name" sortConfig={sortConfig} />
                        </th>
                        <th
                          className="p-5"
                          onClick={() => handleSort("program")}
                        >
                          Program{" "}
                          <SortIcon
                            columnKey="program"
                            sortConfig={sortConfig}
                          />
                        </th>
                        <th
                          className="p-5"
                          onClick={() => handleSort("year_section")}
                        >
                          Yr & Sec{" "}
                          <SortIcon
                            columnKey="year_section"
                            sortConfig={sortConfig}
                          />
                        </th>
                        <th
                          className="p-5"
                          onClick={() => handleSort("subject")}
                        >
                          Subject{" "}
                          <SortIcon
                            columnKey="subject"
                            sortConfig={sortConfig}
                          />
                        </th>
                        <th
                          className="p-5"
                          onClick={() => handleSort("status")}
                        >
                          Status{" "}
                          <SortIcon
                            columnKey="status"
                            sortConfig={sortConfig}
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-base bg-white">
                      {loading ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="p-10 text-center text-slate-400"
                          >
                            Syncing live records...
                          </td>
                        </tr>
                      ) : activeStreamRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
                            className="p-12 text-center text-slate-400 font-medium"
                          >
                            No records or students found for this filter.
                          </td>
                        </tr>
                      ) : (
                        activeStreamRows.map((log) => {
                          const hasScanned = Boolean(
                            log.attendance_time &&
                            log.status &&
                            log.attendance_time !== "00:00:00",
                          );
                          const isAbsent = log.status === "Absent";

                          return (
                            <tr
                              key={log.id}
                              className="hover:bg-blue-50/50 transition-colors"
                            >
                              <td className="p-5 text-slate-700 font-mono text-sm font-bold whitespace-nowrap">
                                {hasScanned ? (
                                  formatTimeAMPM(log.attendance_time)
                                ) : isAbsent ? (
                                  <span className="text-slate-400">N/A</span>
                                ) : (
                                  <span className="text-slate-300 font-normal">
                                    —
                                  </span>
                                )}
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
                              <td className="p-5 whitespace-nowrap">
                                <span className="bg-slate-100 px-3 py-1.5 rounded-md border text-slate-700 font-bold text-sm">
                                  Yr {log.students?.year_level || "?"} • Sec{" "}
                                  {log.students?.section || "?"}
                                </span>
                              </td>
                              <td className="p-5 font-bold text-slate-700">
                                {log.subject ||
                                  (selectedSubject
                                    ? selectedSubject.subject_name
                                    : "N/A")}
                              </td>
                              <td className="p-5">
                                {hasScanned ? (
                                  <span className="px-4 py-1.5 rounded-md text-sm font-bold uppercase bg-emerald-100 text-emerald-800 border">
                                    {log.status}
                                  </span>
                                ) : isAbsent ? (
                                  <span className="px-4 py-1.5 rounded-md text-sm font-bold uppercase bg-rose-100 text-rose-800 border">
                                    Absent
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-medium">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {activeStreamRows.length > 5 && (
                  <div className="bg-slate-50 border-t border-slate-100 p-2.5 flex justify-center">
                    <button
                      onClick={() => setIsStreamExpanded(!isStreamExpanded)}
                      className="text-xs font-bold text-blue-900 bg-white border border-blue-200 hover:bg-blue-50 px-6 py-2 rounded-full transition-all cursor-pointer shadow-sm"
                    >
                      {isStreamExpanded ? "▲ Show Less" : "▼ Show More Records"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: SUBJECTS */}
          {activeTab === "subjects" && (
            <div className="space-y-8 animate-fade-in-up h-full flex flex-col">
              <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-900 text-xs font-bold uppercase tracking-wider mb-3">
                    Academic Management
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-950 tracking-tight">
                    Subjects & Rosters
                  </h1>
                  <p className="text-slate-500 text-base mt-1 font-medium">
                    Create and organize your classes to seamlessly track student
                    attendance.
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 px-5 py-3 rounded-2xl shadow-inner">
                  <span className="text-2xl font-black text-blue-950">
                    {subjects.length}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900/60">
                    Total Active
                    <br />
                    Subjects
                  </span>
                </div>
              </div>

              {/* Grid layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* LEFT COLUMN: Create New Subject & My Subjects Box */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full pointer-events-none -z-0"></div>
                    <h3 className="text-lg font-extrabold text-blue-950 mb-5 relative z-10 flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-900"></span>
                      Create New Subject
                    </h3>
                    <form
                      onSubmit={handleCreateSubject}
                      className="space-y-4 relative z-10"
                    >
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Subject Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g., Data Structures & Algorithms"
                          value={newSubjectName}
                          onChange={(e) => setNewSubjectName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 font-medium outline-none focus:border-blue-900 focus:ring-4 focus:ring-blue-900/15 shadow-inner placeholder-slate-400 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Section{" "}
                          <span className="text-slate-400 font-normal">
                            (Optional)
                          </span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., 3A or BSIT-3"
                          value={newSubjectSection}
                          onChange={(e) => setNewSubjectSection(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 font-medium outline-none focus:border-blue-900 focus:ring-4 focus:ring-blue-900/15 shadow-inner placeholder-slate-400 transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isCreatingSubject}
                        className="w-full bg-blue-900 hover:bg-blue-950 text-white font-extrabold py-3.5 rounded-xl shadow-md transition-all text-sm cursor-pointer disabled:opacity-50 mt-2"
                      >
                        {isCreatingSubject ? "Creating..." : "+ Add Subject"}
                      </button>
                    </form>
                  </div>

                  {/* My Subjects box with fixed max height and internal scroll */}
                  <div className="bg-white rounded-3xl border border-slate-200/80 p-7 shadow-sm flex flex-col max-h-[460px]">
                    <div className="shrink-0 flex items-center justify-between mb-5">
                      <h3 className="text-lg font-extrabold text-blue-950 flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-900"></span>
                        My Subjects
                      </h3>
                      <span className="bg-blue-50 text-blue-900 border border-blue-100 text-xs font-bold px-2.5 py-1 rounded-full">
                        {subjects.length}
                      </span>
                    </div>

                    {subjects.length === 0 ? (
                      <div className="flex-1 text-center py-10 px-4 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-sm font-bold text-slate-700">
                          No subjects created yet
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Fill out the form above to add your first course.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-y-auto pr-1 space-y-3 max-h-[340px]">
                        {subjects.map((sub) => {
                          const isSelected = selectedSubject?.id === sub.id;
                          return (
                            <div
                              key={sub.id}
                              onClick={() => {
                                setSelectedSubject(sub);
                                setHasSessionRunToday(false);
                                fetchRoster(sub.id);
                              }}
                              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                                isSelected
                                  ? "bg-blue-950 text-white border-blue-950 shadow-md transform scale-[1.01]"
                                  : "bg-slate-50/50 hover:bg-slate-100/80 border-slate-200/80 text-slate-900"
                              }`}
                            >
                              <div className="pr-3 truncate">
                                <h4 className="font-extrabold text-sm truncate">
                                  {sub.subject_name}
                                </h4>
                                <p
                                  className={`text-xs mt-0.5 truncate font-medium ${isSelected ? "text-blue-200" : "text-slate-500"}`}
                                >
                                  {sub.section
                                    ? `Section: ${sub.section}`
                                    : "No Section Assigned"}
                                </p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSubjectToDelete(sub);
                                }}
                                className={`text-xs font-bold p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
                                  isSelected
                                    ? "text-rose-300 hover:bg-rose-900/60"
                                    : "text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100"
                                }`}
                                title="Delete Subject"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: Active Course / Roster Box (Slightly taller height max-h-[480px]) */}
                <div className="lg:col-span-7 flex flex-col bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                  {selectedSubject ? (
                    <>
                      <div className="shrink-0 p-7 sm:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wider mb-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Active Course
                          </div>
                          <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-950">
                            {selectedSubject.subject_name}
                          </h2>
                          <p className="text-slate-500 text-sm font-medium mt-1">
                            {selectedSubject.section
                              ? `Section: ${selectedSubject.section} • `
                              : ""}
                            Enrolled Students:{" "}
                            <span className="font-bold text-slate-900">
                              {enrolledStudents.length}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 p-6 border-b border-slate-100 bg-white space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                            Enroll Students from Database
                          </label>
                          <span className="text-xs text-slate-400 font-medium">
                            Type name or ID number
                          </span>
                        </div>
                        <input
                          type="text"
                          placeholder="Search student by name or student number..."
                          value={studentSearchTerm}
                          onChange={(e) => setStudentSearchTerm(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 font-medium outline-none focus:border-blue-900 focus:ring-4 focus:ring-blue-900/15 shadow-inner placeholder-slate-400 transition-all"
                        />

                        {studentSearchTerm.trim() &&
                          availableStudentsForEnrollment.length > 0 && (
                            <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-xl bg-white p-1">
                              {availableStudentsForEnrollment.map((s) => (
                                <div
                                  key={s!.id}
                                  className="flex items-center justify-between p-3.5 hover:bg-blue-50/50 rounded-xl transition-colors"
                                >
                                  <div>
                                    <p className="text-sm font-bold text-slate-900">
                                      {formatStudentName(s)}{" "}
                                      <span className="font-mono text-xs text-slate-500 font-bold ml-1">
                                        ({s!.student_number})
                                      </span>
                                    </p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      {s!.program} • Yr {s!.year_level}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleEnrollStudent(s!.id)}
                                    className="bg-blue-900 hover:bg-blue-950 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-sm"
                                  >
                                    + Enroll
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>

                      {/* Clean Roster Table Container with Extended Height (max-h-[480px]) */}
                      <div
                        className={`overflow-x-auto w-full transition-all duration-300 ${!isRosterExpanded ? "max-h-[480px] overflow-y-auto" : "h-auto"}`}
                      >
                        <table className="w-full text-left border-collapse">
                          <thead className="sticky top-0 bg-white z-10 shadow-sm">
                            <tr className="bg-blue-900/10 text-blue-950 text-xs font-bold uppercase tracking-wider border-b border-blue-900/20">
                              <th className="p-4 px-6">Student Number</th>
                              <th className="p-4 px-6">Student Name</th>
                              <th className="p-4 px-6">Program</th>
                              <th className="p-4 px-6 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-sm bg-white">
                            {enrolledStudents.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="p-16 text-center text-slate-400 font-medium"
                                >
                                  <div className="flex flex-col items-center justify-center space-y-2">
                                    <span className="text-3xl">👥</span>
                                    <p className="text-slate-600 font-bold">
                                      No students enrolled yet
                                    </p>
                                    <p className="text-xs text-slate-400">
                                      Use the search bar above to add students
                                      to this roster.
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            ) : (
                              enrolledStudents.map((s) => (
                                <tr
                                  key={s!.id}
                                  className="hover:bg-blue-50/50 transition-colors"
                                >
                                  <td className="p-4 px-6 font-mono font-bold text-blue-900">
                                    {s!.student_number}
                                  </td>
                                  <td className="p-4 px-6 font-extrabold text-slate-900">
                                    {formatStudentName(s)}
                                  </td>
                                  <td className="p-4 px-6 text-slate-600 font-medium">
                                    {s!.program} • Yr {s!.year_level}
                                  </td>
                                  <td className="p-4 px-6 text-right">
                                    <button
                                      onClick={() =>
                                        handleRemoveEnrollment(s!.id)
                                      }
                                      className="text-rose-600 hover:text-white text-xs font-bold bg-rose-50 hover:bg-rose-600 px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-rose-200 hover:border-rose-600"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {enrolledStudents.length > 8 && (
                        <div className="bg-slate-50 border-t border-slate-100 p-2.5 flex justify-center">
                          <button
                            onClick={() =>
                              setIsRosterExpanded(!isRosterExpanded)
                            }
                            className="text-xs font-bold text-blue-900 bg-white border border-blue-200 hover:bg-blue-50 px-6 py-2 rounded-full transition-all cursor-pointer shadow-sm"
                          >
                            {isRosterExpanded
                              ? "▲ Show Less"
                              : "▼ Show More Records"}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-20 text-center text-slate-400 my-auto flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl mb-4 shadow-inner">
                        📂
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-800">
                        Select a Subject
                      </h3>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm">
                        Click on any subject from your list on the left panel to
                        manage its student roster and enrollment records.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REPORTS */}
          {activeTab === "reports" && (
            <div className="space-y-6 animate-fade-in-up">
              {/* Report Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-900 text-xs font-bold uppercase tracking-wider mb-3">
                    Historical Data
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-950 tracking-tight">
                    Attendance Reports
                  </h1>
                  <p className="text-slate-500 text-base mt-1 font-medium">
                    Generate exact attendance sheets, view accurate statistics,
                    and export records.
                  </p>
                </div>
                <button
                  onClick={exportReportsToCSV}
                  disabled={reportRows.length === 0}
                  className="bg-blue-900 hover:bg-blue-950 text-white font-bold py-3.5 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-xl">📥</span> Export Report
                </button>
              </div>

              {/* Filtering Controls */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Report Date
                  </label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-900 shadow-inner cursor-pointer"
                    style={{ colorScheme: "light" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-2">
                    Select Subject
                    {!selectedReportSubject && (
                      <span className="text-[10px] text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full font-bold">
                        Required for full stats
                      </span>
                    )}
                  </label>
                  <select
                    value={
                      selectedReportSubject
                        ? selectedReportSubject.id.toString()
                        : "All"
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "All") {
                        setSelectedReportSubject(null);
                        setReportEnrolledStudents([]);
                      } else {
                        const found = subjects.find(
                          (s) => s.id.toString() === val,
                        );
                        if (found) {
                          setSelectedReportSubject(found);
                          fetchReportRoster(found.id);
                        }
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-900 shadow-inner cursor-pointer"
                  >
                    <option value="All">All Subjects (Raw Logs Only)</option>
                    {subjects.map((subj) => (
                      <option key={subj.id} value={subj.id.toString()}>
                        {subj.subject_name}{" "}
                        {subj.section ? `(Sec: ${subj.section})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Search Student
                  </label>
                  <input
                    type="text"
                    placeholder="Name or ID..."
                    value={reportSearchTerm}
                    onChange={(e) => setReportSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-900 shadow-inner transition-all placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Top Level Summary Statistics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0 shadow-inner">
                    👥
                  </div>
                  <div className="truncate">
                    <p className="text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      {selectedReportSubject ? "Total Enrolled" : "Total Scans"}
                    </p>
                    <p className="text-xl sm:text-2xl font-black text-blue-950 truncate">
                      {reportStats.total}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0 shadow-inner">
                    ✅
                  </div>
                  <div className="truncate">
                    <p className="text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      Present
                    </p>
                    <p className="text-xl sm:text-2xl font-black text-emerald-700 truncate">
                      {reportStats.present}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4 opacity-100 transition-opacity">
                  <div
                    className={`w-12 h-12 rounded-2xl ${selectedReportSubject ? "bg-rose-50 text-rose-600" : "bg-slate-50 text-slate-400"} flex items-center justify-center text-xl shrink-0 shadow-inner`}
                  >
                    ❌
                  </div>
                  <div className="truncate">
                    <p className="text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      Absent
                    </p>
                    <p
                      className={`text-xl sm:text-2xl font-black truncate ${selectedReportSubject ? "text-rose-700" : "text-slate-400"}`}
                    >
                      {selectedReportSubject ? reportStats.absent : "--"}
                    </p>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl ${selectedReportSubject ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400"} flex items-center justify-center text-xl shrink-0 shadow-inner`}
                  >
                    📈
                  </div>
                  <div className="truncate">
                    <p className="text-[10px] sm:text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                      Attendance Rate
                    </p>
                    <p
                      className={`text-xl sm:text-2xl font-black truncate ${selectedReportSubject ? "text-indigo-700" : "text-slate-400"}`}
                    >
                      {selectedReportSubject ? `${reportStats.rate}%` : "--"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Warning Banner if No Subject Selected */}
              {!selectedReportSubject && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                  <span className="text-amber-500 text-xl">⚠️</span>
                  <p className="text-amber-800 text-sm font-medium">
                    You are viewing raw logs for{" "}
                    <span className="font-bold">All Subjects</span>. To
                    accurately track and calculate <strong>Absent</strong>{" "}
                    students based on your class roster, please select a
                    specific subject from the dropdown above.
                  </p>
                </div>
              )}

              {/* Data Table */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div
                  className={`overflow-x-auto w-full transition-all duration-300 ${!isReportExpanded ? "max-h-[500px] overflow-y-auto" : "h-auto"}`}
                >
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                      <tr className="bg-blue-900/10 text-blue-950 text-sm font-bold uppercase tracking-wider border-b border-blue-900/20 select-none">
                        <th className="p-5" onClick={() => handleSort("time")}>
                          Time{" "}
                          <SortIcon columnKey="time" sortConfig={sortConfig} />
                        </th>
                        <th
                          className="p-5"
                          onClick={() => handleSort("student_number")}
                        >
                          Student Number{" "}
                          <SortIcon
                            columnKey="student_number"
                            sortConfig={sortConfig}
                          />
                        </th>
                        <th className="p-5" onClick={() => handleSort("name")}>
                          Student Name{" "}
                          <SortIcon columnKey="name" sortConfig={sortConfig} />
                        </th>
                        <th
                          className="p-5"
                          onClick={() => handleSort("program")}
                        >
                          Program{" "}
                          <SortIcon
                            columnKey="program"
                            sortConfig={sortConfig}
                          />
                        </th>
                        <th
                          className="p-5"
                          onClick={() => handleSort("subject")}
                        >
                          Subject{" "}
                          <SortIcon
                            columnKey="subject"
                            sortConfig={sortConfig}
                          />
                        </th>
                        <th
                          className="p-5"
                          onClick={() => handleSort("status")}
                        >
                          Status{" "}
                          <SortIcon
                            columnKey="status"
                            sortConfig={sortConfig}
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-base bg-white">
                      {reportRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-16 text-center text-slate-400 font-medium"
                          >
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <span className="text-4xl">📭</span>
                              <p className="text-slate-600 font-bold">
                                No records found for the selected date and
                                filter.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        reportRows.map((log) => {
                          const hasScanned = Boolean(
                            log.attendance_time &&
                            log.status &&
                            log.attendance_time !== "00:00:00",
                          );
                          const isAbsent = log.status === "Absent";

                          return (
                            <tr
                              key={`${log.id}_${log.student_id}`}
                              className="hover:bg-blue-50/50 transition-colors"
                            >
                              <td className="p-5 text-slate-700 font-mono text-sm font-bold whitespace-nowrap">
                                {hasScanned ? (
                                  formatTimeAMPM(log.attendance_time)
                                ) : isAbsent ? (
                                  <span className="text-slate-400">N/A</span>
                                ) : (
                                  <span className="text-slate-300 font-normal">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="p-5 font-bold text-blue-900 font-mono text-sm">
                                {log.students?.student_number || "Unknown"}
                              </td>
                              <td className="p-5 font-extrabold text-slate-900">
                                {formatStudentName(log.students)}
                              </td>
                              <td className="p-5 text-slate-600 font-medium whitespace-nowrap">
                                {log.students?.program} • Yr{" "}
                                {log.students?.year_level}
                              </td>
                              <td className="p-5">
                                <span className="font-bold text-slate-700 text-sm block">
                                  {log.subject || "N/A"}
                                </span>
                                {log.section && (
                                  <span className="text-xs text-slate-500">
                                    Sec: {log.section}
                                  </span>
                                )}
                              </td>
                              <td className="p-5">
                                {hasScanned ? (
                                  <span className="px-4 py-1.5 rounded-md text-sm font-bold uppercase bg-emerald-100 text-emerald-800 border">
                                    {log.status}
                                  </span>
                                ) : isAbsent ? (
                                  <span className="px-4 py-1.5 rounded-md text-sm font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200">
                                    Absent
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-medium">
                                    —
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {reportRows.length > 7 && (
                  <div className="bg-slate-50 border-t border-slate-100 p-2.5 flex justify-center">
                    <button
                      onClick={() => setIsReportExpanded(!isReportExpanded)}
                      className="text-xs font-bold text-blue-900 bg-white border border-blue-200 hover:bg-blue-50 px-6 py-2 rounded-full transition-all cursor-pointer shadow-sm"
                    >
                      {isReportExpanded ? "▲ Show Less" : "▼ Show More Records"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-6 animate-fade-in-up max-w-2xl">
              <div className="mb-6">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-950 tracking-tight">
                  Account Settings
                </h1>
                <p className="text-slate-500 text-base mt-2 font-medium">
                  Customize your profile and update security credentials.
                </p>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Display Username
                    </label>
                    <p className="text-xs text-slate-500 mb-3 font-medium">
                      This is how your name will appear on the Admin logs and
                      dashboard (e.g., &ldquo;Prof. Dela Cruz&rdquo;).
                    </p>
                    <input
                      type="text"
                      placeholder="e.g., Prof. Smith"
                      value={settingsUsername}
                      onChange={(e) => setSettingsUsername(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 font-medium outline-none focus:border-blue-900 shadow-inner"
                    />
                  </div>

                  <hr className="border-slate-100" />

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      Change Password (Optional)
                    </label>
                    <p className="text-xs text-slate-500 mb-3 font-medium">
                      Leave this blank if you do not want to change your current
                      password.
                    </p>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={settingsPassword}
                      onChange={(e) => setSettingsPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-base text-slate-900 font-medium outline-none focus:border-blue-900 shadow-inner placeholder-slate-300"
                    />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingSettings}
                      className="bg-blue-900 hover:bg-blue-950 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-70"
                    >
                      {isSavingSettings ? "Saving..." : "Save Settings"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
