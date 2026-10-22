const BASE = "https://api.syncpayments.com.br";

let cached: { token: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const client_id = process.env["SYNCPAY_CLIENT_ID"];
  const client_secret = process.env["SYNCPAY_CLIENT_SECRET"];
  if (!client_id || !client_secret) throw new Error("SyncPay não configurada");
  const res = await fetch(`${BASE}/api/partner/v1/auth-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id, client_secret }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`SyncPay auth failed [${res.status}]: ${text}`);
    throw new Error(`Falha ao autenticar na SyncPay [${res.status}]`);
  }
  const json = JSON.parse(text) as { access_token: string; expires_in?: number };
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

export async function createPixCharge(input: {
  amount: number;
  description: string;
  webhookUrl: string;
  client: { name: string; cpf: string; email: string; phone: string };
}): Promise<{ pixCode: string; identifier: string }> {
  const token = await getToken();
  const res = await fetch(`${BASE}/api/partner/v1/cash-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      amount: input.amount,
      description: input.description,
      webhook_url: input.webhookUrl,
      client: input.client,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`SyncPay cash-in failed [${res.status}]: ${text}`);
    throw new Error(`Não foi possível gerar o PIX [${res.status}]: ${text.slice(0, 200)}`);
  }
  const json = JSON.parse(text) as { pix_code: string; identifier: string };
  return { pixCode: json.pix_code, identifier: json.identifier };
}

export async function isChargePaid(identifier: string): Promise<boolean> {
  const token = await getToken();
  const res = await fetch(`${BASE}/api/partner/v2/transactions/${encodeURIComponent(identifier)}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error(`SyncPay status failed [${res.status}]: ${await res.text()}`);
    return false;
  }
  const json = (await res.json()) as { data?: { transaction?: { status?: string } } };
  const status = (json.data?.transaction?.status ?? "").toLowerCase();
  return ["completed", "paid", "paid_out", "approved"].includes(status);
}
