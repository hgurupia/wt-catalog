// ============================================================
//  Supabase Edge Function: ocr-label
//  Lee una etiqueta ESCRITA A MANO (foto) con Claude (visión).
//  Soporta etiquetas de UN producto Y cuadrículas de VARIOS
//  productos (filas por estilo/color/UPC, columnas por talla).
//  Devuelve { ok:true, items:[...], raw_text }.
//
//  Deploy (Dashboard): Edge Functions → función "ocr-label" →
//   Code → pegar todo → Deploy. Verify JWT = OFF.
//   Secrets: ANTHROPIC_API_KEY, GATE_KEY (=publishable key),
//            OCR_MODEL (opcional, ej. claude-sonnet-5).
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

    const item = {
      type: "object",
      additionalProperties: false,
      properties: {
        brand: { type: "string" },
        style: { type: "string" },
        color: { type: "string" },
        cc: { type: "string" },
        size: { type: "string" },
        upc: { type: "string" },
        qty: { type: "integer" },
        cat: { type: "string" },
        gender: { type: "string" },
      },
      required: ["brand", "style", "color", "cc", "size", "upc", "qty", "cat", "gender"],
    };
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        items: { type: "array", items: item },
        raw_text: { type: "string" },
      },
      required: ["items", "raw_text"],
    };

    const prompt =
      `Esta es la foto de una etiqueta ESCRITA A MANO (bolígrafo) de una caja/lote de ropa. ` +
      `Léela con cuidado y devuelve un ARREGLO "items" con TODOS los productos que aparezcan.\n\n` +
      `MUY IMPORTANTE — muchas etiquetas son una CUADRÍCULA/TABLA con varias filas:\n` +
      `- La MARCA suele estar en el encabezado, arriba (aplica a TODAS las filas).\n` +
      `- Las columnas suelen ser: STYLE (estilo), COLOR, y luego tallas S, M, L, XL, 2XL, 3XL, 4XL.\n` +
      `- Cada FILA es un producto: tiene su propio estilo (style) y color. El estilo puede terminar en letra ` +
      `(ej. S790Y donde la Y = Youth) — respétala tal cual.\n` +
      `- ¡MUY IMPORTANTE! Justo DESPUÉS de la columna COLOR suele haber una columna angosta con un ` +
      `número CORTO de 1 a 3 dígitos (ej. 52, 67, 00, 11) — eso es el CÓDIGO DE COLOR (campo "cc"), ` +
      `NO es el UPC. Ponlo en "cc".\n` +
      `- El UPC es un CÓDIGO DE BARRAS LARGO (normalmente 11 a 13 dígitos, ej. 711311853376). ` +
      `SOLO llena "upc" si ves un número largo así; si la etiqueta no tiene código de barras, deja upc="".\n` +
      `- Después vienen las columnas de talla: S, M, L, XL, 2XL, 3XL, 4XL. ` +
      `Las CANTIDADES están escritas a mano en esas celdas. ` +
      `Cada celda de talla con un número = un item separado con esa talla (size) y esa cantidad (qty).\n\n` +
      `Reglas de salida por cada item: brand (marca del encabezado), style, color, ` +
      `cc (el código de color corto de 1-3 dígitos de esa fila; si no hay, ""), ` +
      `size (la talla de esa celda, en mayúsculas: S/M/L/XL/2XL/3XL/4XL — si la celda dice XS úsalo tal cual), ` +
      `qty (el número escrito en esa celda, entero), ` +
      `upc (SOLO un código de barras largo de 11-13 dígitos; casi siempre "" en estas etiquetas), ` +
      `cat (tipo de prenda como Polo/T-Shirt/Sweatshirt si se deduce, si no ""), ` +
      `gender (Men/Ladies/Youth/Kid/Baby/Unisex si se deduce, si no "").\n` +
      `Si una etiqueta es de UN SOLO producto (no cuadrícula), devuelve un solo item.\n` +
      `Incluye una celda solo si tiene un número escrito a mano claro; ignora las celdas vacías. ` +
      `No inventes datos: si un campo no aparece, déjalo "" (y qty 0 solo si de verdad no hay número).\n` +
      `Además, "raw_text" = TODO el texto que leíste, tal cual, para referencia.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
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
    let parsed: any = {};
    try { parsed = JSON.parse(textBlock?.text || "{}"); }
    catch { parsed = { items: [], raw_text: textBlock?.text || "" }; }
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return json({ ok: true, items, raw_text: parsed.raw_text || "" });
  } catch (e) {
    return json({ error: String(e).slice(0, 300) }, 500);
  }
});
