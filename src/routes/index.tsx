import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeCheck, Heart, Image as ImageIcon, Lock, Sparkles, SquarePlay, ChevronDown } from "lucide-react";
import { getPublicPage } from "@/lib/public.functions";
import { Checkout } from "@/components/Checkout";
import { brl } from "@/lib/format";

const pageQuery = queryOptions({ queryKey: ["public-page"], queryFn: () => getPublicPage() });

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(pageQuery),
  head: ({ loaderData }) => {
    const name = loaderData?.settings.display_name ?? "Conteúdo exclusivo";
    const desc = loaderData?.settings.bio ?? "Assine e tenha acesso ao conteúdo exclusivo.";
    return {
      meta: [
        { title: `${name} | Conteúdo exclusivo` },
        { name: "description", content: desc },
        { property: "og:title", content: `${name} | Conteúdo exclusivo` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Index,
});

type Offer = { id: string; title: string; subtitle: string; price: number };

function Index() {
  const { data } = useSuspenseQuery(pageQuery);
  const s = data.settings;
  const [selected, setSelected] = useState<Offer | null>(null);
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"posts" | "midias">("posts");
  const first = data.offers[0];
  const savings = first ? Math.max(0, Math.round((1 - first.price / Number(s.promo_original_price)) * 100)) : 0;
  const tiles = data.gallery.length ? data.gallery : Array.from({ length: 6 }, () => "");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <span className="text-2xl font-extrabold tracking-tight text-foreground">
            privacy<span className="text-primary">.</span>
          </span>
          <span className="text-xs font-medium text-muted-foreground">Português</span>
        </div>
      </header>

      <main className="mx-auto max-w-xl pb-16">
        <section className="overflow-hidden bg-card shadow-soft sm:mt-4 sm:rounded-2xl">
          <div className="relative h-40 bg-gradient-primary sm:h-48">
            {data.cover && <img src={data.cover} alt="" className="h-full w-full object-cover" />}
            <div className="absolute bottom-2 right-3 flex gap-3 rounded-full bg-foreground/50 px-3 py-1 text-xs font-semibold text-background">
              <span className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" />{s.posts_count}</span>
              <span className="flex items-center gap-1"><SquarePlay className="h-3.5 w-3.5" />{s.media_count}</span>
              <span className="flex items-center gap-1"><Lock className="h-3.5 w-3.5" />{s.locked_count}</span>
              <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{s.likes_label}</span>
            </div>
          </div>
          <div className="px-5 pb-5">
           <div className="-mt-12 h-24 w-24 overflow-hidden rounded-2xl border-4 border-card bg-muted">
  {data.avatar && <img src={data.avatar} alt={s.display_name} className="h-full w-full object-contain" />}
</div>
            <h1 className="mt-2 flex items-center gap-1.5 text-xl font-bold text-foreground">
              {s.display_name} <BadgeCheck className="h-5 w-5 text-primary" />
            </h1>
            <p className="text-sm text-muted-foreground">@{s.handle}</p>
            <p className="mt-3 whitespace-pre-line text-sm text-foreground">{s.bio}</p>
          </div>
        </section>

        {first && (
          <section className="mx-4 mt-4 rounded-2xl border border-primary/30 bg-card p-5 shadow-soft sm:mx-0">
            <p className="flex items-center gap-1.5 text-sm font-bold text-primary"><Sparkles className="h-4 w-4" />{s.promo_title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.promo_text}</p>
            <button
              onClick={() => setSelected(first)}
              className="mt-4 flex w-full items-center justify-between rounded-xl bg-gradient-primary px-5 py-4 text-primary-foreground transition hover:opacity-95"
            >
              <span className="text-left">
                {savings > 0 && <span className="block text-xs font-medium opacity-90">Economize {savings}%</span>}
                <span className="font-bold">Assinar agora</span>
              </span>
              <span className="text-lg font-extrabold">{brl(first.price)}</span>
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Preço original <span className="line-through">{brl(Number(s.promo_original_price))}</span>
            </p>
          </section>
        )}

        <section className="mx-4 mt-4 rounded-2xl bg-card p-5 shadow-soft sm:mx-0">
          <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between">
            <h2 className="text-base font-bold text-foreground">Assinaturas</h2>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="mt-3 space-y-2.5">
              {data.offers.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className="flex w-full items-center justify-between rounded-xl border-2 border-secondary bg-secondary px-4 py-3.5 text-left transition hover:border-primary"
                >
                  <span>
                    <span className="block text-sm font-bold text-foreground">{o.title}</span>
                    {o.subtitle && <span className="text-xs text-secondary-foreground">{o.subtitle}</span>}
                  </span>
                  <span className="rounded-lg bg-gradient-primary px-3 py-1.5 text-sm font-bold text-primary-foreground">{brl(o.price)}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mx-4 mt-4 overflow-hidden rounded-2xl bg-card shadow-soft sm:mx-0">
          <div className="grid grid-cols-2 border-b text-sm font-semibold">
            {(["posts", "midias"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-3 ${tab === t ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
              >
                {t === "posts" ? `${s.posts_count} Posts` : `${s.media_count} Mídias`}
              </button>
            ))}
          </div>
          <div className={`grid gap-1 p-1 ${tab === "posts" ? "grid-cols-2" : "grid-cols-3"}`}>
            {tiles.map((src, i) => (
              <button
                key={i}
                onClick={() => first && setSelected(first)}
                className="relative aspect-square overflow-hidden rounded-lg bg-gradient-primary"
              >
                {src && <img src={src} alt="" className="h-full w-full scale-110 object-cover blur-xl" />}
                <span className="absolute inset-0 flex items-center justify-center bg-foreground/20">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-card/90">
                    <Lock className="h-5 w-5 text-primary" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <footer className="mt-8 px-4 text-center text-xs text-muted-foreground">
          Checkout seguro · Pagamento protegido · Ao continuar, você aceita os Termos de Compra.
        </footer>
      </main>

      <Checkout offer={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
