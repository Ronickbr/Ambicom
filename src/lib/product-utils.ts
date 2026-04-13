import { supabase } from './supabase';
import { logger } from './logger';

export async function calculateProductSize(volumeTotalStr: string | number | null | undefined): Promise<string | null> {
    if (!volumeTotalStr) return null;

    // Ensure value is a string before extracting text/numeric value from strings like "350 L" or numbers like 350
    const strValue = String(volumeTotalStr);
    const match = strValue.replace(',', '.').match(/(\d+(\.\d+)?)/);
    if (!match) return null;

    const volume = parseFloat(match[1]);
    if (isNaN(volume)) return null;

    let smallMax = 300;
    let mediumMax = 550;

    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'refrigerator_sizes')
            .maybeSingle();

        if (data && data.value) {
            const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            if (config.small_max) smallMax = Number(config.small_max);
            if (config.medium_max) mediumMax = Number(config.medium_max);
        }
    } catch (e) {
        logger.error("Error fetching size config", e);
    }

    if (volume <= smallMax) return 'Pequeno';
    if (volume <= mediumMax) return 'Médio';
    return 'Grande';
}

export function formatTotalVolume(
    freezer: string | number | null | undefined,
    refrig: string | number | null | undefined,
    fallback: string | number | null | undefined
): string {
    const parseVol = (v: any) => {
        if (!v) return 0;
        const strVal = String(v).replace(',', '.');
        const match = strVal.match(/(\d+(\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
    };

    const f = parseVol(freezer);
    const r = parseVol(refrig);

    if (f > 0 && r > 0) {
        return `${f + r}L`;
    }

    if (f > 0) {
        return `${f}L`;
    }

    if (r > 0) {
        return `${r}L`;
    }

    if (fallback) {
        const fallStr = String(fallback).trim();
        if (fallStr.includes('/')) {
            return fallStr.split('/').pop()?.trim() || '-';
        }
        return fallStr;
    }

    return '-';
}
