import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createPixOrder, checkOrder } from "@/lib/public.functions";
import { brl } from "@/lib/format";

type Offer = { id: string; title: string; subtitle: string; price: number };

export function Checkout({ offer, onClose }: { offer: Offer | null; onClose: () => void }) {
  const createFn = useServerFn(createPixOrder);
  const checkFn = useServerFn(checkOrder);
  const [form, setForm] = useState({ name: "", email: "", cpf: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState<{ orderId: string; pixCode: string } | null>(null);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    if (!offer) {
      setPix(null);
      setLink(null);
    }
  }, [offer]);

  useEffect(() => {
    if (!pix || link !== null) return;
    const t = setInterval(async () => {
      try {
        const r = await checkFn({ data: { orderId: pix.orderId } });
        if (r.paid) setLink(r.accessLink ?? "");
      } catch {
        /* keep polling */
      }
    }, 4000);
    return () => clearInterval(t);
  }, [pix, link, checkFn]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!offer) return;
    const cpf = form.cpf.replace(/\D/g, "");
    const phone = form.phone.replace(/\D/g, "");
    if (cpf.length !== 11) return toast.error("CPF inválido");
    if (phone.length < 10) return toast.error("Telefone inválido");
    setLoading(true);
    try {
      const r = await createFn({ data: { offerId: offer.id, name: form.name, email: form.email, cpf, phone } });
      setPix({ orderId: r.orderId, pixCode: r.pixCode });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar PIX");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!offer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{link !== null ? "Pagamento aprovado!" : pix ? "Pague com PIX" : "Finalizar assinatura"}</DialogTitle>
        </DialogHeader>
        {offer && (
          <div className="flex items-center justify-between rounded-xl bg-accent px-4 py-3 text-sm">
            <span className="font-medium text-accent-foreground">{offer.title}</span>
            <span className="font-bold text-accent-foreground">{brl(offer.price)}</span>
          </div>
        )}

        {link !== null ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success text-success-foreground">
              <Check className="h-7 w-7" />
            </div>
            <p className="text-sm text-muted-foreground">Seu acesso foi liberado. Toque no botão abaixo para entrar.</p>
            <Button asChild className="h-12 w-full bg-gradient-primary text-base font-semibold">
              <a href={link} target="_blank" rel="noreferrer">Acessar conteúdo agora</a>
            </Button>
          </div>
        ) : pix ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto w-fit rounded-xl border bg-card p-3">
              <QRCodeSVG value={pix.pixCode} size={200} />
            </div>
            <div className="break-all rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">{pix.pixCode}</div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(pix.pixCode);
                toast.success("Código PIX copiado");
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar código PIX
            </Button>
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Aguardando pagamento...
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {(
              [
                ["name", "Nome completo", "text"],
                ["email", "E-mail", "email"],
                ["cpf", "CPF", "text"],
                ["phone", "Telefone (com DDD)", "tel"],
              ] as const
            ).map(([k, label, type]) => (
              <div key={k} className="space-y-1">
                <Label htmlFor={k}>{label}</Label>
                <Input
                  id={k}
                  type={type}
                  required
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </div>
            ))}
            <Button type="submit" disabled={loading} className="h-12 w-full bg-gradient-primary text-base font-semibold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Gerar PIX - {offer && brl(offer.price)}</>}
            </Button>
            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Pagamento seguro · liberação imediata <Lock className="h-3 w-3" />
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
