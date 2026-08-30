"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to format the name consistently
const formatStudentName = (student) => {
  if (!student) return "Unknown";
  // If the new separated schema exists:
  if (student.last_name && student.first_name) {
    const middle = student.middle_name ? ` ${student.middle_name}` : "";
    return `${student.last_name}, ${student.first_name}${middle}`.trim();
  }
  // Fallback for older records that might still only have full_name
  return student.full_name || "Unknown";
};

export default function StudentsPage() {
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State for Adding a New Student
  const [studentNumber, setStudentNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [program, setProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [section, setSection] = useState("");
  const [rfidUid, setRfidUid] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Search State
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch ordered alphabetically by Last Name
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("last_name", { ascending: true });

    if (!error && data) setStudents(data);
    setLoading(false);
  }, []);

  // 1. Auth Check (Admin Only)
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
      fetchStudents();
    };
    checkUser();
  }, [router, fetchStudents]);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const { error } = await supabase.from("students").insert([
      {
        student_number: studentNumber.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        middle_name: middleName.trim(),
        program: program.trim(),
        year_level: yearLevel.trim(),
        section: section.trim(),
        rfid_uid: rfidUid.trim(),
      },
    ]);

    if (error) {
      alert(`Error adding student: ${error.message}`);
    } else {
      setStudentNumber("");
      setFirstName("");
      setLastName("");
      setMiddleName("");
      setProgram("");
      setYearLevel("");
      setSection("");
      setRfidUid("");
      fetchStudents();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (
      !confirm(
        "Are you sure you want to delete this student and unregister their RFID card?",
      )
    )
      return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (!error) fetchStudents();
    else alert("Failed to delete student.");
  };

  const filteredStudents = students.filter((s) => {
    const formattedName = formatStudentName(s).toLowerCase();
    const search = searchTerm.toLowerCase();
    return (
      formattedName.includes(search) ||
      s.student_number?.toLowerCase().includes(search) ||
      s.rfid_uid?.toLowerCase().includes(search)
    );
  });

  if (isAuthenticating)
    return <div className="min-h-screen bg-[#030712]"></div>;

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 p-6 sm:p-10 font-sans relative overflow-hidden selection:bg-cyan-500/30">
      {/* Ambient Glowing Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 pb-6 border-b border-white/5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-3 tracking-widest uppercase shadow-[0_0_15px_rgba(6,182,212,0.15)]">
              Registry Management
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Student & RFID Database
            </h1>
            <p className="text-slate-400 text-sm mt-2 font-light">
              Register new student profiles and map their physical RFID hardware
              UID cards.
            </p>
          </div>

          <Link
            href="/"
            className="bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold px-5 py-3 rounded-xl border border-white/10 transition-all flex items-center gap-2"
          >
            ← Back to Operations
          </Link>
        </div>

        {/* TWO COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* COLUMN 1: ADD STUDENT FORM */}
          <div className="bg-[#0f172a]/60 backdrop-blur-3xl p-6 sm:p-8 rounded-3xl border border-white/10 shadow-[0_8px_40px_rgb(0,0,0,0.5)] h-fit">
            <h2 className="text-lg font-bold text-white mb-1">
              Register New Student
            </h2>
            <p className="text-slate-400 text-xs mb-6">
              Link a student profile to an RFID key.
            </p>

            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                  Student Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 23-01792"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Last Name (Surname)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Dela Cruz"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Juan"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                  Middle Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Santos"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Program
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., BSIT"
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Year Level
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g., 3"
                    min="1"
                    max="5"
                    value={yearLevel}
                    onChange={(e) => setYearLevel(e.target.value)}
                    className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500/50 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                  Section
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 3A"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                  RFID UID (Card Hex)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., A3 B2 C1 4D"
                  value={rfidUid}
                  onChange={(e) => setRfidUid(e.target.value)}
                  className="w-full bg-[#0a0f1c] border border-white/10 rounded-xl px-4 py-3 text-xs font-mono text-cyan-400 outline-none focus:border-cyan-500/50 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-3.5 px-4 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all text-xs tracking-wide mt-4 cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Registering..." : "Save Student & Card"}
              </button>
            </form>
          </div>

          {/* COLUMN 2 & 3: STUDENT DIRECTORY TABLE */}
          <div className="lg:col-span-2 bg-[#0f172a]/60 backdrop-blur-3xl rounded-3xl border border-white/10 overflow-hidden shadow-[0_8px_40px_rgb(0,0,0,0.5)]">
            <div className="p-6 sm:p-8 border-b border-white/5 bg-white/[0.01] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">
                  Registered Directory
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Total active students in database: {students.length}
                </p>
              </div>

              <input
                type="text"
                placeholder="Search by name, number, or RFID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#0a0f1c] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-cyan-500/50 w-full sm:w-64"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0a0f1c]/50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-white/5">
                    <th className="p-4 sm:p-5">Student Number</th>
                    <th className="p-4 sm:p-5">Student Name</th>
                    <th className="p-4 sm:p-5">Program</th>
                    <th className="p-4 sm:p-5">Year & Section</th>
                    <th className="p-4 sm:p-5">RFID UID</th>
                    <th className="p-4 sm:p-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-10 text-center text-slate-500"
                      >
                        Loading student registry...
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-10 text-center text-slate-500"
                      >
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="p-4 sm:p-5 font-mono text-cyan-400 text-xs">
                          {s.student_number}
                        </td>
                        <td className="p-4 sm:p-5 font-medium text-white">
                          {formatStudentName(s)}
                        </td>
                        <td className="p-4 sm:p-5 text-slate-400 text-xs">
                          {s.program}
                        </td>
                        <td className="p-4 sm:p-5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300 text-[11px] font-semibold">
                            Year {s.year_level} • {s.section}
                          </span>
                        </td>
                        <td className="p-4 sm:p-5 font-mono text-slate-500 text-xs">
                          {s.rfid_uid}
                        </td>
                        <td className="p-4 sm:p-5 text-right">
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="text-rose-400 hover:text-rose-300 text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-all cursor-pointer"
                          >
                            Delete
                          </button>
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
    </div>
  );
}
