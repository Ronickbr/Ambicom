import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';
import { calculateProductSize } from './product-utils';

/**
 * Exporta dados de tabela para PDF (Relatório A4)
 */
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

/**
 * Exporta dados para Excel
 */
export const exportToExcel = (data: Record<string, unknown>[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
    XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
};

/**
 * Gera as etiquetas em formato PDF Industrial (80x55mm) rotacionado 90°
 */
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    // Dimensões da bobina: 80mm largura x 55mm altura
    const labelWidth = 80;
    const labelHeight = 55;

    // Criamos o documento em Paisagem (80x55)
    // Desenhado de forma linear para aproveitamento de 100% da área!
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [labelWidth, labelHeight],
        putOnlyUsedFonts: true,
        compress: true
    });

    for (let index = 0; index < products.length; index++) {
        const p = products[index];
        if (index > 0) doc.addPage([labelWidth, labelHeight], 'landscape');

        const val = (v: any) => String(v || "").replace(/[VLgWAsig()]/g, "").trim() || "-";

        doc.setTextColor(0, 0, 0);

        // --- CABEÇALHO (Y = 0 a 20) ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("Ambicom", 4, 8);

        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text("R. Wenceslau Marek, 10 - Águas Belas,", 4, 11);
        doc.text("São José dos Pinhais - PR, 83010-520", 4, 14);

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("SAC : 041 - 3382-5410", 4, 19);

        // Bloco Direito Superior (Garantia/Institucional)
        doc.setFontSize(5);
        doc.setFont("helvetica", "bold");
        const rightText = "PRODUTO\nREMANUFATURADO\nGARANTIA\nAMBICOM";
        doc.text(rightText, 76, 7, { align: 'right' });

        // --- GRADE TÉCNICA PRINCIPAL (Y = 22 a 51) ---
        const tX = 4, tY = 22, tW = 72, tH = 29;
        doc.setLineWidth(0.3);

        // Moldura Externa e Divisórias Horizontais
        doc.rect(tX, tY, tW, tH); // Box Principal
        doc.line(tX, 29, tX + tW, 29); // Linha R1 -> R2
        doc.line(tX, 38, tX + tW, 38); // Linha R2 -> R3
        doc.line(tX, 45, tX + tW, 45); // Linha R3 -> R4

        // ---Row 1: MODELO | VOLTAGEM---
        doc.line(50, 22, 50, 29); // Divisor Vertical

        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.text("MODELO", 5, 24.5);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(val(p.model || p.modelo), 5, 28);

        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.text("VOLTAGEM", 51, 24.5);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`${val(p.voltage || p.tensao)} V`, 51, 28);

        // ---Row 2: QR CODE | SERIAL---
        doc.line(20, 29, 20, 38); // Divisor Vertical

        const qrData = val(p.internal_serial);
        if (qrData && qrData !== "-") {
            try {
                const qrImgData = await QRCode.toDataURL(qrData, { margin: 0, width: 80 });
                doc.addImage(qrImgData, 'PNG', 8, 29.5, 8, 8);
            } catch (err) { }
        }

        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        doc.text("NÚMERO DE SÉRIE AMBICOM:", 21, 31.5);

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(val(p.internal_serial), 21, 36);

        // Código Comercial à direita do Serial (se houver espaço)
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(val(p.commercial_code), 55, 35.5);

        // ---Row 3: PNC/ML | GÁS | FREQUÊNCIA---
        doc.line(35, 38, 35, 45); // Divisor PNC/Gas
        doc.line(55, 38, 55, 45); // Divisor Gas/Freq

        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.text("PNC/ML", 5, 40.5);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(val(p.pnc_ml), 5, 44);

        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.text("GÁS FRIGOR.", 36, 40.5);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        const gasDesc = val(p.refrigerant_gas) !== "-" ? `${val(p.refrigerant_gas)} ${val(p.gas_charge)}g` : "-";
        doc.text(gasDesc, 36, 44);

        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.text("FREQUÊNCIA", 56, 40.5);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("60 Hz", 56, 44);

        // ---Row 4: VOLUMES E TAMANHO---
        doc.line(22, 45, 22, 51); // Divisor 1
        doc.line(40, 45, 40, 51); // Divisor 2
        doc.line(60, 45, 60, 51); // Divisor 3

        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.text("VOL. FREEZER", 5, 47.5);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`${val(p.volume_freezer)} L`, 5, 50);

        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.text("VOL. REFRIG.", 23, 47.5);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`${val(p.volume_refrigerator)} L`, 23, 50);

        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.text("VOLUME TOTAL", 41, 47.5);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`${val(p.volume_total)} L`, 41, 50);

        doc.setFontSize(5);
        doc.setFont("helvetica", "normal");
        doc.text("TAMANHO", 61, 47.5);

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const sizeFull = p.size || await calculateProductSize(p.volume_total);
        const dispSize = sizeFull === 'Pequeno' ? 'P' : sizeFull === 'Médio' ? 'M' : sizeFull === 'Grande' ? 'G' : sizeFull;
        doc.text(dispSize || "-", 64, 50);
    }

    return doc;
};

/**
 * Converte um Documento jsPDF para String Base64 (sem prefixo)
 */
export const pdfToBase64 = (doc: jsPDF): string => {
    const rawString = doc.output('datauristring').split(',')[1];
    return rawString;
};

/**
 * Helper para imprimir etiquetas localmente no navegador (Download)
 */
export const printLabels = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    const timestamp = new Date().getTime();
    doc.save(`etiquetas_ambicom_${timestamp}.pdf`);
};



