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

// ─── Constantes do Label ───────────────────────────────────────────────────────
const LW = 80;    // largura mm
const LH = 120;   // altura mm
const X0 = 1.5;   // borda esquerda
const X1 = 78.5;  // borda direita
const CW = X1 - X0; // 77mm

// ─── Helpers de desenho ────────────────────────────────────────────────────────
function sv(v: any): string { return String(v ?? '').trim() || '-'; }

function drawLbl(doc: jsPDF, text: string, x: number, y: number) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.setTextColor(80, 80, 80);
    doc.text(text.toUpperCase(), x, y);
}

function drawVal(doc: jsPDF, text: string, x: number, y: number, size = 11, align: 'left' | 'center' = 'left') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
    doc.text(text, x, y, { align });
}

function hLine(doc: jsPDF, y: number, x0 = X0, x1 = X1) {
    doc.setDrawColor(0); doc.setLineWidth(0.25);
    doc.line(x0, y, x1, y);
}

function vLine(doc: jsPDF, x: number, y0: number, y1: number) {
    doc.setDrawColor(0); doc.setLineWidth(0.25);
    doc.line(x, y0, x, y1);
}

// ─── Desenhador principal da etiqueta ─────────────────────────────────────────
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

    // ── CABEÇALHO ─────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(0);
    doc.text('Ambicom', X0, 8);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(5); doc.setTextColor(0);
    doc.text('R. Wenceslau Marek, 10 - Águas Belas,', X0, 12.5);
    doc.text('São José dos Pinhais - PR, 83010-520', X0, 15.5);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(0);
    doc.text('SAC : 041 - 3382-5410', X0, 20.5);

    // Stamp box
    doc.setDrawColor(0); doc.setLineWidth(0.35);
    doc.rect(55.5, 1.2, 23, 15.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(0);
    ['PRODUTO', 'REMANUFATURADO', 'GARANTIA', 'AMBICOM'].forEach((t, i) =>
        doc.text(t, 67, 4.5 + i * 3.4, { align: 'center' })
    );

    // ── GRADE DE DADOS ────────────────────────────────────────────────────────
    const GY = 22.5;
    const COL3 = CW / 3; // 25.67mm each

    // Row boundaries (Y absolutas)
    const r = [
        GY,           // 0 – topo
        GY + 13,      // 1 – fim Modelo/Voltagem
        GY + 33,      // 2 – fim QR/Serial
        GY + 45,      // 3 – fim PNC/60Hz
        GY + 56,      // 4 – fim Gás/Compressor
        GY + 67,      // 5 – fim Volumes
        GY + 79,      // 6 – fim Pressão
        GY + 91,      // 7 – fim Corrente/Tamanho (fundo)
    ];

    // Caixa externa
    doc.setDrawColor(0); doc.setLineWidth(0.35);
    doc.rect(X0, r[0], CW, r[7] - r[0]);

    // ── Linha 1: MODELO | VOLTAGEM ──────────────────────────────────────────
    const vMod = X0 + 47;
    hLine(doc, r[1]); vLine(doc, vMod, r[0], r[1]);
    drawLbl(doc, 'Modelo', X0 + 1, r[0] + 3.5);
    drawVal(doc, model, X0 + 1, r[0] + 11.5, 15);
    drawLbl(doc, 'Voltagem', vMod + 1, r[0] + 3.5);
    drawVal(doc, voltage + ' V', vMod + 1, r[0] + 11.5, 15);

    // ── Linha 2: QR CODE | SERIAL ───────────────────────────────────────────
    const vQR = X0 + 22;
    hLine(doc, r[2]); vLine(doc, vQR, r[1], r[2]);

    if (serial !== '-') {
        try {
            const qrImg = await QRCode.toDataURL(serial, { margin: 0, width: 220 });
            doc.addImage(qrImg, 'PNG', X0 + 1, r[1] + 1, 19, 19);
        } catch { /* QR opcional */ }
    }

    drawLbl(doc, 'Número de Série Ambicom:', vQR + 1, r[1] + 4);
    drawVal(doc, serial, vQR + 1, r[1] + 13, 14);
    if (commCode !== '-') {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(0);
        doc.text(commCode, vQR + 1, r[1] + 19.5);
    }

    // ── Linha 3: PNC/ML | 60 Hz ─────────────────────────────────────────────
    const vPNC = X0 + 55;
    hLine(doc, r[3]); vLine(doc, vPNC, r[2], r[3]);
    drawLbl(doc, 'PNC/ML', X0 + 1, r[2] + 3.5);
    drawVal(doc, pncMl, X0 + 1, r[2] + 10.5, 13);
    drawLbl(doc, 'Frequência', vPNC + 1.5, r[2] + 3.5);
    drawVal(doc, '60 Hz', vPNC + 1.5, r[2] + 10.5, 12);

    // ── Linha 4: GÁS FRIGOR. | CARGA GÁS | COMPRESSOR ──────────────────────
    const c2 = X0 + COL3, c3 = X0 + COL3 * 2;
    hLine(doc, r[4]); vLine(doc, c2, r[3], r[4]); vLine(doc, c3, r[3], r[4]);
    drawLbl(doc, 'Gás Frigor.', X0 + 1, r[3] + 3.5);
    drawVal(doc, gas, X0 + 1, r[3] + 9.5, 11);
    drawLbl(doc, 'Carga Gás', c2 + 1, r[3] + 3.5);
    drawVal(doc, gasChg !== '-' ? gasChg + ' g' : '-', c2 + 1, r[3] + 9.5, 11);
    drawLbl(doc, 'Compressor', c3 + 1, r[3] + 3.5);
    drawVal(doc, comp, c3 + 1, r[3] + 9.5, 9);

    // ── Linha 5: VOL. FREEZER | VOL. REFRIG. | VOLUME TOTAL ─────────────────
    hLine(doc, r[5]); vLine(doc, c2, r[4], r[5]); vLine(doc, c3, r[4], r[5]);
    drawLbl(doc, 'Vol. Freezer', X0 + 1, r[4] + 3.5);
    drawVal(doc, volFrz !== '-' ? volFrz + ' L' : '-', X0 + 1, r[4] + 9.5, 11);
    drawLbl(doc, 'Vol. Refrig.', c2 + 1, r[4] + 3.5);
    drawVal(doc, volRef !== '-' ? volRef + ' L' : '-', c2 + 1, r[4] + 9.5, 11);
    drawLbl(doc, 'Volume Total', c3 + 1, r[4] + 3.5);
    drawVal(doc, volTot !== '-' ? volTot + ' L' : '-', c3 + 1, r[4] + 9.5, 11);

    // ── Linha 6: P. ALTA/BAIXA | CAPAC. CONG. ───────────────────────────────
    const vP = X0 + 45;
    hLine(doc, r[6]); vLine(doc, vP, r[5], r[6]);
    drawLbl(doc, 'P. de Alta / P. de Baixa', X0 + 1, r[5] + 3.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(0);
    doc.text(pressure !== '-' ? pressure : '-', X0 + 1, r[5] + 9.5, { maxWidth: vP - X0 - 2 });
    drawLbl(doc, 'Capac. Cong.', vP + 1, r[5] + 3.5);
    drawVal(doc, freezCap, vP + 1, r[5] + 9.5, 10);

    // ── Linha 7: CORRENTE | POT. DEGELO | TAMANHO ────────────────────────────
    vLine(doc, c2, r[6], r[7]); vLine(doc, c3, r[6], r[7]);
    drawLbl(doc, 'Corrente', X0 + 1, r[6] + 3.5);
    drawVal(doc, current !== '-' ? current + ' A' : '-', X0 + 1, r[6] + 9.5, 11);
    drawLbl(doc, 'Pot. Degelo', c2 + 1, r[6] + 3.5);
    drawVal(doc, defrost !== '-' ? defrost + ' W' : '-', c2 + 1, r[6] + 9.5, 11);
    drawLbl(doc, 'Tamanho', c3 + 1, r[6] + 3.5);
    const sizeCenter = c3 + (X1 - c3) / 2;
    drawVal(doc, dispSize, sizeCenter, r[6] + 11, 18, 'center');
}

// ─── Exportações públicas ─────────────────────────────────────────────────────

/** Gera PDF das etiquetas usando coordenadas jsPDF diretas (sem html2canvas) */
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [LW, LH],
        putOnlyUsedFonts: true,
        compress: true,
    });
    for (let i = 0; i < products.length; i++) {
        if (i > 0) doc.addPage([LW, LH], 'portrait');
        await drawLabel(doc, products[i]);
    }
    return doc;
};

/** Converte jsPDF para Base64 (para o bridge remoto) */
export const pdfToBase64 = (doc: jsPDF): string =>
    doc.output('datauristring').split(',')[1];

/** Baixa as etiquetas como arquivo PDF */
export const printLabels = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    doc.save(`etiquetas_ambicom_${Date.now()}.pdf`);
};

/** Impressão nativa via diálogo do browser (sem bridge) */
export const printLabelsNative = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) return;
    w.addEventListener('load', () => { w.print(); }, { once: true });
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
