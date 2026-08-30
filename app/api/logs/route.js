import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Force Next.js to never cache this route so you always see live taps instantly
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use the service role key to ensure the API can read all logs
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Updated to query student_number and the separated name schema
    const { data, error } = await supabase
      .from("attendance")
      .select(
        `
        *,
        students (
          student_number,
          first_name,
          last_name,
          middle_name,
          program,
          section,
          year_level
        )
      `,
      )
      .order("attendance_date", { ascending: false })
      .order("attendance_time", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      logs: data,
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      { success: false, message: "Server Error fetching logs", logs: [] },
      { status: 500 },
    );
  }
}
