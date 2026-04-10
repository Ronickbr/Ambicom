import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';
import { calculateProductSize } from './product-utils';

// ─── Relatório A4 ─────────────────────────────────────────────────────────────
export const exportToPDF = (title: string, headers: string[], data: (string | number | boolean | null)[][], fileName: string) => {
    const doc = new jsPDF();

    // Add Title
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);

    // Add Date
    const date = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em: ${date}`, 14, 30);

    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255] }, // primary sky-500
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 35 },
    });

    doc.save(`${fileName}_${new Date().getTime()}.pdf`);
};

export const exportToExcel = (data: Record<string, unknown>[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");

    // Standard fixed formatting could be added here

    XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
};

// ─── Geração de Etiquetas Corrigida (Uso total dos 80mm) ──────────────────────
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    // Definimos a largura maior que a altura, mas em modo 'p' (Portrait)
    // Isso evita que o driver tente "espremer" o conteúdo em 55mm.
    const labelWidth = 80;
    const labelHeight = 55;

    const doc = new jsPDF({
        orientation: 'p', // Mantemos 'p' para o driver não escalar
        unit: 'mm',
        format: [labelWidth, labelHeight]
    });

    for (let index = 0; index < products.length; index++) {
        const p = products[index];
        if (index > 0) doc.addPage([labelWidth, labelHeight], 'p');

        const val = (v: any) => v || "-";
        doc.setLineWidth(0.3); // Linhas um pouco mais grossas para nitidez térmica

        // --- CABEÇALHO ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("Ambicom", 4, 8);

        doc.setFontSize(5.5);
        doc.text("R. Wenceslau Marek, 10 - Águas Belas,", 4, 11.5);
        doc.text("São José dos Pinhais - PR, 83010-520", 4, 14);

        doc.setFontSize(9);
        doc.text("SAC: 041 - 3382-5410", 4, 19);

        // Caixa de Status (Lado Direito - Puxada mais para o final dos 80mm)
        doc.rect(53, 3, 24, 16);
        doc.setFontSize(5.5);
        doc.text("PRODUTO", 65, 6.5, { align: 'center' });
        doc.text("REMANUFATURADO", 65, 9.5, { align: 'center' });
        doc.text("GARANTIA", 65, 12.5, { align: 'center' });
        doc.text("AMBICOM", 65, 15.5, { align: 'center' });

        // --- GRADE TÉCNICA EXPANDIDA ---
        let currentY = 21;
        const marginX = 3; // Margem menor para ganhar espaço
        const tableWidth = 74; // AGORA USA 74mm DOS 80mm DISPONÍVEIS

        doc.rect(marginX, currentY, tableWidth, 31);

        // Linha 1: MODELO | VOLTAGEM
        doc.line(marginX, currentY + 6, marginX + tableWidth, currentY + 6);
        doc.line(marginX + 48, currentY, marginX + 48, currentY + 6); // Divisória em 48mm

        doc.setFontSize(5);
        doc.text("MODELO", marginX + 2, currentY + 2);
        doc.setFontSize(10);
        doc.text(val(p.model), marginX + 2, currentY + 5.5);

        doc.setFontSize(5);
        doc.text("VOLTAGEM", marginX + 50, currentY + 2);
        doc.setFontSize(10);
        doc.text(`${val(p.voltage)} V`, marginX + 50, currentY + 5.5);

        currentY += 6;

        // Linha 2: QR CODE | SERIAL (Célula maior)
        doc.line(marginX, currentY + 12, marginX + tableWidth, currentY + 12);
        doc.line(marginX + 18, currentY, marginX + 18, currentY + 12);

        const qrData = val(p.internal_serial).trim();
        if (qrData !== "-") {
            try {
                const qrImgData = await QRCode.toDataURL(qrData, { margin: 1 });
                // QR Code agora centralizado no novo espaço
                doc.addImage(qrImgData, 'PNG', marginX + 1, currentY + 0.5, 16, 11);
            } catch (e) { }
        }

        doc.setFontSize(5.5);
        doc.text("NÚMERO DE SÉRIE AMBICOM:", marginX + 20, currentY + 3);
        doc.setFontSize(12); // Serial maior
        doc.text(val(p.internal_serial), marginX + 20, currentY + 8);
        doc.setFontSize(7);
        doc.text(val(p.commercial_code), marginX + 20, currentY + 11);

        currentY += 12;

        // Linha 3: PNC/ML | FREQUÊNCIA | GÁS
        doc.line(marginX, currentY + 6.5, marginX + tableWidth, currentY + 6.5);
        doc.line(marginX + 28, currentY, marginX + 28, currentY + 6.5);
        doc.line(marginX + 53, currentY, marginX + 53, currentY + 6.5);

        doc.setFontSize(5);
        doc.text("PNC/ML", marginX + 2, currentY + 2);
        doc.setFontSize(7.5);
        doc.text(val(p.pnc_ml), marginX + 2, currentY + 5.5);

        doc.setFontSize(5);
        doc.text("FREQUÊNCIA", marginX + 30, currentY + 2);
        doc.setFontSize(7.5);
        doc.text(val(p.frequency) || "60 Hz", marginX + 30, currentY + 5.5);

        doc.setFontSize(5);
        doc.text("GÁS", marginX + 55, currentY + 2);
        doc.setFontSize(7.5);
        doc.text(val(p.refrigerant_gas), marginX + 55, currentY + 5.5);

        currentY += 6.5;

        // Linha 4: VOLUMES E TAMANHO (Espalhado até o final)
        doc.line(marginX + 22, currentY, marginX + 22, currentY + 6.5);
        doc.line(marginX + 44, currentY, marginX + 44, currentY + 6.5);
        doc.line(marginX + 60, currentY, marginX + 60, currentY + 6.5);

        doc.setFontSize(4.5);
        doc.text("VOL. TOTAL", marginX + 2, currentY + 2);
        doc.setFontSize(7);
        doc.text(`${val(p.volume_total)} L`, marginX + 2, currentY + 5.5);

        doc.text("CORRENTE", marginX + 24, currentY + 2);
        doc.text(val(p.electric_current), marginX + 24, currentY + 5.5);

        doc.text("POT. DEGELO", marginX + 46, currentY + 2);
        doc.text(val(p.defrost_power), marginX + 46, currentY + 5.5);

        doc.text("TAM.", marginX + 62, currentY + 2);
        doc.setFontSize(13); // Letra G, M ou P bem grande no final

        const fullSize = p.size || await calculateProductSize(p.volume_total);
        const displaySize = fullSize === 'Pequeno' ? 'P' : fullSize === 'Médio' ? 'M' : fullSize === 'Grande' ? 'G' : "";
        doc.text(displaySize, marginX + 67, currentY + 5.5, { align: 'center' });
    }
    return doc;

};

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
