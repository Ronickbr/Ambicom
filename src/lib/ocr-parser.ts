export interface OCRMetadata {
    fabricante: string;
    modelo: string | null;
    codigo_comercial: string | null;
    cor: string | null;
    pnc_ml: string | null;
    numero_serie: string | null;
    data_fabricacao: string | null;
    gas_refrigerante: string | null;
    volume_total: string | null;
    tensao: string | null;
}

export function parseElectroluxLabel(fullText: string): OCRMetadata {
    const result: OCRMetadata = {
        fabricante: "Electrolux",
        modelo: null,
        codigo_comercial: null,
        cor: null,
        pnc_ml: null,
        numero_serie: null,
        data_fabricacao: null,
        gas_refrigerante: null,
        volume_total: null,
        tensao: null,
    };

    const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const text = fullText.toUpperCase();

    // -- Regex Patterns for specific Electrolux data types --
    const modelRegex = /\b[A-Z]{2,4}\s?\d{2,4}\b/; // e.g. RE31, DC35A, DF42
    const pncRegex = /\b\d{9}\b/; // Exactly 9 digits (PNC)
    const pncMlRegex = /\b\d{9}\s*\/\s*\d{2}\b/; // PNC/ML e.g. 900277741 / 02
    const serialRegex = /\b\d{8,11}\b/; // Serial is usually 8-10 digits
    const voltageRegex = /\b(127|220|110-127|220-240)\s*V~?\b/;
    const dateRegex = /\b\d{2}[/-]\d{2}[/-]\d{2,4}\b/; // DD/MM/YY or DD/MM/YYYY

    // 1. Try Extracting by Specific Patterns first (more reliable)

    // Model (Pattern search)
    const modelMatch = text.match(modelRegex);
    if (modelMatch) result.modelo = modelMatch[0];

    // PNC / ML
    const pncMatch = text.match(pncMlRegex) || text.match(pncRegex);
    if (pncMatch) result.pnc_ml = pncMatch[0];

    // No. Serie
    const serialMatch = text.match(serialRegex);
    // Be careful not to use the PNC as serial
    if (serialMatch && (!result.pnc_ml || !result.pnc_ml.includes(serialMatch[0]))) {
        result.numero_serie = serialMatch[0];
    }

    // Tensao
    const voltMatch = text.match(voltageRegex);
    if (voltMatch) result.tensao = voltMatch[1] + "V";

    // Data
    const dateMatch = text.match(dateRegex);
    if (dateMatch) result.data_fabricacao = dateMatch[0];

    // 2. Keyword Search with cleanup
    const stopWords = [
        "MODELO", "CODIGO", "COMERCIAL", "PNC", "SERIE", "DATA", "FABRICACAO",
        "GAS", "VOL", "TOTAL", "TENSAO", "COR", "FREQ", "PESO", "CARGA",
        "PRODUTO", "CHAVE", "CONTROLE", "FABRICADO", "INDUSTRIA", "BRASILEIRA"
    ];

    const cleanValue = (val: string | null) => {
        if (!val) return null;
        let cleaned = val.replace(/^[:\-\s]+/, '').trim();

        // Remove lines that are just field labels
        const upper = cleaned.toUpperCase();
        for (const word of stopWords) {
            if (upper.startsWith(word) || upper === word) {
                return null;
            }
        }

        // If the value contains common address/manufacturing parts, skip it
        if (upper.includes("SAO JOSE") || upper.includes("MANAUS") || upper.includes("CURITIBA") || upper.includes("RUA")) {
            return null;
        }

        // Limit length and return
        return cleaned.substring(0, 30) || null;
    };

    lines.forEach((line, i) => {
        const uLine = line.toUpperCase();

        // Specific Modelo pattern: Alphanumeric, usually starts with 2-3 letters
        if (uLine.includes("MODELO") && !result.modelo) {
            let val = line.split(/modelo/i)[1] || lines[i + 1] || "";
            let cleaned = cleanValue(val);
            if (cleaned && cleaned.length > 2) {
                result.modelo = cleaned;
            }
        }

        if ((uLine.includes("COD") && uLine.includes("COMER")) && !result.codigo_comercial) {
            let val = line.split(/comercial/i)[1] || lines[i + 1] || "";
            result.codigo_comercial = cleanValue(val);
        }

        if (uLine.includes("COR") && !result.cor) {
            let val = line.split(/cor/i)[1] || "";
            result.cor = cleanValue(val);
        }

        if (uLine.includes("GAS") && !result.gas_refrigerante) {
            let val = line.split(/gas/i)[1] || lines[i + 1] || "";
            result.gas_refrigerante = cleanValue(val);
        }

        if (uLine.includes("VOL") && uLine.includes("TOTAL") && !result.volume_total) {
            let val = line.split(/total/i)[1] || lines[i + 1] || "";
            result.volume_total = cleanValue(val);
        }
    });

    return result;
}
