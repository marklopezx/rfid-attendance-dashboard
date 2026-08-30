import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET: Fetch all registered students for the dashboard table
export async function GET() {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, students: data });
}

// POST: Register a new student and assign an RFID UID
export async function POST(request) {
  try {
    const body = await request.json();
    const { student_id, full_name, program, year_level, section, rfid_uid } =
      body;

    if (!student_id || !full_name || !rfid_uid) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("students")
      .insert([
        {
          student_id,
          full_name,
          program,
          year_level: parseInt(year_level) || 1,
          section,
          rfid_uid,
          status: "Active",
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            success: false,
            message: "Student ID or RFID UID is already registered.",
          },
          { status: 400 },
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, student: data });
  } catch (error) {
    console.error("Registration Error:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
