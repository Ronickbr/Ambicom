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

        const val = (v: any) => String(v || "").replace(/[VLgWAsig()]/g, "").trim();

        // --- SISTEMA DE COORDENADAS ROTACIONADO 90° ---
        // Toda a etiqueta é feita "deitada" no PDF para sair "de pé" na impressora

        // 1. Bloco Lateral/Topo (Logo Ambicom e Endereço)
        // No PDF landscape, isso fica na esquerda lendo de baixo para cima
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("Ambicom", 14, 48, { angle: 90 });

        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text("R. Wenceslau Marek, 10 - Águas Belas,", 18, 48, { angle: 90 });
        doc.text("São José dos Pinhais - PR, 83010-520", 21, 48, { angle: 90 });

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("SAC : 041 - 3382-5410", 28, 48, { angle: 90 });

        // Bloco Direito Superior (Garantia/Institucional)
        doc.setFontSize(6);
        doc.text("PRODUTO", 12, 10, { angle: 90, align: 'center' });
        doc.text("REMANUFATURADO", 15, 10, { angle: 90, align: 'center' });
        doc.text("GARANTIA", 18, 10, { angle: 90, align: 'center' });
        doc.text("AMBICOM", 21, 10, { angle: 90, align: 'center' });

        // --- GRADE TÉCNICA PRINCIPAL (Inicia em X=32) ---
        const startX = 32;
        doc.setLineWidth(0.3);

        // Moldura Externa (Grid)
        doc.line(startX, 4, startX + 44, 4); // Topo
        doc.line(startX, 51, startX + 44, 51); // Base
        doc.line(startX, 4, startX, 51); // Esquerda
        doc.line(startX + 44, 4, startX + 44, 51); // Direita

        // Divisórias Horizontais (Verticais após rotação)
        doc.line(startX + 11, 4, startX + 11, 51); // Linha 1
        doc.line(startX + 22, 4, startX + 22, 51); // Linha 2
        doc.line(startX + 33, 4, startX + 33, 51); // Linha 3

        // Célula: MODELO | VOLTAGEM
        doc.setFontSize(6);
        doc.text("MODELO", startX + 3, 48, { angle: 90 });
        doc.setFontSize(14);
        doc.text(val(p.model || p.modelo), startX + 9, 48, { angle: 90 });

        doc.line(startX + 11, 28, startX, 28); // Divisor Modelo/Voltagem
        doc.setFontSize(6);
        doc.text("VOLTAGEM", startX + 3, 22, { angle: 90 });
        doc.setFontSize(16);
        doc.text(`${val(p.voltage || p.tensao)} V`, startX + 9, 22, { angle: 90 });

        // Célula: QR CODE | SERIAL
        const qrData = val(p.internal_serial);
        if (qrData) {
            try {
                const qrImgData = await QRCode.toDataURL(qrData, { margin: 0, width: 80 });
                doc.addImage(qrImgData, 'PNG', startX + 12, 38, 9, 9);
            } catch (err) { }
        }
        doc.setFontSize(5);
        doc.text("NÚMERO DE SÉRIE AMBICOM:", startX + 14, 26, { angle: 90 });
        doc.setFontSize(12);
        doc.text(val(p.internal_serial), startX + 18, 26, { angle: 90 });
        doc.setFontSize(10);
        doc.text(val(p.commercial_code), startX + 21, 26, { angle: 90 });

        // Célula: PNC/ML | GÁS | FREQUÊNCIA
        doc.setFontSize(5);
        doc.text("PNC/ML", startX + 24, 48, { angle: 90 });
        doc.setFontSize(11);
        doc.text(val(p.pnc_ml), startX + 30, 48, { angle: 90 });

        doc.line(startX + 33, 30, startX + 22, 30); // Divisor PNC/Gás
        doc.setFontSize(5);
        doc.text("GÁS FRIGOR.", startX + 24, 28, { angle: 90 });
        doc.setFontSize(9);
        doc.text(val(p.refrigerant_gas), startX + 28, 28, { angle: 90 });
        doc.setFontSize(5);
        doc.text("CARGA GÁS", startX + 30, 28, { angle: 90 });
        doc.setFontSize(9);
        doc.text(`${val(p.gas_charge)} g`, startX + 32, 28, { angle: 90 });

        doc.line(startX + 33, 14, startX + 22, 14); // Divisor Gás/Freq
        doc.setFontSize(5);
        doc.text("FREQUÊNCIA", startX + 24, 12, { angle: 90 });
        doc.setFontSize(10);
        doc.text("60 Hz", startX + 30, 12, { angle: 90 });

        // Célula Rodapé Técnico
        doc.setFontSize(5);
        doc.text("VOL. FREEZER", startX + 35, 48, { angle: 90 });
        doc.setFontSize(8);
        doc.text(`${val(p.volume_freezer)} L`, startX + 40, 48, { angle: 90 });

        doc.line(startX + 44, 38, startX + 33, 38);
        doc.setFontSize(5);
        doc.text("VOL. REFRIG.", startX + 35, 36, { angle: 90 });
        doc.setFontSize(8);
        doc.text(`${val(p.volume_refrigerator)} L`, startX + 40, 36, { angle: 90 });

        doc.line(startX + 44, 26, startX + 33, 26);
        doc.setFontSize(5);
        doc.text("VOLUME TOTAL", startX + 35, 24, { angle: 90 });
        doc.setFontSize(9);
        doc.text(`${val(p.volume_total)} L`, startX + 40, 24, { angle: 90 });

        doc.line(startX + 44, 12, startX + 33, 12);
        doc.setFontSize(5);
        doc.text("TAMANHO", startX + 35, 10, { angle: 90 });
        const sizeFull = p.size || await calculateProductSize(p.volume_total);
        const dispSize = sizeFull === 'Pequeno' ? 'P' : sizeFull === 'Médio' ? 'M' : 'G';
        doc.setFontSize(12);
        doc.text(dispSize, startX + 41, 10, { angle: 90 });
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



