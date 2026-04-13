// @ts-ignore: Deno is defined in the Supabase Edge Runtime environment
declare const Deno: any;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
    // Trata preflight do CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        let body;
        try {
            body = await req.json();
        } catch (e: unknown) {
            throw new Error(`INTERNAL_JSON_PARSE_ERROR: ${(e as Error).message}`);
        }

        const { image } = body;
        const openRouterKey = Deno.env.get('OPENROUTER_KEY');
        // Forçando um modelo estável para teste
        const model = Deno.env.get('OPENROUTER_MODEL') || "google/gemini-2.0-flash-lite-001";

        if (!openRouterKey) {
            throw new Error('CONFIG_MISSING: OPENROUTER_KEY não está definida nas Secrets do Supabase.');
        }

        if (!image) {
            throw new Error('VALIDATION_ERROR: O campo "image" (base64) é obrigatório.');
        }

        console.log(`OpenRouter Request: Model=${model}`);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openRouterKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://supabase.com",
                "X-Title": "OCR Scan"
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Extraia dados técnicos desta etiqueta industrial para JSON. Retorne apenas o JSON: fabricante, modelo, codigo_comercial, cor, pnc_ml, numero_serie, data_fabricacao, gas_refrigerante, volume_total, tensao, tipo, classe_mercado, carga_gas, compressor, volume_freezer, volume_refrigerator, pressao_alta_baixa, capacidade_congelamento, corrente_eletrica, potencia_degelo, frequencia."
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${image}`
                                }
                            }
                        ]
                    }
                ],
                response_format: { type: "json_object" }
            })
        });

        const resData = await response.json();

        if (!response.ok) {
            // Retorna o erro exato do OpenRouter para o frontend
            const orError = resData.error?.message || JSON.stringify(resData);
            throw new Error(`OPENROUTER_REJECTED (${response.status}): ${orError}`);
        }

        const content = resData.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('IA_EMPTY_CONTENT: O OpenRouter não devolveu conteúdo na resposta.');
        }

        return new Response(JSON.stringify({ content }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erro fatal desconhecido';
        console.error('Edge Function Trace:', message);

        return new Response(JSON.stringify({
            error: message,
            diagnostic: "Check your OpenRouter credits or API key status on their dashboard."
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
