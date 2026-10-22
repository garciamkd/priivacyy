import { isChargePaid } from "./syncpay.server";

/** Re-checks an order against SyncPay and marks it paid. Returns the current status. */
export async function refreshOrder(orderId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, status, syncpay_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;
  if (order.status !== "paid" && order.syncpay_id && (await isChargePaid(order.syncpay_id))) {
    await supabaseAdmin
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", order.id);
    return "paid";
  }
  return order.status;
}
