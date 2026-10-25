"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const formatStudentName = (student) => {
  if (!student) return "Unknown";
  if (student.last_name && student.first_name) {
    const middle = student.middle_name ? ` ${student.middle_name}` : "";
    return `${student.last_name}, ${student.first_name}${middle}`.trim();
  }
  return student.full_name || "Unknown";
};

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination state for student directory
  const [visibleStudentsCount, setVisibleStudentsCount] = useState(15);

  // Form State
  const [studentNumber, setStudentNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [program, setProgram] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [section, setSection] = useState("");
  const [rfidUid, setRfidUid] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal State
  const [targetDeleteStudent, setTargetDeleteStudent] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [isScanMode, setIsScanMode] = useState(false);

  const fetchStudents = useCallback(async () => {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("last_name", { ascending: true });

    if (!error && data) setStudents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadInitial() {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .order("last_name", { ascending: true });

      if (isMounted) {
        if (!error && data) setStudents(data);
        setLoading(false);
      }
    }
    loadInitial();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isScanMode) return;
    const interval = setInterval(() => {
      fetchStudents();
    }, 1500);
    return () => clearInterval(interval);
  }, [isScanMode, fetchStudents]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result;
      if (!text) return;
      const rows = text
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter(Boolean);

      const newStudents = [];
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(",").map((c) => c.trim());
        if (cols.length >= 7) {
          newStudents.push({
            student_number: cols[0],
            last_name: cols[1],
            first_name: cols[2],
            middle_name: cols[3] || null,
            program: cols[4],
            year_level: parseInt(cols[5], 10) || 1,
            section: cols[6],
            rfid_uid: null,
          });
        }
      }

      if (newStudents.length > 0) {
        setLoading(true);
        const { error } = await supabase.from("students").insert(newStudents);
        if (error) {
          alert("Database Error: " + error.message);
        } else {
          alert(`Success! Imported ${newStudents.length} student profiles.`);
          fetchStudents();
        }
        setLoading(false);
      } else {
        alert("No valid rows found. Check your CSV formatting.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const activeTargetId = useMemo(() => {
    if (!isScanMode) return null;
    const target = students.find(
      (s) => !s.rfid_uid || s.rfid_uid.trim() === "",
    );
    return target ? target.id : null;
  }, [isScanMode, students]);

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
        rfid_uid: rfidUid.trim() || null,
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

  const executeDelete = async () => {
    if (!targetDeleteStudent) return;
    setIsDeleting(true);

    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", targetDeleteStudent.id);
    if (error) {
      alert("Failed to delete student: " + error.message);
    } else {
      fetchStudents();
    }

    setIsDeleting(false);
    setTargetDeleteStudent(null);
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

  const paginatedStudents = useMemo(() => {
    return filteredStudents.slice(0, visibleStudentsCount);
  }, [filteredStudents, visibleStudentsCount]);

  return (
    <div className="relative overflow-y-auto h-full p-6 sm:p-10 pb-20 font-sans">
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none z-0"></div>

      {/* COMPACT & CLASSY DELETE CONFIRMATION MODAL */}
      {targetDeleteStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-scale-up">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center text-xl mx-auto shadow-inner">
              🗑️
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-blue-950">
                Delete Student?
              </h3>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Are you sure you want to delete{" "}
                <span className="font-bold text-slate-800">
                  {formatStudentName(targetDeleteStudent)}
                </span>
                ? This will unregister their RFID card and remove all associated
                records.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={() => setTargetDeleteStudent(null)}
                disabled={isDeleting}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={isDeleting}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all shadow-sm cursor-pointer text-xs disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200/60 p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-900 text-xs font-bold uppercase tracking-wider mb-3 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-blue-900 animate-pulse"></span>
              Registry Management
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-blue-950">
              Student & RFID Database
            </h1>
            <p className="text-slate-500 text-base mt-2 font-medium">
              Register new student profiles and map their physical RFID hardware
              UID cards.
            </p>
          </div>
        </div>

        {/* TWO COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* COLUMN 1: ADD STUDENT FORM */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm h-fit">
            <h2 className="text-xl font-extrabold text-blue-950 mb-1">
              Register New Student
            </h2>
            <p className="text-slate-500 text-xs mb-6 font-medium">
              Link a student profile to an RFID key.
            </p>

            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Student Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 23-01792"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-900 shadow-sm transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Dela Cruz"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-900 shadow-sm transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Juan"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-900 shadow-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Middle Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Santos"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-900 shadow-sm transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Program
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., BSIT"
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-900 shadow-sm transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
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
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-900 shadow-sm transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Section
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 3A"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-900 shadow-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  RFID UID (Card Hex)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to assign via scanner"
                  value={rfidUid}
                  onChange={(e) => setRfidUid(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono font-bold text-blue-900 outline-none focus:border-blue-900 shadow-sm transition-all placeholder:font-sans placeholder:font-normal"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-950 hover:to-indigo-950 text-white font-bold py-3.5 px-4 rounded-xl shadow-[0_8px_20px_rgba(30,58,138,0.3)] transition-all text-sm tracking-wide mt-4 cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Registering..." : "Save Student Profile"}
              </button>
            </form>
          </div>

          {/* COLUMN 2 & 3: STUDENT DIRECTORY TABLE */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
            <div className="p-6 sm:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
              <div>
                <h2 className="text-2xl font-extrabold text-blue-950 tracking-tight">
                  Registered Directory
                </h2>
                <p className="text-slate-500 text-sm mt-1 font-medium">
                  Total active students in database: {students.length}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                <input
                  type="file"
                  id="csv-upload"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => document.getElementById("csv-upload")?.click()}
                  className="bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  Upload CSV
                </button>

                <button
                  onClick={() => setIsScanMode(!isScanMode)}
                  className={`font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm flex items-center justify-center gap-2 cursor-pointer ${
                    isScanMode
                      ? "bg-rose-600 hover:bg-rose-700 text-white shadow-[0_8px_20px_rgba(225,29,72,0.3)]"
                      : "bg-blue-900 hover:bg-blue-950 text-white shadow-[0_8px_20px_rgba(30,58,138,0.3)]"
                  }`}
                >
                  {isScanMode ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>{" "}
                      Stop Scan Mode
                    </>
                  ) : (
                    "Scan Cards Mode"
                  )}
                </button>
              </div>
            </div>

            {/* Search Bar Row */}
            <div className="px-6 py-4 border-b border-slate-100 bg-white">
              <input
                type="text"
                placeholder="Search by name, number, or RFID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-900 shadow-inner w-full transition-all"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-blue-900/10 text-blue-950 text-sm font-bold uppercase tracking-wider border-b border-blue-900/20">
                    <th className="p-5">Student Number</th>
                    <th className="p-5">Student Name</th>
                    <th className="p-5">Program</th>
                    <th className="p-5">Year & Section</th>
                    <th className="p-5">RFID UID</th>
                    <th className="p-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-12 text-center text-slate-400 font-medium"
                      >
                        Loading student registry...
                      </td>
                    </tr>
                  ) : paginatedStudents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-12 text-center text-slate-400 font-medium"
                      >
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    paginatedStudents.map((s) => {
                      const isTarget = isScanMode && s.id === activeTargetId;
                      return (
                        <tr
                          key={s.id}
                          className={`transition-colors ${
                            isTarget
                              ? "bg-blue-50/80 border-l-4 border-blue-900"
                              : "hover:bg-blue-50/40"
                          }`}
                        >
                          <td className="p-5 font-mono text-blue-900 font-bold">
                            {s.student_number}
                          </td>
                          <td className="p-5 font-bold text-slate-900">
                            {formatStudentName(s)}
                          </td>
                          <td className="p-5 text-slate-600 font-medium">
                            {s.program}
                          </td>
                          <td className="p-5">
                            <span className="bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200/60 text-slate-700 font-bold whitespace-nowrap shadow-sm">
                              Yr {s.year_level} • {s.section}
                            </span>
                          </td>
                          <td className="p-5 font-mono font-bold">
                            {s.rfid_uid ? (
                              <span className="text-slate-600">
                                {s.rfid_uid}
                              </span>
                            ) : isTarget ? (
                              <span className="text-blue-700 animate-pulse flex items-center gap-2">
                                ⏳ Tap card now...
                              </span>
                            ) : (
                              <span className="text-slate-300 italic">
                                Blank
                              </span>
                            )}
                          </td>
                          <td className="p-5 text-right">
                            <button
                              onClick={() => setTargetDeleteStudent(s)}
                              className="text-rose-600 hover:text-white hover:bg-rose-600 text-xs font-bold bg-rose-50 px-3.5 py-2 rounded-xl border border-rose-200 transition-all cursor-pointer shadow-xs"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Show More Pagination Button */}
            {filteredStudents.length > visibleStudentsCount && (
              <div className="p-6 bg-slate-50/80 border-t border-slate-100 text-center">
                <button
                  onClick={() => setVisibleStudentsCount((prev) => prev + 15)}
                  className="bg-white hover:bg-slate-100 text-blue-900 border border-slate-200 font-bold px-8 py-3 rounded-xl shadow-sm transition-all text-sm cursor-pointer inline-flex items-center gap-2"
                >
                  <span>Show More Records</span>
                  <span className="text-xs bg-blue-50 px-2.5 py-0.5 rounded-full text-blue-700 font-extrabold">
                    Showing {paginatedStudents.length} of{" "}
                    {filteredStudents.length}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
