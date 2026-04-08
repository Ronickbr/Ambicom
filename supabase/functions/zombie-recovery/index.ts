import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function log(msg: string) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

Deno.serve(async (req: Request) => {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        console.log('🔄 Iniciando Zombie Recovery...')

        // Recupera jobs travados em "processing" por mais de 5 minutos
        // Isso acontece se a ponte cair ou o PC travar no meio da impressão
        const { data, error } = await supabase
            .from('print_jobs')
            .update({
                status: 'pending',
                error_log: 'Recuperado por Zombie Recovery (Timeout)'
            })
            .eq('status', 'processing')
            .lt('processed_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .select()

        if (error) throw error

        console.log(`✅ Recuperados ${data?.length || 0} jobs zumbis.`)

        return new Response(JSON.stringify({
            success: true,
            recovered: data?.length || 0
        }), {
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        console.error(`❌ Erro no Zombie Recovery: ${err.message}`)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
})
