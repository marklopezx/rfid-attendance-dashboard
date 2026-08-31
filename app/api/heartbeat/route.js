import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    const { device_id } = await request.json();
    const targetDevice = device_id || "Smart_Classroom_1";

    const now = new Date();
    const phTime = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();

    // Update last_seen for the device
    const { error } = await supabase
      .from("active_classes")
      .update({ last_seen: phTime })
      .eq("device_id", targetDevice);

    if (error) {
      // If row doesn't exist yet, insert a standby row
      await supabase
        .from("active_classes")
        .upsert([
          { device_id: targetDevice, is_active: false, last_seen: phTime },
        ]);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
