export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    const INFURA_ID = process.env.NEXT_PUBLIC_INFURA_ID;
    const INFURA_SECRET = process.env.INFURA_SECRET;

    const auth = Buffer.from(`${INFURA_ID}:${INFURA_SECRET}`).toString("base64");
    const url = `https://sepolia.infura.io/v3/${INFURA_ID}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: bodyText,
    });

    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { "Content-Type": resp.headers.get("content-type") || "application/json" },
    });
  } catch (err: any) {
    const msg = err?.message || "Proxy error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}


