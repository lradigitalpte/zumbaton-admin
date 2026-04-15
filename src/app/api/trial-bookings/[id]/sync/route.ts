import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getPaymentRequestStatus } from "@/services/hitpay.service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdminClient();

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, status, payment_id, guest_name, is_trial_booking")
      .eq("id", id)
      .eq("is_trial_booking", true)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ success: false, message: "Trial booking not found." }, { status: 404 });
    }

    if (!booking.payment_id) {
      return NextResponse.json({ success: false, message: "No payment linked to this booking." }, { status: 400 });
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id, status, amount_cents, currency, hitpay_payment_request_id, metadata")
      .eq("id", booking.payment_id)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ success: false, message: "Payment not found." }, { status: 404 });
    }

    if (!payment.hitpay_payment_request_id) {
      return NextResponse.json({ success: false, message: "Payment has no HitPay request ID." }, { status: 400 });
    }

    const hitpay = await getPaymentRequestStatus(payment.hitpay_payment_request_id);
    const hitpayStatus = hitpay?.status?.toLowerCase();
    const hitpayPaymentId = hitpay?.payments?.[0]?.id ?? null;

    if (hitpayStatus !== "completed" && hitpayStatus !== "succeeded") {
      return NextResponse.json({
        success: true,
        synced: false,
        message: "Payment is not completed on HitPay yet.",
        paymentStatus: payment.status,
        hitpayStatus,
      });
    }

    await supabase
      .from("payments")
      .update({
        status: "succeeded",
        hitpay_payment_id: hitpayPaymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    await supabase
      .from("bookings")
      .update({
        status: "confirmed",
        booked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    const { data: existingTx } = await supabase
      .from("token_transactions")
      .select("id")
      .eq("booking_id", booking.id)
      .eq("transaction_type", "trial-booking-purchase")
      .maybeSingle();

    if (!existingTx) {
      const metadata = (payment.metadata as Record<string, unknown> | null) || {};
      const classTitle = typeof metadata.class_title === "string" ? metadata.class_title : "Trial class";

      await supabase.from("token_transactions").insert({
        user_id: null,
        booking_id: booking.id,
        transaction_type: "trial-booking-purchase",
        tokens_change: 1,
        tokens_before: 0,
        tokens_after: 1,
        description: `Trial class: ${classTitle} (${booking.guest_name || "Guest"})`,
      });
    }

    return NextResponse.json({
      success: true,
      synced: true,
      message: "Payment synced and booking confirmed.",
      hitpayStatus,
    });
  } catch (error) {
    console.error("[Trial Booking Sync] Error:", error);
    return NextResponse.json({ success: false, message: "Failed to sync payment." }, { status: 500 });
  }
}
