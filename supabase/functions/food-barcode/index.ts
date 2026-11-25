import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Cache-Control": "no-store",
};
Deno.serve(async (request: Request) => {
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return json({ error: "POST required" }, 405);
  try {
    if (Number(request.headers.get("content-length")) > 2048)
      return json({ error: "Request too large" }, 400);
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in required" }, 401);
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const auth = await client.auth.getUser(authorization.slice(7));
    if (auth.error || !auth.data.user) return json({ error: "Sign in required" }, 401);
    const body = await request.text();
    if (body.length > 2048) return json({ error: "Request too large" }, 400);
    let barcode: unknown;
    try {
      ({ barcode } = JSON.parse(body));
    } catch {
      return json({ error: "Invalid request body" }, 400);
    }
    if (typeof barcode !== "string" || !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(barcode))
      return json({ error: "Invalid barcode" }, 400);
    let checksum = 0;
    for (let i = barcode.length - 2, position = 0; i >= 0; i--, position++)
      checksum += Number(barcode[i]) * (position % 2 === 0 ? 3 : 1);
    if ((10 - (checksum % 10)) % 10 !== Number(barcode.at(-1)))
      return json({ error: "Invalid barcode check digit" }, 400);
    // Spend a scan only on a valid request.
    const allowance = await client.rpc("food_scan_allowance");
    if (allowance.error)
      // The budget check raises the same way for a spent budget and for missing
      // access; only the former is a rate limit.
      return /limit/i.test(allowance.error.message)
        ? json({ error: "Hourly scan limit reached" }, 429)
        : json({ error: "Scanning is not available for this account" }, 403);
    const upstream = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=code,product_name,product_name_ar,nutriments`,
      {
        headers: {
          "User-Agent": "PrimeFitness/1.0 (+https://prime-vanguard.github.io/Prime-Fitness-App/)",
        },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (upstream.status === 404) return json({ status: 0 });
    if (!upstream.ok) return json({ error: "Product provider unavailable" }, 502);
    const product = await upstream.json();
    return json({
      status: product.status,
      product: product.product
        ? {
            product_name: product.product.product_name,
            product_name_ar: product.product.product_name_ar,
            nutriments: Object.fromEntries(
              ["energy-kcal_100g", "proteins_100g", "carbohydrates_100g", "fat_100g"].map((key) => [
                key,
                product.product.nutriments?.[key],
              ]),
            ),
          }
        : undefined,
      attribution: "Open Food Facts — ODbL / DbCL",
    });
  } catch {
    return json({ error: "Lookup unavailable. Try manual entry." }, 502);
  }
});
