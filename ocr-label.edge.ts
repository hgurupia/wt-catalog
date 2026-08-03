// ============================================================
//  Supabase Edge Function: ocr-label
//  Lee una etiqueta ESCRITA A MANO (foto) con Claude (visión)
//  y devuelve los campos del producto en JSON.
//
//  Cómo desplegar (en el Dashboard de Supabase):
//   1) Edge Functions → "Create a new function" → nombre EXACTO: ocr-label
//   2) Pega TODO este archivo → Deploy
//   3) En la función, apaga "Verify JWT" (Details → Verify JWT = off)
//   4) Edge Functions → Secrets (o Project Settings → Edge Functions):
//        ANTHROPIC_API_KEY = tu llave de console.anthropic.com  (obligatoria)
//        GATE_KEY          = la MISMA publishable key de la app  (recomendado)
//        OCR_MODEL         = claude-opus-5   (opcional; puedes poner claude-sonnet-5 para abaratar)
//  URL final: https://vkqsmwbhwekfwmdzihjj.supabase.co/functions/v1/ocr-label
// ============================================================

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const GATE_KEY = Deno.env.get("GATE_KEY") || "";
const MODEL = Deno.env.get("OCR_MODEL") || "claude-opus-5";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-gate",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "usa POST" }, 405);
  try {
    if (GATE_KEY && req.headers.get("x-gate") !== GATE_KEY) return json({ error: "no autorizado" }, 401);
    if (!ANTHROPIC_API_KEY) return json({ error: "falta ANTHROPIC_API_KEY en los secrets" }, 500);

    const body = await req.json().catch(() => ({}));
    const image: string = body.image || "";
    if (!image) return json({ error: "falta la imagen" }, 400);
    const b64 = image.includes(",") ? image.split(",")[1] : image;
    const media_type: string = body.media_type || "image/jpeg";

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        brand: { type: "string" },
        style: { type: "string" },
        color: { type: "string" },
        size: { type: "string" },
        upc: { type: "string" },
        qty: { type: "integer" },
        cat: { type: "string" },
        gender: { type: "string" },
        raw_text: { type: "string" },
      },
      required: ["brand", "style", "color", "size", "upc", "qty", "cat", "gender", "raw_text"],
    };

    const prompt =
      `Esta es la foto de una etiqueta ESCRITA A MANO (bolígrafo) pegada por fuera de una caja de ropa. ` +
      `Lee la letra manuscrita con cuidado y extrae los datos del producto.\n` +
      `Devuelve: brand (marca), style (estilo/código de estilo), color, size (talla), ` +
      `upc (SOLO los dígitos del código de barras si aparece), qty (cantidad de piezas, entero), ` +
      `cat (tipo de prenda como Polo/T-Shirt/Sweatshirt si se deduce), ` +
      `gender (Men/Ladies/Youth/Kid/Baby/Unisex si se deduce) y ` +
      `raw_text con TODO el texto que leíste, tal cual.\n` +
      `Si un campo no aparece, déjalo como cadena vacía ("") y qty en 0. No inventes datos.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        output_config: { effort: "low", format: { type: "json_schema", schema } },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type, data: b64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!r.ok) return json({ error: "anthropic " + r.status + ": " + (await r.text()).slice(0, 300) }, 502);
    const data = await r.json();
    if (data.stop_reason === "refusal") return json({ error: "la IA no pudo procesar la imagen" }, 422);

    const textBlock = (data.content || []).find((b: any) => b.type === "text");
    let fields: any = {};
    try { fields = JSON.parse(textBlock?.text || "{}"); }
    catch { fields = { raw_text: textBlock?.text || "" }; }
    return json({ ok: true, fields });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
