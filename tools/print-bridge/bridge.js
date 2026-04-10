import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { exec } from 'child_process';

import os from 'os';
import fs from 'fs';
import path from 'path';

dotenv.config();

const __dirname = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([a-zA-Z]:)/, '$1');
const LOG_FILE = path.join(__dirname, 'bridge.log');

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

async function getPrinters() {
    return new Promise((resolve) => {
        exec('powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"', (error, stdout) => {
            if (error) {
                log(`⚠️ Erro lendo impressoras: ${error.message}`);
                resolve([]);
            } else {
                resolve(stdout.split('\n').map(p => p.trim()).filter(p => p.length > 0));
            }
        });
    });
}

// ─── Status da Ponte ────────────────────────────────────────────────────────
async function updateBridgeStatus() {
    const printers = await getPrinters();

    const { error } = await supabase
        .from('active_bridges')
        .upsert({
            bridge_name: bridgeName,
            available_printers: printers,
            last_heartbeat: new Date().toISOString()
        }, { onConflict: 'bridge_name' });

    if (error) log(`❌ Erro ao atualizar status da ponte: ${error.message}`);
    else log(`✅ Ponte "${bridgeName}" online. Impressoras: ${printers.join(', ')}`);
}

// ─── Processamento de Jobs ──────────────────────────────────────────────────
async function processPendingJobs() {
    // Busca jobs para as impressoras desta ponte
    const printers = await getPrinters();

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

    const { data, error: lockError } = await supabase
        .from('print_jobs')
        .update({
            status: 'processing',
            picked_at: new Date().toISOString(),
            attempts: (job.attempts || 0) + 1
        })
        .eq('id', job.id)
        .eq('status', 'pending')
        .select();

    if (lockError || !data?.length) {
        log(`⚠️ Job ${job.id} já sendo processado ou falha no lock. (lockError: ${lockError?.message || 'Nenhum'})`);
        return;
    }

    try {
        const type = (job.payload_type || "").trim().toLowerCase();

        if (type === 'zpl') {
            // Impressão Direta ZPL (Assume Raw support ou porta direta)
            await new Promise((resolve, reject) => {
                const jobId = `ZPL-${Date.now()}`;
                const tempFile = path.join(os.tmpdir(), `${jobId}.zpl`);

                // Força UTF-8 para evitar problemas com caracteres especiais no ZPL
                fs.writeFileSync(tempFile, job.payload_data, 'utf8');

                const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${path.join(__dirname, 'print_raw.ps1')}" -PrinterName "${job.printer_target}" -FilePath "${tempFile}"`;
                exec(cmd, (error, stdout, stderr) => {
                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                    if (error) {
                        log(`❌ Erro no PowerShell (ZPL): ${stderr || error.message}`);
                        reject(error);
                    } else {
                        log(`✅ Job ${job.id} (ZPL) enviado com sucesso para ${job.printer_target}`);
                        resolve(jobId);
                    }
                });
            });
        } else if (type === 'pdf') {
            // Impressão PDF via Driver do Sistema
            await new Promise((resolve, reject) => {
                const jobId = `PDF-${Date.now()}`;
                const tempFile = path.join(os.tmpdir(), `${jobId}.pdf`);

                // Converte base64 para buffer binário
                const pdfBuffer = Buffer.from(job.payload_data, 'base64');
                fs.writeFileSync(tempFile, pdfBuffer);

                const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${path.join(__dirname, 'print_pdf.ps1')}" -PrinterName "${job.printer_target}" -FilePath "${tempFile}"`;
                exec(cmd, (error, stdout, stderr) => {
                    if (stdout) log(`[PS Out]: ${stdout}`);
                    if (stderr) log(`[PS Err]: ${stderr}`);

                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                    if (error) {
                        log(`❌ Erro no PowerShell (PDF): ${stderr || error.message}`);
                        reject(new Error(`Erro no PowerShell: ${stderr || error.message}`));
                    } else {
                        log(`✅ Job ${job.id} (PDF) enviado com sucesso para ${job.printer_target}`);
                        resolve(jobId);
                    }
                });
            });
        } else {
            throw new Error(`Tipo de payload não suportado: ${type}`);
        }

        // Sucesso
        await supabase
            .from('print_jobs')
            .update({ status: 'completed' })
            .eq('id', job.id);

    } catch (err) {
        log(`❌ Falha no Job ${job.id}: ${err.message}`);

        const isRetryable = (job.attempts || 0) < (job.max_attempts || 3);
        const newErrorHistory = Array.isArray(job.error_history) ? [...job.error_history] : [];
        newErrorHistory.push({ error: err.message, time: new Date().toISOString() });

        await supabase
            .from('print_jobs')
            .update({
                status: isRetryable ? 'pending' : 'failed',
                error_history: newErrorHistory
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
