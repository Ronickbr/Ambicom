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
    // Motor v2.20.0 - Foco em Geometria Industrial
    return `SIZE 80 mm, 55 mm
GAP 3 mm, 0
DIRECTION 1,0
REFERENCE 0,0
CLS

; --- CABEÇALHO INSTITUCIONAL ---
TEXT 620, 15, "3", 90, 1, 1, "Ambicom"
TEXT 595, 15, "1", 90, 1, 1, "R. Wenceslau Marek, 10 - Aguas Belas"
TEXT 580, 15, "1", 90, 1, 1, "Sao Jose dos Pinhais - PR | SAC: 041 3382-5410"

; Bloco Garantia (Topo Direito no produto)
TEXT 625, 310, "1", 90, 1, 1, "PRODUTO REMANUFATURADO"
TEXT 610, 310, "1", 90, 1, 1, "GARANTIA AMBICOM"

; --- MOLDURA DA GRADE ---
BOX 20, 10, 560, 435, 6

; --- DIVISORES HORIZONTAIS (Na etiqueta vertical) ---
BAR 20, 155, 540, 6   ; Linha 1 (Modelo/Volt)
BAR 20, 260, 540, 6   ; Linha 2 (Serial/PNC)
BAR 20, 310, 540, 6   ; Linha 3 (Gás/Carga)
BAR 20, 360, 540, 6   ; Linha 4 (Compressor/Volumes)
BAR 20, 400, 540, 6   ; Linha 5 (Corrente/Tamanho)

; --- DIVISORES VERTICAIS ---
BAR 380, 10, 6, 145   ; Entre Modelo e Voltagem
BAR 380, 260, 6, 175  ; Entre seções de dados na base
BAR 200, 10, 6, 145   ; Terceira coluna no topo (Serial area)
BAR 200, 260, 6, 175  ; Divisor central na base

; --- CONTEÚDO TÉCNICO (ROTAÇÃO 90 OBRIGATÓRIA) ---

; BLOCO 1: IDENTIFICAÇÃO
TEXT 550, 20, "1", 90, 1, 1, "MODELO"
TEXT 525, 20, "3", 90, 1, 1, "${v(data.model || data.modelo)}"

TEXT 550, 165, "1", 90, 1, 1, "VOLTAGEM"
TEXT 515, 165, "4", 90, 1, 1, "${v(data.voltage || data.tensao)} V"

; BLOCO 2: RASTREABILIDADE (SERIAL GRANDE)
TEXT 370, 20, "1", 90, 1, 1, "N. SERIE AMBICOM:"
TEXT 340, 20, "4", 90, 1, 2, "${v(data.internal_serial)}"
QRCODE 370, 350, L, 4, 90, "${v(data.internal_serial)}"
TEXT 290, 20, "2", 90, 1, 1, "PNC/ML: ${v(data.pnc_ml)}"

; BLOCO 3: DADOS FLUIDOS
TEXT 250, 20, "1", 90, 1, 1, "GAS FRIG."
TEXT 230, 20, "2", 90, 1, 1, "${v(data.refrigerant_gas)}"
TEXT 250, 145, "1", 90, 1, 1, "CARGA GAS"
TEXT 230, 145, "2", 90, 1, 1, "${v(data.gas_charge)} g"
TEXT 250, 290, "4", 90, 1, 1, "60 Hz"

; BLOCO 4: COMPRESSOR E VOLUMES
TEXT 200, 20, "1", 90, 1, 1, "COMPRESSOR"
TEXT 180, 20, "2", 90, 1, 1, "${v(data.compressor)}"
TEXT 200, 165, "1", 90, 1, 1, "VOL. FREEZER"
TEXT 185, 165, "2", 90, 1, 1, "${v(data.volume_freezer)} L"
TEXT 200, 310, "1", 90, 1, 1, "VOL. REFRIG."
TEXT 185, 310, "2", 90, 1, 1, "${v(data.volume_refrigerator)} L"

; BLOCO 5: EFICIÊNCIA E TAMANHO
TEXT 150, 20, "1", 90, 1, 1, "VOLUME TOTAL"
TEXT 130, 20, "3", 90, 1, 1, "${v(data.volume_total)} L"
TEXT 150, 165, "1", 90, 1, 1, "CAPAC. CONG."
TEXT 130, 165, "2", 90, 1, 1, "${v(data.freezing_capacity)}"
TEXT 150, 310, "1", 90, 1, 1, "PRESSÃO (H/L)"
TEXT 130, 310, "1", 90, 1, 1, "${v(data.pressure_high_low)}"

; BLOCO 6: RODAPÉ FINAL
TEXT 100, 20, "1", 90, 1, 1, "CORRENTE"
TEXT 75, 20, "3", 90, 1, 1, "${v(data.electric_current)} A"
TEXT 100, 165, "1", 90, 1, 1, "POT. DEGELO"
TEXT 75, 165, "3", 90, 1, 1, "${v(data.defrost_power)} W"
TEXT 100, 310, "1", 90, 1, 1, "TAMANHO"
TEXT 70, 310, "5", 90, 1, 1, "${v(data.size || 'G')}"

PRINT 1
`;
};
