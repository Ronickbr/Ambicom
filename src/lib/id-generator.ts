import { supabase } from './supabase';
import { logger } from './logger';

export async function generateNextInternalSerial(): Promise<string> {
    try {
        const { data, error } = await supabase.rpc('get_next_internal_serial');
        if (error) throw error;
        return data as string;
    } catch (error) {
        logger.error("Erro ao gerar serial interno:", error);
        const currentYear = new Date().getFullYear();
        // Fallback to error format if DB fails to avoid blocking
        return `99999-${currentYear}`;
    }
}
