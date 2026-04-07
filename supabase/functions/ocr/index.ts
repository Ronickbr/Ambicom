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
        const { image } = await req.json()
        const openRouterKey = Deno.env.get('OPENROUTER_KEY')
        const model = Deno.env.get('OPENROUTER_MODEL') || "openai/gpt-4o-mini"

        if (!openRouterKey) {
            throw new Error('OPENROUTER_KEY não configurada nas variáveis de ambiente da Edge Function')
        }

        if (!image) {
            throw new Error('Nenhuma imagem fornecida')
        }

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openRouterKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://supabase.com",
                "X-Title": "Scan Relatorio OCR"
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Analise esta etiqueta de produto (geralmente Electrolux) e extraia os dados técnicos. Retorne APENAS um objeto JSON com estes campos (use nulo se não encontrar): fabricante, modelo, codigo_comercial, cor, pnc_ml, numero_serie, data_fabricacao, gas_refrigerante, volume_total, tensao, tipo, classe_mercado, carga_gas, compressor, volume_freezer, volume_refrigerator, pressao_alta_baixa, capacidade_congelamento, corrente_eletrica, potencia_degelo, frequencia. Não escreva nada além do JSON."
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
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
        }

        const result = await response.json()
        const content = result.choices[0]?.message?.content

        return new Response(JSON.stringify({ content }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred'
        return new Response(JSON.stringify({ error: message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
