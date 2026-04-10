import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';
import { calculateProductSize, formatTotalVolume } from './product-utils';

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

export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    // Dimensões da bobina: 80mm largura x 55mm altura
    const labelWidth = 80;
    const labelHeight = 55;
    const doc = new jsPDF({
        unit: 'mm',
        format: [labelWidth, labelHeight],
        putOnlyUsedFonts: true,
        compress: true
    });

    for (let index = 0; index < products.length; index++) {
        const p = products[index];
        if (index > 0) doc.addPage([labelHeight, labelWidth]); // ← mesmo ajuste aqui


        // Atalho para valor ou vazio
        const val = (v: any) => v || "";

        // --- Cabeçalho (Área Superior: Y 2 a 18) ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text("Ambicom", 4, 8);

        // Subtítulo (Bloco à Direita: X 52 a 76)
        doc.setFontSize(6);
        const subtitleX = 58;
        doc.text("PRODUTO", subtitleX + 5, 6);
        doc.text("REMANUFATURADO", subtitleX, 8.5);
        doc.text("GARANTIA", subtitleX + 4.5, 11);
        doc.text("AMBICOM", subtitleX + 5, 13.5);

        // Endereço e SAC
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.text("R. Wenceslau Marek, 10 - Águas Belas,", 4, 11);
        doc.text("São José dos Pinhais - PR, 83010-520", 4, 13.5);

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`SAC : 041 - 3382-5410`, 4, 18.5);

        // --- Grid Section (A partir de Y 20) ---
        let currentY = 20;
        doc.setLineWidth(0.3);

        // Row 1: MODELO | VOLTAGEM
        doc.line(4, currentY, 76, currentY); // Topo
        doc.line(40, currentY, 40, currentY + 10); // Divisor Vertical

        doc.setFontSize(6);
        doc.text("MODELO", 22, currentY + 3, { align: 'center' });
        doc.setFontSize(14);
        doc.text(val(p.model || p.modelo), 22, currentY + 8, { align: 'center' });

        doc.setFontSize(6);
        doc.text("VOLTAGEM", 58, currentY + 3, { align: 'center' });
        doc.setFontSize(14);
        doc.text(val(p.voltage || p.tensao), 58, currentY + 8, { align: 'center' });

        currentY += 10;
        doc.line(4, currentY, 76, currentY);

        // Row 2: QR CODE e NÚMERO DE SÉRIE (Y 30 a 44)
        const qrData = val(p.internal_serial).trim();
        if (qrData) {
            try {
                const qrImgData = await QRCode.toDataURL(qrData, { margin: 0, width: 60 });
                doc.addImage(qrImgData, 'PNG', 5, currentY + 1, 12, 12);
            } catch (err) { }
        }

        doc.setFontSize(5.5);
        doc.text("NÚMERO DE SÉRIE AMBICOM:", 48, currentY + 3, { align: 'center' });
        doc.setFontSize(14);
        doc.text(val(p.internal_serial), 48, currentY + 8, { align: 'center' });
        doc.setFontSize(12);
        doc.text(val(p.commercial_code || p.codigo_comercial), 48, currentY + 13, { align: 'center' });

        currentY += 14;
        doc.line(4, currentY, 76, currentY);

        // Row 3: Inf. Adicionais (Grid Compacto Y 44 a 53)
        const colW = 24; // 72 / 3

        // Linhas verticais para o grid final
        doc.line(28, currentY, 28, 53);
        doc.line(52, currentY, 52, 53);

        // Col 1: PNC/ML
        doc.setFontSize(5.5);
        doc.text("PNC/ML", 16, currentY + 2.5, { align: 'center' });
        doc.setFontSize(10);
        doc.text(val(p.pnc_ml), 16, currentY + 7, { align: 'center' });

        // Col 2: FREQUÊNCIA
        doc.setFontSize(5.5);
        doc.text("FREQUÊNCIA", 40, currentY + 2.5, { align: 'center' });
        doc.setFontSize(10);
        doc.text(val(p.frequency || p.frequencia) || "60 Hz", 40, currentY + 7, { align: 'center' });

        // Col 3: TAMANHO
        doc.setFontSize(5.5);
        doc.text("TAMANHO", 64, currentY + 2.5, { align: 'center' });
        const fullSize = p.size || await calculateProductSize(p.volume_total);
        const displaySize = fullSize === 'Pequeno' ? 'P' : fullSize === 'Médio' ? 'M' : fullSize === 'Grande' ? 'G' : "";
        doc.setFontSize(12);
        doc.text(displaySize, 64, currentY + 7, { align: 'center' });

        // Bordas externas
        doc.line(4, 20, 4, 53); // Esquerda
        doc.line(76, 20, 76, 53); // Direira
        doc.line(4, 53, 76, 53); // Base
    }

    return doc;
};

export const printLabels = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    const timestamp = new Date().getTime();
    doc.save(`etiquetas_ambicom_${timestamp}.pdf`);
};

export const generateLabelTSPL = (data: any): string => {
    const v = (val: any) => {
        if (!val) return "-";
        return String(val).replace(/[VLgWAsig()]/g, "").trim();
    };

    // LABELS: 80mm (L) x 55mm (A)
    // Rotação 90 para leitura vertical (Portrait Look on Landscape Ribbon)
    return `SIZE 80 mm, 55 mm
GAP 3 mm, 0
DIRECTION 1,0
REFERENCE 0,0
CLS

; --- ZONA 1 (ESQUERDA): INSTITUCIONAL ---
TEXT 620, 10, "3", 90, 1, 1, "Ambicom"
TEXT 595, 10, "1", 90, 1, 1, "R. Wenceslau Marek, 10 - Aguas Belas"
TEXT 580, 10, "1", 90, 1, 1, "SJP - PR | SAC: 041 3382-5410"

; Bloco Garantia (Vertical no canto oposto)
TEXT 625, 300, "1", 90, 1, 1, "PRODUTO REMANUFATURADO"
TEXT 610, 300, "1", 90, 1, 1, "GARANTIA AMBICOM"

; --- GRADE TÉCNICA PRINCIPAL (v2.19.0) ---
; Moldura Externa
BOX 15, 10, 565, 430, 4

; DIVISORES DE COLUNA (Verticais na etiqueta vertical)
BAR 445, 10, 4, 420   ; Col 1 / 2
BAR 330, 10, 4, 420   ; Col 2 / 3
BAR 215, 10, 4, 420   ; Col 3 / 4

; DIVISORES DE LINHA (Horizontais na etiqueta vertical)
BAR 15, 95, 550, 4    ; Linha 1 (Modelo/Voltagem...)
BAR 15, 175, 550, 4   ; Linha 2 (PNC/Carga...)
BAR 15, 260, 550, 4   ; Linha 3 (Gás/Refrig...)
BAR 15, 345, 550, 4   ; Linha 4 (Pressão...)

; --- COLUNA 1: DADOS PRIMÁRIOS ---
TEXT 550, 20, "1", 90, 1, 1, "MODELO"
TEXT 525, 20, "3", 90, 1, 1, "${v(data.model || data.modelo)}"
TEXT 435, 20, "1", 90, 1, 1, "VOLTAGEM"
TEXT 410, 20, "4", 90, 1, 1, "${v(data.voltage || data.tensao)}V"
TEXT 320, 20, "1", 90, 1, 1, "GAS FRIGOR."
TEXT 295, 20, "2", 90, 1, 1, "${v(data.refrigerant_gas)}"
TEXT 205, 20, "1", 90, 1, 1, "VOL. FREEZER"
TEXT 180, 20, "3", 90, 1, 1, "${v(data.volume_freezer)}L"
TEXT 90, 20, "1", 90, 1, 1, "CORRENTE"
TEXT 65, 20, "3", 90, 1, 1, "${v(data.electric_current)}A"

; --- COLUNA 2: DADOS SECUNDÁRIOS ---
TEXT 550, 105, "1", 90, 1, 1, "PNC/ML"
TEXT 515, 105, "2", 90, 1, 1, "${v(data.pnc_ml)}"
TEXT 435, 105, "1", 90, 1, 1, "CARGA GAS"
TEXT 410, 105, "3", 90, 1, 1, "${v(data.gas_charge)}g"
TEXT 320, 105, "1", 90, 1, 1, "VOL. REFRIG."
TEXT 295, 105, "3", 90, 1, 1, "${v(data.volume_refrigerator)}L"
TEXT 205, 105, "1", 90, 1, 1, "P. DE ALTA"
TEXT 180, 105, "1", 90, 1, 1, "(${v(data.pressure_high_low)})"
TEXT 90, 105, "1", 90, 1, 1, "POT. DEGELO"
TEXT 65, 105, "3", 90, 1, 1, "${v(data.defrost_power)}W"

; --- COLUNA 3: RASTREABILIDADE (SERIAL GRANDE) ---
QRCODE 550, 230, L, 4, 90, "${v(data.internal_serial)}"
TEXT 550, 310, "0", 90, 1, 1, "SERIAL AMBICOM:"
TEXT 525, 310, "4", 90, 1, 1, "${v(data.internal_serial)}"
TEXT 495, 310, "2", 90, 1, 1, "${v(data.commercial_code)}"

TEXT 435, 230, "1", 90, 1, 1, "VOLUME TOTAL"
TEXT 405, 230, "4", 90, 1, 1, "${v(data.volume_total)}L"
TEXT 320, 230, "1", 90, 1, 1, "CAPAC. CONG."
TEXT 295, 230, "2", 90, 1, 1, "${v(data.freezing_capacity)}"
TEXT 205, 230, "1", 90, 1, 1, "TAMANHO"
TEXT 175, 230, "5", 90, 1, 1, "${v(data.size || 'G')}"
TEXT 90, 230, "5", 90, 1, 1, "60 Hz"

PRINT 1
`;
};
