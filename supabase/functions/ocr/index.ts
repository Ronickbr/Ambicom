// @ts-expect-error: Deno is defined in the Supabase Edge Runtime environment
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
        const provider = "openai";
        const endpoint = "https://api.openai.com/v1/responses";
        const build = "2026-04-25";

        if (!openaiKey) {
            throw new Error('CONFIG_MISSING: OPENAI_API_KEY não está definida nas Secrets do Supabase.');
        }

        if (!image) {
            throw new Error('VALIDATION_ERROR: O campo "image" (base64) é obrigatório.');
        }

        console.log(`OpenAI Request: Provider=${provider} Endpoint=${endpoint} Model=${model} Build=${build}`);

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openaiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: model,
                input: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "input_text",
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

        const content =
            typeof resData?.output_text === "string" && resData.output_text.trim().length > 0
                ? resData.output_text
                : undefined;

        if (!content) {
            throw new Error('IA_EMPTY_CONTENT: A OpenAI não devolveu conteúdo na resposta.');
        }

        return new Response(JSON.stringify({ content, provider, model, build }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erro fatal desconhecido';
        console.error('Edge Function Trace:', message);

        return new Response(JSON.stringify({
            error: message,
            provider: "openai",
            diagnostic: "Verifique se a secret OPENAI_API_KEY está correta e se há créditos/limites na conta da OpenAI."
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
