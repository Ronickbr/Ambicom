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
        const openaiKey = Deno.env.get('OPENAI_API_KEY');
        // Forçando um modelo estável para teste
        const model = Deno.env.get('OPENAI_MODEL') || "gpt-4o-mini";

        if (!openaiKey) {
            throw new Error('CONFIG_MISSING: OPENAI_API_KEY não está definida nas Secrets do Supabase.');
        }

        if (!image) {
            throw new Error('VALIDATION_ERROR: O campo "image" (base64) é obrigatório.');
        }

        console.log(`OpenAI Request: Model=${model}`);

        const response = await fetch("https://api.openai.com/v1/responses", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openaiKey}`,
                "Content-Type": "application/json"
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
                                type: "input_image",
                                image_url: `data:image/jpeg;base64,${image}`
                            }
                        ]
                    }
                ],
                response_format: {
                    type: "json_schema",
                    json_schema: {
                        name: "etiqueta_tecnica",
                        strict: true,
                        schema: {
                            type: "object",
                            properties: {
                                fabricante: { type: "string" },
                                modelo: { type: "string" },
                                codigo_comercial: { type: "string" },
                                cor: { type: "string" },
                                pnc_ml: { type: "string" },
                                numero_serie: { type: "string" },
                                data_fabricacao: { type: "string" },
                                gas_refrigerante: { type: "string" },
                                volume_total: { type: "string" },
                                tensao: { type: "string" },
                                tipo: { type: "string" },
                                classe_mercado: { type: "string" },
                                carga_gas: { type: "string" },
                                compressor: { type: "string" },
                                volume_freezer: { type: "string" },
                                volume_refrigerator: { type: "string" },
                                pressao_alta_baixa: { type: "string" },
                                capacidade_congelamento: { type: "string" },
                                corrente_eletrica: { type: "string" },
                                potencia_degelo: { type: "string" },
                                frequencia: { type: "string" }
                            },
                            required: ["fabricante", "modelo", "codigo_comercial", "cor", "pnc_ml", "numero_serie", "data_fabricacao", "gas_refrigerante", "volume_total", "tensao", "tipo", "classe_mercado", "carga_gas", "compressor", "volume_freezer", "volume_refrigerator", "pressao_alta_baixa", "capacidade_congelamento", "corrente_eletrica", "potencia_degelo", "frequencia"],
                            additionalProperties: false
                        }
                    }
                }
            })
        });

        const resData = await response.json();
        console.log(`OpenAI Status: ${response.status}`);

        if (!response.ok) {
            // Retorna o erro exato da OpenAI para o frontend
            const aiError = resData.error?.message || JSON.stringify(resData);
            throw new Error(`OPENAI_REJECTED (${response.status}): ${aiError}`);
        }

        const content = resData.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error('IA_EMPTY_CONTENT: A OpenAI não devolveu conteúdo na resposta.');
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
            diagnostic: "Check your OpenAI credits or API key status on their dashboard."
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
