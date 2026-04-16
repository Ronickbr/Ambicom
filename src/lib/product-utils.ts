import { supabase } from './supabase';
import { logger } from './logger';
import type { Product } from './types';

export function parseVolumeToNumber(volumeTotalStr: string | number | null | undefined): number | null {
    if (!volumeTotalStr) return null;
    const strValue = String(volumeTotalStr);
    const match = strValue.replace(',', '.').match(/(\d+(\.\d+)?)/);
    if (!match) return null;
    const volume = parseFloat(match[1]);
    return Number.isFinite(volume) ? volume : null;
}

async function fetchRefrigeratorSizeConfig(): Promise<{ smallMax: number; mediumMax: number; largeAMin: number }> {
    let smallMax = 300;
    let mediumMax = 550;
    let largeAMin = 600;

    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'refrigerator_sizes')
            .maybeSingle();

        if (error) throw error;

        if (data && data.value) {
            const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            if (config.small_max) smallMax = Number(config.small_max);
            if (config.medium_max) mediumMax = Number(config.medium_max);
            if (config.large_a_min) largeAMin = Number(config.large_a_min);
        }
    } catch (e) {
        logger.error("Error fetching size config", e);
    }

    if (!Number.isFinite(smallMax) || smallMax < 1) smallMax = 300;
    if (!Number.isFinite(mediumMax) || mediumMax <= smallMax) mediumMax = 550;
    if (!Number.isFinite(largeAMin) || largeAMin <= mediumMax) largeAMin = Math.max(600, mediumMax + 1);

    return { smallMax, mediumMax, largeAMin };
}

export async function calculateProductSize(volumeTotalStr: string | number | null | undefined): Promise<string | null> {
    const volume = parseVolumeToNumber(volumeTotalStr);
    if (volume === null) return null;

    const { smallMax, mediumMax } = await fetchRefrigeratorSizeConfig();

    if (volume <= smallMax) return 'Pequeno';
    if (volume <= mediumMax) return 'Médio';
    return 'Grande';
}

export async function isEligibleForLargeA(volumeTotalStr: string | number | null | undefined): Promise<boolean> {
    const volume = parseVolumeToNumber(volumeTotalStr);
    if (volume === null) return false;
    const { largeAMin } = await fetchRefrigeratorSizeConfig();
    return volume >= largeAMin;
}

export function formatProductSizeForLabel(
    size: string | null | undefined,
    hasWaterDispenser: boolean | null | undefined
): string | null {
    if (!size) return null;
    if (size === 'Grande' && hasWaterDispenser) return 'Grande/A';
    return size;
}

export function isLargeProductSize(size: string | null | undefined): boolean {
    return size === 'Grande';
}

export function buildOcrFormFromScan(
    scanData: Partial<Product> & Record<string, unknown>,
    productSize: string | null
): Partial<Product> & Record<string, unknown> {
    return {
        ...scanData,
        size: productSize,
        has_water_dispenser: false
    };
}

export function normalizeBrandKey(brand: string | null | undefined): string | null {
    if (!brand) return null;

    const raw = brand.trim();
    if (!raw) return null;

    const deaccented = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const lowered = deaccented.toLowerCase();
    const cleaned = lowered.replace(/[^a-z0-9]+/g, ' ').trim();

    if (!cleaned) return null;

    const stopwords = new Set([
        'da', 'das', 'de', 'do', 'dos', 'e',
        'br', 'brasil', 'brazil',
        'ltda', 'me', 'mei', 'epp', 'eireli',
        'sa', 's', 'a',
        'industria', 'industrial', 'ind',
        'comercio', 'comercial', 'com',
        'grupo', 'group', 'holding'
    ]);

    const tokens = cleaned.split(/\s+/g).filter(Boolean).filter(t => !stopwords.has(t));
    if (tokens.length === 0) return null;

    return tokens.join(' ');
}

export function formatBrandCanonical(brand: string | null | undefined): string | null {
    if (!brand) return null;
    const raw = brand.trim().replace(/\s+/g, ' ');
    if (!raw) return null;

    const tokens = raw.split(' ').filter(Boolean);
    if (tokens.length === 0) return null;

    const canonical = tokens
        .map(t => {
            if (/[0-9]/.test(t)) return t.toUpperCase();
            if (t.length <= 2) return t.toUpperCase();
            if (t === t.toUpperCase() && t.length <= 4) return t.toUpperCase();
            return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
        })
        .join(' ');

    return canonical;
}

export async function resolveCanonicalBrand(brand: string | null | undefined): Promise<string | null> {
    const key = normalizeBrandKey(brand);
    if (!key) return formatBrandCanonical(brand);

    try {
        const { data, error } = await supabase
            .from('brand_aliases')
            .select('canonical')
            .eq('alias_key', key)
            .maybeSingle();

        if (error) throw error;
        if (data?.canonical) return data.canonical;
    } catch (e) {
        logger.error("Error resolving canonical brand", e);
    }

    return formatBrandCanonical(brand);
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
