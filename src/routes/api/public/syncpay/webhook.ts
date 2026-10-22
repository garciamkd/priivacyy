import { createFileRoute } from "@tanstack/react-router";
import { refreshOrder } from "@/lib/orders.server";

// SyncPay calls this when a charge changes. We never trust the body:
// the order is re-checked directly against the SyncPay API.
export const Route = createFileRoute("/api/public/syncpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ ok: true });
        }
        const d = (body.data ?? body) as Record<string, unknown>;
        const id = String(d.identifier ?? d.id ?? d.reference_id ?? "");
        if (!id) return Response.json({ ok: true });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: order } = await supabaseAdmin.from("orders").select("id").eq("syncpay_id", id).maybeSingle();
        if (order) await refreshOrder(order.id);
        return Response.json({ ok: true });
      },
    },
  },
});
