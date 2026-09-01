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
    let { rfid_uid } = await request.json();
    const currentDevice = "Smart_Classroom_1";

    if (!rfid_uid)
      return NextResponse.json(
        { success: false, status: "error", message: "Missing RFID UID" },
        { status: 400 },
      );

    // Clean up the incoming RFID UID
    rfid_uid = String(rfid_uid).trim().toUpperCase();

    // 1. Fetch all students to check matching
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

    // 3. IF CARD IS UNREGISTERED
    if (!student) {
      // If a class session is running, strictly reject unknown cards!
      if (isClassRunning) {
        return NextResponse.json(
          { success: false, status: "error", message: "Unregistered Card" },
          { status: 404 },
        );
      }

      // If NO class session is running, automatically assign this card to the first student missing a UID!
      const targetStudent = students.find(
        (s) => !s.rfid_uid || s.rfid_uid.trim() === "",
      );

      if (targetStudent) {
        const { error: updateError } = await supabase
          .from("students")
          .update({ rfid_uid: rfid_uid })
          .eq("id", targetStudent.id);

        if (updateError) {
          return NextResponse.json(
            {
              success: false,
              status: "error",
              message: "Failed to assign card",
            },
            { status: 500 },
          );
        }

        return NextResponse.json({
          success: true,
          status: "assigned",
          message: `Assigned to ${targetStudent.first_name} ${targetStudent.last_name}`,
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

    // 4. IF STUDENT IS FOUND, BUT NO CLASS IS ACTIVE
    if (!isClassRunning) {
      return NextResponse.json({
        success: false,
        status: "error",
        message: "No Class Active",
      });
    }

    // 5. Time & Spam Prevention (Philippine Time UTC+8)
    const now = new Date();
    const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayDate = phTime.toISOString().split("T")[0];
    const timeString = phTime.toISOString().split("T")[1].split(".")[0];

    const fiveMinutesAgo = new Date(
      now.getTime() - 5 * 60 * 1000 + 8 * 60 * 60 * 1000,
    );
    const timeLimitString = fiveMinutesAgo
      .toISOString()
      .split("T")[1]
      .split(".")[0];

    const { data: recentLogs } = await supabase
      .from("attendance")
      .select("id")
      .eq("student_id", student.id)
      .eq("attendance_date", todayDate)
      .eq("subject", activeClass.subject)
      .gte("attendance_time", timeLimitString);

    if (recentLogs && recentLogs.length > 0) {
      return NextResponse.json({
        success: false,
        status: "duplicate",
        message: "Already Logged In",
      });
    }

    // 6. INSERT THE ATTENDANCE TAP
    const { error: insertError } = await supabase.from("attendance").insert([
      {
        student_id: student.id,
        attendance_date: todayDate,
        attendance_time: timeString,
        status: "Present",
        device_id: currentDevice,
        subject: activeClass.subject,
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
