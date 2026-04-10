import { supabase } from './supabase';

export type PrintJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
export type PayloadType = 'zpl' | 'tspl' | 'png' | 'pdf';

export interface PrintJob {
    id?: string;
    status?: PrintJobStatus;
    payload_type: PayloadType;
    payload_data: string;
    printer_target: string;
    attempts?: number;
    max_attempts?: number;
    error_history?: any[];
    picked_at?: string | null;
    created_at?: string;
    updated_at?: string;
    created_by?: string;
}

export interface ActiveBridge {
    id: string;
    bridge_name: string;
    available_printers: string[];
    last_heartbeat: string;
}

export const printService = {
    /**
     * Requisita a lista de pontes ativas que enviaram heartbeat nos últimos 5 minutos.
     */
    async getActiveBridges(): Promise<ActiveBridge[]> {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const { data, error } = await supabase
            .from('active_bridges')
            .select('*')
            .gt('last_heartbeat', fiveMinutesAgo)
            .order('bridge_name', { ascending: true });

        if (error) {
            console.error('Erro ao buscar pontes de impressão:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Envia um novo trabalho de impressão para a fila.
     */
    async submitPrintJob(job: PrintJob): Promise<PrintJob> {
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from('print_jobs')
            .insert([{
                ...job,
                created_by: user?.id,
                status: 'pending',
                attempts: 0
            }])
            .select()
            .single();

        if (error) {
            console.error('Erro ao enviar trabalho de impressão:', error);
            throw error;
        }

        return data;
    },

    /**
     * Monitora o status de um job em tempo real (opcional).
     */
    subscribeToJob(jobId: string, onUpdate: (job: PrintJob) => void) {
        return supabase
            .channel(`print_job_${jobId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'print_jobs',
                    filter: `id=eq.${jobId}`,
                },
                (payload) => onUpdate(payload.new as PrintJob)
            )
            .subscribe();
    }
};
