import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const formatStudentName = (student) => {
  if (!student) return "Student";
  if (student.last_name && student.first_name) {
    return `${student.first_name} ${student.last_name}`;
  }
  return "Student";
};

export async function POST(request) {
  try {
    let { rfid_uid, device_id } = await request.json();
    const currentDevice = device_id || "Smart_Classroom_1";

    if (!rfid_uid)
      return NextResponse.json(
        { success: false, status: "error", message: "Missing RFID UID" },
        { status: 400 },
      );

    rfid_uid = String(rfid_uid).trim().toUpperCase();

    // 1. Fetch all students
    const { data: students, error: studentError } = await supabase
      .from("students")
      .select(
        "id, student_number, first_name, last_name, middle_name, section, rfid_uid",
      );

    if (studentError || !students) {
      return NextResponse.json(
        { success: false, status: "error", message: "Database Error" },
        { status: 500 },
      );
    }

    // Match RFID flexibly
    const student = students.find((s) => {
      if (!s.rfid_uid) return false;
      const dbUid = String(s.rfid_uid).trim().toUpperCase();
      return (
        dbUid === rfid_uid ||
        dbUid.replace(/[\s:]/g, "") === rfid_uid.replace(/[\s:]/g, "")
      );
    });

    // 2. CHECK IF CLASS IS ACTIVE
    const { data: activeClass } = await supabase
      .from("active_classes")
      .select("*")
      .eq("device_id", currentDevice)
      .maybeSingle();

    const isClassRunning = activeClass && activeClass.is_active;

    if (!student) {
      if (isClassRunning) {
        return NextResponse.json(
          { success: false, status: "error", message: "Unregistered Card" },
          { status: 404 },
        );
      }

      // Auto-assign logic when no class is running
      const targetStudent = students.find(
        (s) => !s.rfid_uid || s.rfid_uid.trim() === "",
      );
      if (targetStudent) {
        await supabase
          .from("students")
          .update({ rfid_uid: rfid_uid })
          .eq("id", targetStudent.id);

        return NextResponse.json({
          success: true,
          status: "assigned",
          message: `Assigned to ${targetStudent.first_name}`,
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            status: "error",
            message: "No students need cards",
          },
          { status: 400 },
        );
      }
    }

    if (!isClassRunning) {
      return NextResponse.json({
        success: false,
        status: "error",
        message: "No Class Active",
      });
    }

    // ====================================================================
    // 3. STRICT ENROLLMENT & SECTION ISOLATION CHECK
    // ====================================================================
    let subjectQuery = supabase
      .from("subjects")
      .select("id")
      .eq("subject_name", activeClass.subject)
      .eq("teacher_email", activeClass.teacher_email);

    if (activeClass.section) {
      subjectQuery = subjectQuery.eq("section", activeClass.section);
    } else {
      subjectQuery = subjectQuery.is("section", null);
    }

    const { data: subjectData } = await subjectQuery.maybeSingle();

    if (subjectData) {
      const { data: enrollmentData } = await supabase
        .from("subject_enrollments")
        .select("id")
        .eq("subject_id", subjectData.id)
        .eq("student_id", student.id)
        .maybeSingle();

      if (!enrollmentData) {
        return NextResponse.json(
          {
            success: false,
            status: "error",
            message: "Student Not Enrolled",
          },
          { status: 403 },
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          status: "error",
          message: "Class Data Error",
        },
        { status: 500 },
      );
    }

    // ====================================================================
    // 4. FULL-DAY DUPLICATE PREVENTION (Checks all logs for TODAY)
    // ====================================================================
    const now = new Date();
    const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayDate = phTime.toISOString().split("T")[0];
    const timeString = phTime.toISOString().split("T")[1].split(".")[0];

    // Check if the student already has ANY record (Present or Absent) for this subject & section TODAY
    let existingLogsQuery = supabase
      .from("attendance")
      .select("id, status")
      .eq("student_id", student.id)
      .eq("attendance_date", todayDate)
      .eq("subject", activeClass.subject);

    if (activeClass.section) {
      existingLogsQuery = existingLogsQuery.eq("section", activeClass.section);
    } else {
      existingLogsQuery = existingLogsQuery.is("section", null);
    }

    const { data: existingLogs } = await existingLogsQuery;

    if (existingLogs && existingLogs.length > 0) {
      return NextResponse.json({
        success: false,
        status: "duplicate",
        message: "Already Logged In Today",
      });
    }

    // 5. INSERT ATTENDANCE WITH SECTION ISOLATION
    const { error: insertError } = await supabase.from("attendance").insert([
      {
        student_id: student.id,
        attendance_date: todayDate,
        attendance_time: timeString,
        status: "Present",
        device_id: currentDevice,
        subject: activeClass.subject,
        section: activeClass.section || null,
        teacher_email: activeClass.teacher_email,
      },
    ]);

    if (insertError) throw insertError;

    const displayName = formatStudentName(student);

    return NextResponse.json({
      success: true,
      status: "success",
      access: "granted",
      message: `Welcome, ${displayName}!`,
    });
  } catch (error) {
    console.error("Attendance Error:", error);
    return NextResponse.json(
      { success: false, status: "error", message: "Server Error" },
      { status: 500 },
    );
  }
}
