import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';
import { calculateProductSize } from './product-utils';

// ─── Relatório A4 ─────────────────────────────────────────────────────────────
export const exportToPDF = (title: string, headers: string[], data: (string | number | boolean | null)[][], fileName: string) => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text(title, 14, 22);
    doc.setFontSize(11); doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
    autoTable(doc, { head: [headers], body: data, startY: 35, theme: 'grid', headStyles: { fillColor: [14, 165, 233] }, alternateRowStyles: { fillColor: [245, 245, 245] } });
    doc.save(`${fileName}_${Date.now()}.pdf`);
};

export const exportToExcel = (data: Record<string, unknown>[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.writeFile(wb, `${fileName}_${Date.now()}.xlsx`);
};

// ─── Constantes – 80×55mm Landscape ──────────────────────────────────────────
const LW = 80;   // largura mm
const LH = 55;   // altura  mm
const X0 = 3;    // margem esquerda (3mm folga física)
const X1 = 77;   // margem direita  (3mm folga física)
const CW = X1 - X0; // 74mm (largura útil)

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sv(v: any): string { return String(v ?? '').trim() || '-'; }

function drawLbl(doc: jsPDF, text: string, x: number, y: number, size = 3.5) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(80, 80, 80);
    doc.text(text.toUpperCase(), x, y);
}

function drawVal(doc: jsPDF, text: string, x: number, y: number, size = 8, align: 'left' | 'center' = 'left') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
    doc.text(text, x, y, { align });
}

function hLine(doc: jsPDF, y: number, x0 = X0, x1 = X1) {
    doc.setDrawColor(0); doc.setLineWidth(0.2); doc.line(x0, y, x1, y);
}
function vLine(doc: jsPDF, x: number, y0: number, y1: number) {
    doc.setDrawColor(0); doc.setLineWidth(0.2); doc.line(x, y0, x, y1);
}

// ─── Desenhador da etiqueta (coordenadas mm diretas) ─────────────────────────
async function drawLabel(doc: jsPDF, p: any): Promise<void> {
    const model = sv(p.model ?? p.modelo);
    const voltage = sv(p.voltage ?? p.tensao);
    const serial = sv(p.internal_serial);
    const commCode = sv(p.commercial_code);
    const pncMl = sv(p.pnc_ml);
    const gas = sv(p.refrigerant_gas);
    const gasChg = sv(p.gas_charge);
    const comp = sv(p.compressor);
    const volFrz = sv(p.volume_freezer);
    const volRef = sv(p.volume_refrigerator);
    const volTot = sv(p.volume_total);
    const pressure = sv(p.pressure_high_low);
    const freezCap = sv(p.freezing_capacity);
    const current = sv(p.electric_current);
    const defrost = sv(p.defrost_power);
    const sizeFull = p.size ?? await calculateProductSize(p.volume_total);
    const dispSize = sizeFull === 'Pequeno' ? 'P' : sizeFull === 'Médio' ? 'M' : sizeFull === 'Grande' ? 'G' : (sizeFull || '-');

    // ── CABEÇALHO (y: 0 → 13.5mm) ────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(0);
    doc.text('Ambicom', X0, 6.5);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(4); doc.setTextColor(0);
    doc.text('R. Wenceslau Marek, 10 - Águas Belas, SJP - PR, 83010-520', X0, 10);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(0);
    doc.text('SAC : 041 - 3382-5410', X0, 13);

    // Stamp box (direita do cabeçalho) — ajustado para X1=77
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.rect(51, 1.5, 25, 11);   // x=51..76, y=1.5..12.5
    doc.setFont('helvetica', 'bold'); doc.setFontSize(4); doc.setTextColor(0);
    ['PRODUTO', 'REMANUFATURADO', 'GARANTIA', 'AMBICOM'].forEach((t, i) =>
        doc.text(t, 63.5, 4 + i * 2.5, { align: 'center' })
    );

    // ── GRADE DE DADOS ─────────────────────────────────────────────────────────
    // Alturas: 6 | 8.5 | 5 | 4.5 | 4.5 | 4.5 | 5  = 38mm + GY=13 + 1mm inf = 52mm ✓
    const GY = 13;
    const r = [
        GY,           // r[0] = 13
        GY + 6,       // r[1] = 19   (Modelo/Voltagem 6mm)
        GY + 14.5,    // r[2] = 27.5 (QR/Serial 8.5mm)
        GY + 19.5,    // r[3] = 32.5 (PNC/60Hz 5mm)
        GY + 24,      // r[4] = 37   (Gás/Compressor 4.5mm)
        GY + 28.5,    // r[5] = 41.5 (Volumes 4.5mm)
        GY + 33,      // r[6] = 46   (Pressão 4.5mm)
        GY + 39,      // r[7] = 52   (Corrente/Tamanho 6mm) +3mm margem = 55mm✓
    ];

    // Colunas terças (CW=74mm / 3 ≈ 24.7mm)
    const COL3 = CW / 3;
    const c2 = X0 + COL3;       // ≈ 27.7mm
    const c3 = X0 + COL3 * 2;   // ≈ 52.3mm

    // Caixa externa
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.rect(X0, r[0], CW, r[7] - r[0]);

    // ── Linha 1: MODELO | VOLTAGEM ────────────────────────────────────────────
    const vMod = X0 + 43;  // split Modelo/Voltagem a 43mm do X0 (43+3=46mm)
    hLine(doc, r[1]); vLine(doc, vMod, r[0], r[1]);
    drawLbl(doc, 'Modelo', X0 + 1, r[0] + 2);
    drawVal(doc, model, X0 + 1, r[0] + 5, 9.5);
    drawLbl(doc, 'Voltagem', vMod + 1, r[0] + 2);
    drawVal(doc, voltage + ' V', vMod + 1, r[0] + 5, 9.5);

    // ── Linha 2: QR CODE | SERIAL ─────────────────────────────────────────────
    const vQR = X0 + 10;
    hLine(doc, r[2]); vLine(doc, vQR, r[1], r[2]);
    if (serial !== '-') {
        try {
            const qrImg = await QRCode.toDataURL(serial, { margin: 0, width: 200 });
            doc.addImage(qrImg, 'PNG', X0 + 0.5, r[1] + 0.5, 8.5, 8.5);
        } catch { /* opcional */ }
    }
    drawLbl(doc, 'Número de Série Ambicom:', vQR + 1, r[1] + 2);
    drawVal(doc, serial, vQR + 1, r[1] + 6.5, 9);
    if (commCode !== '-') {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(0);
        doc.text(commCode, vQR + 1, r[2] - 0.5);
    }

    // ── Linha 3: PNC/ML | 60 Hz ───────────────────────────────────────────────
    const vPNC = X0 + 50;  // split PNC/60Hz
    hLine(doc, r[3]); vLine(doc, vPNC, r[2], r[3]);
    drawLbl(doc, 'PNC/ML', X0 + 1, r[2] + 2);
    drawVal(doc, pncMl, X0 + 1, r[2] + 4.5, 8.5);
    drawLbl(doc, 'Frequência', vPNC + 1, r[2] + 2);
    drawVal(doc, '60 Hz', vPNC + 1, r[2] + 4.5, 7.5);

    // ── Linha 4: GÁS FRIGOR. | CARGA GÁS | COMPRESSOR ────────────────────────
    hLine(doc, r[4]); vLine(doc, c2, r[3], r[4]); vLine(doc, c3, r[3], r[4]);
    drawLbl(doc, 'Gás Frigor.', X0 + 1, r[3] + 2);
    drawVal(doc, gas, X0 + 1, r[3] + 4.5, 7.5);
    drawLbl(doc, 'Carga Gás', c2 + 1, r[3] + 2);
    drawVal(doc, gasChg !== '-' ? gasChg + ' g' : '-', c2 + 1, r[3] + 4.5, 7.5);
    drawLbl(doc, 'Compressor', c3 + 1, r[3] + 2);
    drawVal(doc, comp, c3 + 1, r[3] + 4.5, 6.5);

    // ── Linha 5: VOL. FREEZER | VOL. REFRIG. | VOLUME TOTAL ──────────────────
    hLine(doc, r[5]); vLine(doc, c2, r[4], r[5]); vLine(doc, c3, r[4], r[5]);
    drawLbl(doc, 'Vol. Freezer', X0 + 1, r[4] + 2);
    drawVal(doc, volFrz !== '-' ? volFrz + ' L' : '-', X0 + 1, r[4] + 4.5, 7.5);
    drawLbl(doc, 'Vol. Refrig.', c2 + 1, r[4] + 2);
    drawVal(doc, volRef !== '-' ? volRef + ' L' : '-', c2 + 1, r[4] + 4.5, 7.5);
    drawLbl(doc, 'Volume Total', c3 + 1, r[4] + 2);
    drawVal(doc, volTot !== '-' ? volTot + ' L' : '-', c3 + 1, r[4] + 4.5, 7.5);

    // ── Linha 6: P. ALTA/BAIXA | CAPAC. CONG. ────────────────────────────────
    const vP = X0 + 41;  // split Pressão/Capac
    hLine(doc, r[6]); vLine(doc, vP, r[5], r[6]);
    drawLbl(doc, 'P. de Alta / P. de Baixa', X0 + 1, r[5] + 1.8);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5); doc.setTextColor(0);
    doc.text(pressure !== '-' ? pressure : '-', X0 + 1, r[5] + 4, { maxWidth: vP - X0 - 2 });
    drawLbl(doc, 'Capac. Cong.', vP + 1, r[5] + 1.8);
    drawVal(doc, freezCap, vP + 1, r[5] + 4, 7);

    // ── Linha 7: CORRENTE | POT. DEGELO | TAMANHO ────────────────────────────
    vLine(doc, c2, r[6], r[7]); vLine(doc, c3, r[6], r[7]);
    drawLbl(doc, 'Corrente', X0 + 1, r[6] + 2);
    drawVal(doc, current !== '-' ? current + ' A' : '-', X0 + 1, r[6] + 4.5, 7.5);
    drawLbl(doc, 'Pot. Degelo', c2 + 1, r[6] + 2);
    drawVal(doc, defrost !== '-' ? defrost + ' W' : '-', c2 + 1, r[6] + 4.5, 7.5);
    drawLbl(doc, 'Tamanho', c3 + 1, r[6] + 2);
    const sizeCenter = c3 + (X1 - c3) / 2;
    drawVal(doc, dispSize, sizeCenter, r[6] + 5, 11, 'center');
}

// ─── API pública ──────────────────────────────────────────────────────────────

/** Gera PDF das etiquetas (80×55mm landscape, ou rotacionado 90° portrait) */
export const generateLabelsPDF = async (products: any[], rotate90: boolean = false): Promise<jsPDF> => {
    const doc = new jsPDF({
        orientation: rotate90 ? 'portrait' : 'landscape',
        unit: 'mm',
        format: rotate90 ? [LH, LW] : [LW, LH],
        putOnlyUsedFonts: true,
        compress: true,
    });

    const k = doc.internal.scaleFactor;

    for (let i = 0; i < products.length; i++) {
        if (i > 0) doc.addPage(rotate90 ? [LH, LW] : [LW, LH], rotate90 ? 'portrait' : 'landscape');

        if (rotate90) {
            // Aplica matriz de transformação para rotacionar 90 graus no sentido anti-horário
            // Mapeando a página landscape (80x55) para a página portrait (55x80)
            // @ts-ignore
            doc.setCurrentTransformationMatrix(new doc.Matrix(0, 1, -1, 0, LW * k, 0));
        }

        await drawLabel(doc, products[i]);
    }
    return doc;
};

/** Converte para Base64 (bridge remoto) */
export const pdfToBase64 = (doc: jsPDF): string =>
    doc.output('datauristring').split(',')[1];

/** Download do PDF */
export const printLabels = async (products: any[], rotate90: boolean = true) => {
    const doc = await generateLabelsPDF(products, rotate90);
    doc.save(`etiquetas_ambicom_${Date.now()}.pdf`);
};

/** Impressão direta via diálogo do browser */
export const printLabelsNative = async (products: any[], rotate90: boolean = true) => {
    const doc = await generateLabelsPDF(products, rotate90);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) return;
    w.addEventListener('load', () => w.print(), { once: true });
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
