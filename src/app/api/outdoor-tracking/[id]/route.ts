import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = getSupabaseAdminClient();

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.paymentStatus) updatePayload.payment_status = body.paymentStatus;
    if (body.paymentMethod !== undefined) updatePayload.payment_method = body.paymentMethod || null;
    if (body.notes !== undefined) updatePayload.notes = body.notes || null;
    if (body.attendanceStatus) updatePayload.attendance_status = body.attendanceStatus;
    if (body.sessionsUsed !== undefined) updatePayload.sessions_used = Number(body.sessionsUsed);
    if (body.markPaid === true) {
      updatePayload.payment_status = "paid";
      updatePayload.paid_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("manual_class_enrollments")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      if ((error as { code?: string } | null)?.code === "42P01") {
        return NextResponse.json(
          { success: false, error: "Outdoor tracking table not found. Run latest Supabase migrations first." },
          { status: 400 },
        );
      }
      return NextResponse.json({ success: false, error: error?.message || "Failed to update record" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase.from("manual_class_enrollments").delete().eq("id", id);
    if (error) {
      if ((error as { code?: string }).code === "42P01") {
        return NextResponse.json(
          { success: false, error: "Outdoor tracking table not found. Run latest Supabase migrations first." },
          { status: 400 },
        );
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
