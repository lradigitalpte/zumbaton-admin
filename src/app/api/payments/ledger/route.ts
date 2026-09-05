import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/middleware/rbac";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user || !["super_admin", "admin"].includes(user.role)) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.get("pageSize")) || 20));
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("payments").select("id, created_at, updated_at, status, amount_cents, currency, provider, user_id, class_id, is_trial_booking, metadata", { count: "exact" }).order("created_at", { ascending: false });
  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", endDate);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  const userIds = [...new Set((data || []).map((p) => p.user_id).filter(Boolean))] as string[];
  const paymentIds = (data || []).map((p) => p.id);
  const [profilesResult, bookingsResult] = await Promise.all([
    userIds.length ? supabase.from("user_profiles").select("id,name,email").in("id", userIds) : Promise.resolve({ data: [] }),
    paymentIds.length ? supabase.from("bookings").select("payment_id,guest_name,guest_email,class_id,status,classes(title,scheduled_at)").in("payment_id", paymentIds) : Promise.resolve({ data: [] }),
  ]);
  const profiles = new Map((profilesResult.data || []).map((p: any) => [p.id, p]));
  const bookings = new Map((bookingsResult.data || []).map((b: any) => [b.payment_id, b]));
  const payments = (data || []).map((p) => {
    const meta = (p.metadata || {}) as Record<string, any>;
    const profile: any = p.user_id ? profiles.get(p.user_id) : null;
    const booking: any = bookings.get(p.id);
    return {
      id: p.id, createdAt: p.created_at, status: p.status, amount: Number(p.amount_cents || 0) / 100,
      currency: p.currency || "SGD", provider: p.provider || "", isTrial: p.is_trial_booking,
      customerName: meta.guest_name || meta.parent_name || profile?.name || booking?.guest_name || "Unknown",
      customerEmail: meta.guest_email || meta.parent_email || profile?.email || booking?.guest_email || "",
      flowType: meta.flow_type || (p.is_trial_booking ? "trial_booking" : "package"),
      needsScheduling: meta.needs_scheduling === true && !p.class_id,
      className: booking?.classes?.title || meta.booked_class_title || "",
      classAt: booking?.classes?.scheduled_at || meta.booked_class_at || null,
      bookingStatus: booking?.status || "",
    };
  });
  return NextResponse.json({ success: true, data: { payments, total: count || 0, page, pageSize } });
}
