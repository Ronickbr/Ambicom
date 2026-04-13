/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const { userId, email, password, role, fullName } = await req.json()

        if (!userId) {
            throw new Error('User ID is required')
        }

        const updateData: any = {
            user_metadata: {
                role,
                full_name: fullName
            }
        }

        if (email) updateData.email = email
        if (password) updateData.password = password

        const { data: userData, error: userError } = await supabaseClient.auth.admin.updateUserById(
            userId,
            updateData
        )

        if (userError) throw userError

        // Also update the profiles table directly for role/full_name redundancy/trigger sync
        const { error: profileError } = await supabaseClient
            .from('profiles')
            .update({
                role,
                full_name: fullName
            })
            .eq('id', userId)

        if (profileError) throw profileError

        return new Response(
            JSON.stringify(userData),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return new Response(
            JSON.stringify({ error: errorMessage }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
