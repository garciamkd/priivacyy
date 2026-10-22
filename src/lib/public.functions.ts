import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { createPixCharge } from "./syncpay.server";
import { refreshOrder } from "./orders.server";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function toBrowserUrl(url: string) {
  const server = (process.env["SUPABASE_URL"] ?? "").replace(/\/+$/, "");
  const pub = (import.meta.env["VITE_SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "").replace(/\/+$/, "");
  return server && pub && url.startsWith(server) ? pub + url.slice(server.length) : url;
}

export const getPublicPage = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [{ data: settings }, { data: offers }, { data: gallery }] = await Promise.all([
    sb.from("site_settings").select("*").eq("id", 1).single(),
    sb.from("offers").select("id, title, subtitle, price, position").eq("active", true).order("position"),
    sb.from("gallery").select("id, image_url, position").order("position").order("created_at"),
  ]);
  const paths = [settings?.avatar_url, settings?.cover_url, ...(gallery ?? []).map((g) => g.image_url)].filter(
    (p): p is string => !!p,
  );
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data } = await sb.storage.from("media").createSignedUrls(paths, 60 * 60 * 12);
    for (const d of data ?? []) if (d.path && d.signedUrl) urls[d.path] = toBrowserUrl(d.signedUrl);
  }
  return {
    settings: settings!,
    offers: (offers ?? []).map((o) => ({ ...o, price: Number(o.price) })),
    avatar: settings?.avatar_url ? urls[settings.avatar_url] ?? null : null,
    cover: settings?.cover_url ? urls[settings.cover_url] ?? null : null,
    gallery: (gallery ?? []).map((g) => urls[g.image_url]).filter(Boolean) as string[],
  };
});

const orderSchema = z.object({ offerId: z.string().uuid() });

export const createPixOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: offer } = await supabaseAdmin
      .from("offers")
      .select("id, title, price, active")
      .eq("id", data.offerId)
      .maybeSingle();
    if (!offer || !offer.active) throw new Error("Oferta indisponível");
    const amount = Number(offer.price);
    const origin = new URL(getRequest().url).origin;
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        offer_id: offer.id,
        offer_title: offer.title,
        amount,
        buyer_name: "",
        buyer_email: "",
        buyer_cpf: "",
        buyer_phone: "",
      })
      .select("id")
      .single();
    if (error || !order) throw new Error("Não foi possível criar o pedido");
    const charge = await createPixCharge({
      amount,
      description: offer.title,
      webhookUrl: `${origin}/api/public/syncpay/webhook`,
    });
    await supabaseAdmin
      .from("orders")
      .update({ syncpay_id: charge.identifier, pix_code: charge.pixCode })
      .eq("id", order.id);
    return { orderId: order.id, pixCode: charge.pixCode, amount };
  });

export const checkOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const status = await refreshOrder(data.orderId);
    if (status !== "paid") return { paid: false as const, accessLink: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: priv } = await supabaseAdmin.from("site_private").select("access_link").eq("id", 1).single();
    return { paid: true as const, accessLink: priv?.access_link ?? "" };
  });
