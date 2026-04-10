import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';
import { calculateProductSize } from './product-utils';

// ─── Relatório A4 (Excel/PDF de Dados) ─────────────────────────────────────────
export const exportToPDF = (title: string, headers: string[], data: (string | number | boolean | null)[][], fileName: string) => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    const date = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em: ${date}`, 14, 30);

    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 35 },
    });

    doc.save(`${fileName}_${new Date().getTime()}.pdf`);
};

export const exportToExcel = (data: Record<string, unknown>[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");

    XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
};

// ─── Geração de Etiquetas (80mm x 55mm Landscape) ─────────────────────────────
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    const labelWidth = 80;
    const labelHeight = 55;

    const doc = new jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: [labelWidth, labelHeight]
    });

    for (let index = 0; index < products.length; index++) {
        const p = products[index];
        if (index > 0) doc.addPage([labelWidth, labelHeight], 'l');

        const val = (v: any) => v || "-";

        doc.setLineWidth(0.2);

        // --- Cabeçalho ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Ambicom", 5, 8);

        doc.setFontSize(5);
        doc.text("R. Wenceslau Marek, 10 - Águas Belas,", 5, 11);
        doc.text("São José dos Pinhais - PR, 83010-520", 5, 13);

        doc.setFontSize(8);
        doc.text("SAC: 041 - 3382-5410", 5, 18);

        // Caixa de Status (Lado Direito)
        doc.rect(53, 3, 24, 16);
        doc.setFontSize(5);
        doc.text("PRODUTO", 65, 6, { align: 'center' });
        doc.text("REMANUFATURADO", 65, 9, { align: 'center' });
        doc.text("GARANTIA", 65, 12, { align: 'center' });
        doc.text("AMBICOM", 65, 15, { align: 'center' });

        // --- Grade Técnica ---
        let currentY = 20;
        const marginX = 5;
        const tableWidth = 70;

        doc.rect(marginX, currentY, tableWidth, 32);

        // Linha 1: Modelo | Voltagem
        doc.line(marginX, currentY + 6, marginX + tableWidth, currentY + 6);
        doc.line(marginX + 45, currentY, marginX + 45, currentY + 6);

        doc.setFontSize(5);
        doc.text("MODELO", marginX + 2, currentY + 2);
        doc.setFontSize(10);
        doc.text(val(p.model), marginX + 2, currentY + 5);

        doc.setFontSize(5);
        doc.text("VOLTAGEM", marginX + 47, currentY + 2);
        doc.setFontSize(10);
        doc.text(`${val(p.voltage)} V`, marginX + 47, currentY + 5);

        currentY += 6;

        // Linha 2: QR Code | Serial
        doc.line(marginX, currentY + 12, marginX + tableWidth, currentY + 12);
        doc.line(marginX + 15, currentY, marginX + 15, currentY + 12);

        const qrData = val(p.internal_serial).trim();
        if (qrData !== "-") {
            try {
                const qrImgData = await QRCode.toDataURL(qrData, { margin: 1 });
                doc.addImage(qrImgData, 'PNG', marginX + 0.5, currentY + 0.5, 14, 11);
            } catch (e) { }
        }

        doc.setFontSize(5);
        doc.text("NÚMERO DE SÉRIE AMBICOM:", marginX + 17, currentY + 3);
        doc.setFontSize(11);
        doc.text(val(p.internal_serial), marginX + 17, currentY + 8);
        doc.setFontSize(6);
        doc.text(val(p.commercial_code), marginX + 17, currentY + 11);

        currentY += 12;

        // Linha 3: PNC/ML | Frequência | Gás
        doc.line(marginX, currentY + 7, marginX + tableWidth, currentY + 7);
        doc.line(marginX + 25, currentY, marginX + 25, currentY + 7);
        doc.line(marginX + 50, currentY, marginX + 50, currentY + 7);

        doc.setFontSize(5);
        doc.text("PNC/ML", marginX + 2, currentY + 2);
        doc.setFontSize(8);
        doc.text(val(p.pnc_ml), marginX + 2, currentY + 6);

        doc.setFontSize(5);
        doc.text("FREQUÊNCIA", marginX + 27, currentY + 2);
        doc.setFontSize(8);
        doc.text(val(p.frequency) || "60 Hz", marginX + 27, currentY + 6);

        doc.setFontSize(5);
        doc.text("GÁS", marginX + 52, currentY + 2);
        doc.setFontSize(8);
        doc.text(val(p.refrigerant_gas), marginX + 52, currentY + 6);

        currentY += 7;

        // Linha 4: Volumes e Tamanho
        doc.line(marginX + 20, currentY, marginX + 20, currentY + 7);
        doc.line(marginX + 40, currentY, marginX + 40, currentY + 7);
        doc.line(marginX + 60, currentY, marginX + 60, currentY + 7);

        doc.setFontSize(5);
        doc.text("VOL. TOTAL", marginX + 2, currentY + 2);
        doc.setFontSize(8);
        doc.text(`${val(p.volume_total)} L`, marginX + 2, currentY + 6);

        doc.text("CORRENTE", marginX + 22, currentY + 2);
        doc.text(val(p.electric_current), marginX + 22, currentY + 6);

        doc.text("POT. DEGELO", marginX + 42, currentY + 2);
        doc.text(val(p.defrost_power), marginX + 42, currentY + 6);

        doc.text("TAM.", marginX + 62, currentY + 2);
        doc.setFontSize(12);

        // Cálculo dinâmico do tamanho se não houver no banco
        const fullSize = p.size || await calculateProductSize(p.volume_total);
        const displaySize = fullSize === 'Pequeno' ? 'P' : fullSize === 'Médio' ? 'M' : fullSize === 'Grande' ? 'G' : "";

        doc.text(displaySize, marginX + 62, currentY + 6);
    }
    return doc;
};

// ─── Helpers e Gatilhos de Impressão ───────────────────────────────────────────
export const pdfToBase64 = (doc: jsPDF): string =>
    doc.output('datauristring').split(',')[1];

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
