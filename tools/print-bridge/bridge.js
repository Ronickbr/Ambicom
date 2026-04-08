import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import printer from 'node-printer';
import os from 'os';
import fs from 'fs';
import path from 'path';

dotenv.config();

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const LOG_FILE = path.join(__dirname.replace(/^\/([a-zA-Z]:)/, '$1'), 'bridge.log');

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(msg);
    fs.appendFileSync(LOG_FILE, line);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bridgeName = process.env.BRIDGE_NAME || os.hostname();

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Status da Ponte ────────────────────────────────────────────────────────
async function updateBridgeStatus() {
    const printers = printer.getPrinters().map(p => p.name);

    const { error } = await supabase
        .from('active_bridges')
        .upsert({
            bridge_name: bridgeName,
            available_printers: printers,
            last_seen: new Date().toISOString()
        }, { onConflict: 'bridge_name' });

    if (error) log(`❌ Erro ao atualizar status da ponte: ${error.message}`);
    else log(`✅ Ponte "${bridgeName}" online. Impressoras: ${printers.join(', ')}`);
}

// ─── Processamento de Jobs ──────────────────────────────────────────────────
async function processPendingJobs() {
    // Busca jobs para as impressoras desta ponte
    const printers = printer.getPrinters().map(p => p.name);

    const { data: jobs, error } = await supabase
        .from('print_jobs')
        .select('*')
        .eq('status', 'pending')
        .in('printer_target', printers)
        .order('created_at', { ascending: true });

    if (error) {
        log(`❌ Erro ao buscar jobs: ${error.message}`);
        return;
    }

    for (const job of jobs) {
        await executeJob(job);
    }
}

async function executeJob(job) {
    log(`🚀 Processando Job ${job.id} para ${job.printer_target}...`);

    // Tenta marcar como processando (controle de concorrência com skip locked se fosse via SQL puro)
    // Aqui usamos um update simples com check de status
    const { data, error: lockError } = await supabase
        .from('print_jobs')
        .update({
            status: 'processing',
            processed_at: new Date().toISOString(),
            retry_count: (job.retry_count || 0) + 1
        })
        .eq('id', job.id)
        .eq('status', 'pending')
        .select();

    if (lockError || !data?.length) {
        log(`⚠️ Job ${job.id} já sendo processado por outra instância.`);
        return;
    }

    try {
        if (job.payload_type === 'zpl') {
            // Impressão Direta ZPL (Assume Raw support ou porta direta)
            // Para Windows usaremos node-printer printRaw
            await new Promise((resolve, reject) => {
                printer.printDirect({
                    data: job.payload_data,
                    printer: job.printer_target,
                    type: 'RAW',
                    success: (jobID) => {
                        log(`✅ Job ${job.id} enviado com ID SO: ${jobID}`);
                        resolve(jobID);
                    },
                    error: (err) => reject(err)
                });
            });
        } else {
            throw new Error(`Tipo de payload não suportado: ${job.payload_type}`);
        }

        // Sucesso
        await supabase
            .from('print_jobs')
            .update({ status: 'completed' })
            .eq('id', job.id);

    } catch (err) {
        log(`❌ Falha no Job ${job.id}: ${err.message}`);

        const isRetryable = (job.retry_count || 0) < 3;
        await supabase
            .from('print_jobs')
            .update({
                status: isRetryable ? 'pending' : 'failed',
                error_log: err.message
            })
            .eq('id', job.id);
    }
}

// ─── Loop e Realtime ────────────────────────────────────────────────────────
updateBridgeStatus();
setInterval(updateBridgeStatus, 60000); // Heartbeat a cada 1min

// Otimização: Busca imediata em vez de esperar realtime inicial
processPendingJobs();

// Ouvir novos inserts via Realtime
supabase
    .channel('print_queue')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'print_jobs' }, () => {
        log("🔔 Novo job detectado na fila...");
        processPendingJobs();
    })
    .subscribe();

log("📡 Aguardando impressões remotas...");
