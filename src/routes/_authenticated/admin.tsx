import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Trash2, Upload, Plus, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl } from "@/lib/format";
import type { Database } from "@/integrations/supabase/types";

type Settings = Database["public"]["Tables"]["site_settings"]["Row"];
type Offer = Database["public"]["Tables"]["offers"]["Row"];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel | Editar página" },
      { name: "description", content: "Edite nome, fotos, ofertas e acesso." },
      { property: "og:title", content: "Painel | Editar página" },
      { property: "og:description", content: "Edite nome, fotos, ofertas e acesso." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

async function upload(file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

function useSigned(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return setUrl(null);
    supabase.storage.from("media").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  return url;
}

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const role = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
      return (data ?? []).length > 0;
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (role.isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;
  if (!role.data)
    return (
      <div className="p-8 text-center">
        <p>Esta conta não tem acesso ao painel.</p>
        <Button variant="outline" className="mt-4" onClick={signOut}>Sair</Button>
      </div>
    );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <span className="text-xl font-extrabold">painel<span className="text-primary">.</span></span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/" target="_blank"><ExternalLink className="mr-1 h-4 w-4" />Ver página</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4">
        <Tabs defaultValue="perfil">
          <TabsList className="w-full flex-wrap">
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            <TabsTrigger value="ofertas">Ofertas</TabsTrigger>
            <TabsTrigger value="fotos">Fotos</TabsTrigger>
            <TabsTrigger value="acesso">Acesso</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
          </TabsList>
          <TabsContent value="perfil"><ProfileTab /></TabsContent>
          <TabsContent value="ofertas"><OffersTab /></TabsContent>
          <TabsContent value="fotos"><PhotosTab /></TabsContent>
          <TabsContent value="acesso"><AccessTab /></TabsContent>
          <TabsContent value="vendas"><SalesTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 space-y-4 rounded-2xl bg-card p-5 shadow-soft">{children}</div>;
}

function ImagePicker({ label, path, onChange, round }: { label: string; path: string | null; onChange: (p: string) => void; round?: boolean }) {
  const url = useSigned(path);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div className={`overflow-hidden bg-muted ${round ? "h-20 w-20 rounded-full" : "h-20 w-36 rounded-lg"}`}>
          {url && <img src={url} alt="" className="h-full w-full object-cover" />}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <Upload className="h-4 w-4" />{busy ? "Enviando..." : "Trocar foto"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              try { onChange(await upload(f)); } catch { toast.error("Falha no envio"); }
              setBusy(false);
            }}
          />
        </label>
      </div>
    </div>
  );
}

function ProfileTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await supabase.from("site_settings").select("*").eq("id", 1).single()).data as Settings,
  });
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => { if (q.data) setS(q.data); }, [q.data]);
  if (!s) return null;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  async function save() {
    const { id: _id, updated_at: _u, ...rest } = s!;
    const { error } = await supabase.from("site_settings").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return toast.error("Erro ao salvar");
    toast.success("Perfil salvo");
    qc.invalidateQueries();
  }

  return (
    <Card>
      <ImagePicker label="Foto de perfil" path={s.avatar_url} onChange={(p) => set("avatar_url", p)} round />
      <ImagePicker label="Foto de capa" path={s.cover_url} onChange={(p) => set("cover_url", p)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" value={s.display_name} onChange={(v) => set("display_name", v)} />
        <Field label="@ usuário" value={s.handle} onChange={(v) => set("handle", v.replace(/^@/, ""))} />
      </div>
      <div className="space-y-1">
        <Label>Bio</Label>
        <Textarea value={s.bio} onChange={(e) => set("bio", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Posts" type="number" value={String(s.posts_count)} onChange={(v) => set("posts_count", Number(v))} />
        <Field label="Mídias" type="number" value={String(s.media_count)} onChange={(v) => set("media_count", Number(v))} />
        <Field label="Bloqueados" type="number" value={String(s.locked_count)} onChange={(v) => set("locked_count", Number(v))} />
        <Field label="Curtidas" value={s.likes_label} onChange={(v) => set("likes_label", v)} />
      </div>
      <Field label="Título do destaque" value={s.promo_title} onChange={(v) => set("promo_title", v)} />
      <Field label="Texto do destaque" value={s.promo_text} onChange={(v) => set("promo_text", v)} />
      <Field label="Preço original riscado (R$)" type="number" value={String(s.promo_original_price)} onChange={(v) => set("promo_original_price", Number(v))} />
      <Button onClick={save} className="bg-gradient-primary">Salvar perfil</Button>
    </Card>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} step="0.01" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function OffersTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-offers"],
    queryFn: async () => ((await supabase.from("offers").select("*").order("position")).data ?? []) as Offer[],
  });
  const refresh = () => qc.invalidateQueries();

  async function add() {
    await supabase.from("offers").insert({ title: "Nova oferta", subtitle: "", price: 9.9, position: (q.data?.length ?? 0) });
    refresh();
  }

  return (
    <div>
      {(q.data ?? []).map((o) => <OfferRow key={o.id} offer={o} onChange={refresh} />)}
      <Button variant="outline" className="mt-4 w-full" onClick={add}><Plus className="mr-1 h-4 w-4" />Adicionar oferta</Button>
    </div>
  );
}

function OfferRow({ offer, onChange }: { offer: Offer; onChange: () => void }) {
  const [o, setO] = useState(offer);
  async function save() {
    const { error } = await supabase.from("offers").update({
      title: o.title, subtitle: o.subtitle, price: Number(o.price), position: Number(o.position), active: o.active,
    }).eq("id", o.id);
    if (error) return toast.error("Erro ao salvar");
    toast.success("Oferta salva");
    onChange();
  }
  async function remove() {
    if (!confirm("Excluir esta oferta?")) return;
    await supabase.from("offers").delete().eq("id", o.id);
    onChange();
  }
  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome da oferta" value={o.title} onChange={(v) => setO({ ...o, title: v })} />
        <Field label="Subtítulo" value={o.subtitle} onChange={(v) => setO({ ...o, subtitle: v })} />
        <Field label="Preço (R$)" type="number" value={String(o.price)} onChange={(v) => setO({ ...o, price: v as unknown as number })} />
        <Field label="Ordem" type="number" value={String(o.position)} onChange={(v) => setO({ ...o, position: Number(v) })} />
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={o.active} onCheckedChange={(v) => setO({ ...o, active: v })} /> Ativa
        </label>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          <Button onClick={save} className="bg-gradient-primary">Salvar</Button>
        </div>
      </div>
    </Card>
  );
}

function PhotosTab() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-gallery"],
    queryFn: async () => {
      const { data } = await supabase.from("gallery").select("*").order("position").order("created_at");
      const rows = data ?? [];
      const { data: signed } = rows.length
        ? await supabase.storage.from("media").createSignedUrls(rows.map((r) => r.image_url), 3600)
        : { data: [] };
      return rows.map((r, i) => ({ ...r, url: signed?.[i]?.signedUrl ?? "" }));
    },
  });
  const [busy, setBusy] = useState(false);

  async function addFiles(files: FileList) {
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const path = await upload(f);
        await supabase.from("gallery").insert({ image_url: path });
      }
      toast.success("Fotos adicionadas");
    } catch { toast.error("Falha no envio"); }
    setBusy(false);
    qc.invalidateQueries();
  }

  async function remove(id: string, path: string) {
    await supabase.from("gallery").delete().eq("id", id);
    await supabase.storage.from("media").remove([path]);
    qc.invalidateQueries();
  }

  return (
    <Card>
      <p className="text-sm text-muted-foreground">Essas fotos aparecem borradas com cadeado na página.</p>
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-sm">
        <Upload className="h-5 w-5" />{busy ? "Enviando..." : "Adicionar fotos"}
        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        {(q.data ?? []).map((g) => (
          <div key={g.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
            {g.url && <img src={g.url} alt="" className="h-full w-full object-cover" />}
            <button onClick={() => remove(g.id, g.image_url)} className="absolute right-1 top-1 rounded-full bg-card p-1.5">
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AccessTab() {
  const q = useQuery({
    queryKey: ["admin-private"],
    queryFn: async () => (await supabase.from("site_private").select("access_link").eq("id", 1).single()).data?.access_link ?? "",
  });
  const [link, setLink] = useState("");
  useEffect(() => { if (q.data !== undefined) setLink(q.data); }, [q.data]);
  async function save() {
    const { error } = await supabase.from("site_private").update({ access_link: link }).eq("id", 1);
    if (error) return toast.error("Erro ao salvar");
    toast.success("Link salvo");
  }
  return (
    <Card>
      <p className="text-sm text-muted-foreground">Link entregue ao cliente só depois que o PIX é confirmado (ex.: grupo VIP do Telegram).</p>
      <Field label="Link de acesso" value={link} onChange={setLink} />
      <Button onClick={save} className="bg-gradient-primary">Salvar link</Button>
    </Card>
  );
}

function SalesTab() {
  const q = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => (await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const paid = (q.data ?? []).filter((o) => o.status === "paid");
  const total = paid.reduce((a, o) => a + Number(o.amount), 0);
  return (
    <Card>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-accent p-4"><p className="text-xs text-accent-foreground">Vendas pagas</p><p className="text-2xl font-bold">{paid.length}</p></div>
        <div className="rounded-xl bg-accent p-4"><p className="text-xs text-accent-foreground">Faturado</p><p className="text-2xl font-bold">{brl(total)}</p></div>
      </div>
      <div className="divide-y">
        {(q.data ?? []).map((o) => (
          <div key={o.id} className="flex items-center justify-between py-3 text-sm">
            <div>
              <p className="font-medium">{o.buyer_name}</p>
              <p className="text-xs text-muted-foreground">{o.offer_title} · {new Date(o.created_at).toLocaleString("pt-BR")}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{brl(Number(o.amount))}</p>
              <p className={`text-xs font-medium ${o.status === "paid" ? "text-success" : "text-muted-foreground"}`}>{o.status === "paid" ? "Pago" : "Pendente"}</p>
            </div>
          </div>
        ))}
        {!q.data?.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma venda ainda.</p>}
      </div>
    </Card>
  );
}
