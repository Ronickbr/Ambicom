import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';
import { calculateProductSize } from './product-utils';

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

// ─── Dimensões: 80×55mm landscape ─────────────────────────────────────────────
// jsPDF: para garantir página 80mm larga × 55mm alta em landscape,
// passamos [55, 80] → jsPDF vê 55<80, faz swap → pageWidth=80, pageHeight=55
const FMT: [number, number] = [55, 80]; // par para jsPDF (será trocado para 80×55)
const LW = 80;  // largura real mm
const LH = 55;  // altura  real mm
const X0 = 1;
const X1 = 79;
const CW = X1 - X0; // 78mm

function sv(v: any): string { return String(v ?? '').trim() || '-'; }

function lbl(doc: jsPDF, t: string, x: number, y: number, sz = 3.5) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(sz); doc.setTextColor(90, 90, 90);
    doc.text(t.toUpperCase(), x, y);
}
function val(doc: jsPDF, t: string, x: number, y: number, sz = 8, align: 'left' | 'center' = 'left') {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(sz); doc.setTextColor(0);
    doc.text(t, x, y, { align });
}
function hl(doc: jsPDF, y: number) { doc.setDrawColor(0); doc.setLineWidth(0.2); doc.line(X0, y, X1, y); }
function vl(doc: jsPDF, x: number, y0: number, y1: number) { doc.setDrawColor(0); doc.setLineWidth(0.2); doc.line(x, y0, x, y1); }

async function drawLabel(doc: jsPDF, p: any) {
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

    // ── CABEÇALHO: y 0→11mm ───────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0);
    doc.text('Ambicom', X0, 6);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(3.5); doc.setTextColor(0);
    doc.text('R. Wenceslau Marek, 10 - Águas Belas, SJP - PR', X0, 8.5);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(0);
    doc.text('SAC : 041 - 3382-5410', X0, 11);

    // Stamp box topo direito
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.rect(55, 0.8, 23.5, 10.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(3.8); doc.setTextColor(0);
    ['PRODUTO', 'REMANUFATURADO', 'GARANTIA', 'AMBICOM'].forEach((t, i) =>
        doc.text(t, 66.7, 3 + i * 2.5, { align: 'center' })
    );

    // ── GRADE: y 11→54.5mm = 43.5mm p/ 7 linhas ──────────────────────────────
    // Linhas: 6 + 9 + 6 + 5.5 + 5.5 + 5.5 + 5.5 = 43mm  →  11+43=54 ✓
    const G = 11;
    const r = [G, G + 6, G + 15, G + 21, G + 26.5, G + 32, G + 37.5, G + 43];
    // r: 11, 17, 26, 32, 37.5, 43, 48.5, 54

    const C3 = CW / 3; // ~26mm each col
    const c2 = X0 + C3;
    const c3 = X0 + C3 * 2;

    // Caixa externa da grade
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.rect(X0, r[0], CW, r[7] - r[0]);

    // ── Linha 1: MODELO | VOLTAGEM ────────────────────────────────────────────
    const xMod = X0 + 47;
    hl(doc, r[1]); vl(doc, xMod, r[0], r[1]);
    lbl(doc, 'Modelo', X0 + 1, r[0] + 2); val(doc, model, X0 + 1, r[0] + 5.5, 9.5);
    lbl(doc, 'Voltagem', xMod + 1, r[0] + 2); val(doc, voltage + ' V', xMod + 1, r[0] + 5.5, 9.5);

    // ── Linha 2: QR | SERIAL ─────────────────────────────────────────────────
    const xQR = X0 + 11;
    hl(doc, r[2]); vl(doc, xQR, r[1], r[2]);
    if (serial !== '-') {
        try {
            const qr = await QRCode.toDataURL(serial, { margin: 0, width: 200 });
            doc.addImage(qr, 'PNG', X0 + 0.5, r[1] + 0.5, 9, 9);
        } catch { /* opcional */ }
    }
    lbl(doc, 'Número de Série Ambicom:', xQR + 1, r[1] + 2.5);
    val(doc, serial, xQR + 1, r[1] + 7.5, 9);
    if (commCode !== '-') {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(0);
        doc.text(commCode, xQR + 1, r[2] - 1);
    }

    // ── Linha 3: PNC/ML | 60 Hz ──────────────────────────────────────────────
    const xPNC = X0 + 54;
    hl(doc, r[3]); vl(doc, xPNC, r[2], r[3]);
    lbl(doc, 'PNC/ML', X0 + 1, r[2] + 2); val(doc, pncMl, X0 + 1, r[2] + 5.5, 8.5);
    lbl(doc, 'Frequência', xPNC + 1, r[2] + 2); val(doc, '60 Hz', xPNC + 1, r[2] + 5.5, 7.5);

    // ── Linha 4: GÁS | CARGA GÁS | COMPRESSOR ────────────────────────────────
    hl(doc, r[4]); vl(doc, c2, r[3], r[4]); vl(doc, c3, r[3], r[4]);
    lbl(doc, 'Gás Frigor.', X0 + 1, r[3] + 2); val(doc, gas, X0 + 1, r[3] + 5, 7.5);
    lbl(doc, 'Carga Gás', c2 + 1, r[3] + 2); val(doc, gasChg !== '-' ? gasChg + ' g' : '-', c2 + 1, r[3] + 5, 7.5);
    lbl(doc, 'Compressor', c3 + 1, r[3] + 2); val(doc, comp, c3 + 1, r[3] + 5, 6.5);

    // ── Linha 5: VOLUMES ──────────────────────────────────────────────────────
    hl(doc, r[5]); vl(doc, c2, r[4], r[5]); vl(doc, c3, r[4], r[5]);
    lbl(doc, 'Vol. Freezer', X0 + 1, r[4] + 2); val(doc, volFrz !== '-' ? volFrz + ' L' : '-', X0 + 1, r[4] + 5, 7.5);
    lbl(doc, 'Vol. Refrig.', c2 + 1, r[4] + 2); val(doc, volRef !== '-' ? volRef + ' L' : '-', c2 + 1, r[4] + 5, 7.5);
    lbl(doc, 'Volume Total', c3 + 1, r[4] + 2); val(doc, volTot !== '-' ? volTot + ' L' : '-', c3 + 1, r[4] + 5, 7.5);

    // ── Linha 6: P. ALTA/BAIXA | CAPAC. CONG. ────────────────────────────────
    const xP = X0 + 44;
    hl(doc, r[6]); vl(doc, xP, r[5], r[6]);
    lbl(doc, 'P. de Alta / P. de Baixa', X0 + 1, r[5] + 2);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(0);
    doc.text(pressure !== '-' ? pressure : '-', X0 + 1, r[5] + 5, { maxWidth: xP - X0 - 2 });
    lbl(doc, 'Capac. Cong.', xP + 1, r[5] + 2); val(doc, freezCap, xP + 1, r[5] + 5, 7);

    // ── Linha 7: CORRENTE | POT. DEGELO | TAMANHO ────────────────────────────
    vl(doc, c2, r[6], r[7]); vl(doc, c3, r[6], r[7]);
    lbl(doc, 'Corrente', X0 + 1, r[6] + 2); val(doc, current !== '-' ? current + ' A' : '-', X0 + 1, r[6] + 5, 7.5);
    lbl(doc, 'Pot. Degelo', c2 + 1, r[6] + 2); val(doc, defrost !== '-' ? defrost + ' W' : '-', c2 + 1, r[6] + 5, 7.5);
    lbl(doc, 'Tamanho', c3 + 1, r[6] + 2);
    val(doc, dispSize, c3 + (X1 - c3) / 2, r[6] + 5.5, 10, 'center');
}

// ─── API pública ──────────────────────────────────────────────────────────────
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    // FMT=[55,80] + landscape → jsPDF faz swap → página 80×55mm ✓
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: FMT, putOnlyUsedFonts: true, compress: true });
    for (let i = 0; i < products.length; i++) {
        if (i > 0) doc.addPage(FMT, 'landscape');
        await drawLabel(doc, products[i]);
    }
    return doc;
};

export const pdfToBase64 = (doc: jsPDF): string => doc.output('datauristring').split(',')[1];

export const printLabels = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    doc.save(`etiquetas_ambicom_${Date.now()}.pdf`);
};

export const printLabelsNative = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) return;
    w.addEventListener('load', () => w.print(), { once: true });
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
