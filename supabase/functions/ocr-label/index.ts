// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();

    // Validate request
    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set");
      return new Response(
        JSON.stringify({ error: "Server configuration error: GEMINI_API_KEY missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare image for Gemini (remove data:image/jpeg;base64, prefix)
    const base64Data = image.split(",")[1] || image;
    const mimeType = image.split(";")[0]?.split(":")[1] || "image/jpeg";

    // Call Gemini Vision API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Você é um especialista em extração de dados de etiquetas de eletrodomésticos da Electrolux (OCR inteligente).
                  Analise a imagem da etiqueta e extraia as seguintes informações em formato JSON estrito:
                  - fabricante (string): Geralmente "Electrolux"
                  - modelo (string): Localizado abaixo de "MODELO" (ex: IF56B, IM8S)
                  - codigo_comercial (string): Localizado abaixo de "CODIGO COMERCIAL" (ex: 02469FBA)
                  - cor (string): Localizado abaixo de "COR" (ex: 35, 30)
                  - pnc_ml (string): Localizado abaixo de "PNC/ML" (ex: 924262803 / 02)
                  - numero_serie (string): Localizado abaixo de "N. DE SERIE" (ex: 14201572)
                  - data_fabricacao (string): Localizado abaixo de "DATA FABRICACAO" (formato DD/MM/AAAA)
                  - gas_refrigerante (string): Localizado abaixo de "GAS FRIGOR." (ex: R600a)
                  - volume_total (string): Localizado abaixo de "VOL. TOTAL" (ex: 474 L)
                  - tensao (string): Localizado abaixo de "TENSAO" (ex: 220 V, 127 V)
                  
                  Retorne APENAS o JSON puro, sem blocos de código markdown ou explicações. Se um campo não for encontrado ou estiver ilegível, retorne null.`,
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: "application/json"
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API Error [${response.status}]:`, errorText);
      return new Response(
        JSON.stringify({ error: `Gemini API Error: ${response.status}`, details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("Gemini API successful response payload:", JSON.stringify(data).substring(0, 200) + "...");

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error("Gemini Response structure invalid:", data);
      throw new Error("No content received from Gemini candidates");
    }

    // Parse JSON directly as we requested application/json response_mime_type
    let result;
    try {
      result = JSON.parse(content);
    } catch (e: unknown) {
      console.error("JSON parse error:", e, "Content attempted:", content);
      // Fallback: try to extract JSON from text if it's mixed with other text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse AI response as JSON");
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Critical Function Error:", error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
