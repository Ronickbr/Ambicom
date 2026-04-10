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
    const val = (v: any) => v || "-";

    // Configurações Base
    const W = 80; // mm
    const H = 55; // mm
    const dotsH = 440; // 55mm * 8

    return `SIZE ${W} mm, ${H} mm
GAP 3 mm, 0
DIRECTION 0,0
REFERENCE 0,0
CLS

; --- ZONA 1: CABEÇALHO LATERAL (X=10 a 100) ---
TEXT 30, ${dotsH - 10}, "4", 90, 1, 1, "Ambicom"
TEXT 65, ${dotsH - 10}, "1", 90, 1, 1, "R. Wenceslau Marek, 10 - Aguas Belas,"
TEXT 80, ${dotsH - 10}, "1", 90, 1, 1, "Sao Jose dos Pinhais - PR, 83010-520"
TEXT 105, ${dotsH - 10}, "3", 90, 1, 1, "SAC : 041 - 3382-5410"

; --- GRADE PRINCIPAL (Inicia em X=130) ---
BOX 130, 10, 630, ${dotsH - 10}, 2

; Linhas Verticais (Grelha Industrial)
BAR 280, 10, 2, ${dotsH - 20}   ; Divisor entre Coluna 1 e 2
BAR 440, 10, 2, ${dotsH - 20}   ; Divisor entre Coluna 2 e 3

; Linhas Horizontais (Divisores de Linha)
BAR 130, 80, 500, 2   ; Linha 1 (Modelo/Voltagem)
BAR 130, 200, 500, 2  ; Linha 2 (Serial/PNC)
BAR 130, 260, 500, 2  ; Linha 3 (Gás/Carga)
BAR 130, 320, 500, 2  ; Linha 4 (Volumes)
BAR 130, 380, 500, 2  ; Linha 5 (Pressão/Capacidade)

; --- COLUNA 1 (X=140) ---
TEXT 140, 70, "1", 90, 1, 1, "MODELO"
TEXT 170, 70, "3", 90, 1, 1, "${val(data.model || data.modelo)}"
TEXT 140, 190, "1", 90, 1, 1, "PNC/ML"
TEXT 170, 190, "2", 90, 1, 1, "${val(data.pnc_ml)}"
TEXT 140, 250, "1", 90, 1, 1, "GAS FRIGOR."
TEXT 170, 250, "2", 90, 1, 1, "${val(data.refrigerant_gas)}"
TEXT 140, 310, "1", 90, 1, 1, "VOL. FREEZER"
TEXT 170, 310, "2", 90, 1, 1, "${val(data.volume_freezer)} L"
TEXT 140, 370, "1", 90, 1, 1, "P. DE ALTA"
TEXT 160, 370, "1", 90, 1, 1, "(${val(data.pressure_high_low)})"
TEXT 140, 430, "1", 90, 1, 1, "CORRENTE"
TEXT 165, 430, "3", 90, 1, 1, "${val(data.electric_current)} A"

; --- COLUNA 2 (X=290) ---
TEXT 290, 70, "1", 90, 1, 1, "VOLTAGEM"
TEXT 320, 70, "4", 90, 1, 1, "${val(data.voltage || data.tensao)} V"
TEXT 290, 250, "1", 90, 1, 1, "CARGA GAS"
TEXT 320, 250, "3", 90, 1, 1, "${val(data.gas_charge)} g"
TEXT 290, 310, "1", 90, 1, 1, "VOL. REFRIG."
TEXT 320, 310, "2", 90, 1, 1, "${val(data.volume_refrigerator)} L"
TEXT 290, 430, "1", 90, 1, 1, "POT. DEGELO"
TEXT 320, 430, "3", 90, 1, 1, "${val(data.defrost_power)} W"

; --- COLUNA 3 (X=450) ---
QRCODE 450, 60, L, 4, 90, "${val(data.internal_serial)}"
TEXT 510, 180, "0", 90, 1, 1, "N. SERIE AMBICOM:"
TEXT 540, 180, "4", 90, 1, 1, "${val(data.internal_serial)}"
TEXT 570, 180, "2", 90, 1, 1, "${val(data.commercial_code)}"

TEXT 450, 195, "5", 90, 1, 1, "60 Hz"
TEXT 450, 250, "1", 90, 1, 1, "COMPRESSOR"
TEXT 480, 250, "2", 90, 1, 1, "${val(data.compressor)}"
TEXT 450, 310, "1", 90, 1, 1, "VOLUME TOTAL"
TEXT 480, 310, "4", 90, 1, 1, "${val(data.volume_total)} L"
TEXT 450, 370, "1", 90, 1, 1, "CAPAC. CONG."
TEXT 480, 370, "2", 90, 1, 1, "${val(data.freezing_capacity)}"
TEXT 450, 430, "1", 90, 1, 1, "TAMANHO"
TEXT 480, 430, "5", 90, 1, 1, "${val(data.size || 'G')}"

; Bloco Remanufaturado (Topo oposto)
TEXT 610, 430, "1", 90, 1, 1, "PRODUTO REMANUFATURADO"
TEXT 625, 430, "1", 90, 1, 1, "GARANTIA AMBICOM"

PRINT 1
`;
};

