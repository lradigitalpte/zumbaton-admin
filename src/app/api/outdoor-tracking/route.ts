import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const search = searchParams.get("search") || "";
    const programType = searchParams.get("programType") || "all";
    const paymentStatus = searchParams.get("paymentStatus") || "all";
    const offset = (page - 1) * pageSize;

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("manual_class_enrollments")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (programType !== "all") query = query.eq("program_type", programType);
    if (paymentStatus !== "all") query = query.eq("payment_status", paymentStatus);
    if (search.trim()) {
      query = query.or(
        `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,customer_phone.ilike.%${search}%,participant_name.ilike.%${search}%`,
      );
    }

    const { data, error, count } = await query.range(offset, offset + pageSize - 1);
    if (error) {
      // If migration has not been applied yet, avoid hard-failing the page.
      if ((error as { code?: string }).code === "42P01") {
        return NextResponse.json({
          success: true,
          data: [],
          setupRequired: true,
          message: "manual_class_enrollments table not found. Run latest Supabase migrations.",
          pagination: { page, pageSize, total: 0, totalPages: 1 },
        });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdminClient();

    const sessionsPurchased = Number(body.sessionsPurchased || 1);
    const sessionsUsed = Number(body.sessionsUsed || 0);
    const validFrom = body.validFrom ? new Date(body.validFrom) : new Date();
    const validUntil = body.validUntil ? new Date(body.validUntil) : null;

    const { data, error } = await supabase
      .from("manual_class_enrollments")
      .insert({
        program_type: body.programType || "individual_lesson",
        source: "admin_manual",
        customer_name: body.customerName,
        customer_email: String(body.customerEmail || "").toLowerCase(),
        customer_phone: body.customerPhone,
        participant_name: body.participantName || null,
        package_code: body.packageCode || null,
        package_label: body.packageLabel || null,
        sessions_purchased: sessionsPurchased,
        sessions_used: sessionsUsed,
        price_cents: Number(body.priceCents || 0),
        currency: body.currency || "SGD",
        payment_status: body.paymentStatus || "pending",
        payment_method: body.paymentMethod || null,
        paid_at: body.paidAt || null,
        valid_from: validFrom.toISOString(),
        valid_until: validUntil ? validUntil.toISOString() : null,
        attendance_status: body.attendanceStatus || "not_started",
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error || !data) {
      if ((error as { code?: string } | null)?.code === "42P01") {
        return NextResponse.json(
          { success: false, error: "Outdoor tracking table not found. Run latest Supabase migrations first." },
          { status: 400 },
        );
      }
      return NextResponse.json({ success: false, error: error?.message || "Failed to create record" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
