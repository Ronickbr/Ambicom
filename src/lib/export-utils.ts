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

    // LABELS: 55mm (L) x 80mm (A) - Orientação Vertical Nativa
    // v2.22.0 - Replicação de Grade Técnica
    return `SIZE 55 mm, 80 mm
GAP 3 mm, 0
DIRECTION 1,0
REFERENCE 0,0
CLS

; --- TOPO: INSTITUCIONAL ---
TEXT 20, 20, "3", 0, 1, 1, "Ambicom"
TEXT 20, 50, "1", 0, 1, 1, "R. Wenceslau Marek, 10 - Aguas Belas"
TEXT 20, 65, "1", 0, 1, 1, "SJP - PR | SAC: 041 3382-5410"

; --- GRADE TÉCNICA PUZZLE (Referência 1086) ---
; Borda Externa
BOX 15, 100, 425, 620, 4

; Linhas Horizontais (Divisores de Seção)
BAR 15, 160, 410, 4   ; Fim Modelo/Volt
BAR 15, 260, 410, 4   ; Fim Serial
BAR 15, 310, 410, 4   ; Fim PNC/ML
BAR 15, 410, 410, 4   ; Fim Gás/Carga/Freq
BAR 15, 510, 410, 4   ; Fim Volumes
BAR 15, 560, 150, 4   ; Linha extra Tamanho

; Linhas Verticais (Divisores de Coluna)
BAR 230, 100, 4, 60   ; Entre Modelo e Voltagem
BAR 150, 310, 4, 310  ; Divisor principal esquerdo
BAR 290, 310, 4, 310  ; Divisor principal direito

; --- CONTEÚDO ---

; Linha 1: Modelo e Voltagem
TEXT 25, 110, "1", 0, 1, 1, "MODELO"
TEXT 25, 130, "3", 0, 1, 1, "${v(data.model || data.modelo)}"
TEXT 240, 110, "1", 0, 1, 1, "VOLTAGEM"
TEXT 240, 125, "4", 0, 1, 1, "${v(data.voltage || data.tensao)}V"

; Linha 2: Numero de Serie Grande
TEXT 25, 170, "1", 0, 1, 1, "NUMERO DE SERIE AMBICOM:"
TEXT 25, 195, "4", 0, 2, 2, "${v(data.internal_serial)}"
QRCODE 320, 165, L, 4, 0, "${v(data.internal_serial)}"

; Linha 3: PNC/ML
TEXT 25, 275, "2", 0, 1, 1, "PNC/ML: ${v(data.pnc_ml)}"

; Linha 4: Gás / Carga / 60Hz
TEXT 25, 320, "1", 0, 1, 1, "GAS FRIG."
TEXT 25, 350, "3", 0, 1, 1, "${v(data.refrigerant_gas)}"
TEXT 160, 320, "1", 0, 1, 1, "CARGA GAS"
TEXT 160, 350, "3", 0, 1, 1, "${v(data.gas_charge)}g"
TEXT 300, 320, "4", 0, 1, 2, "60 Hz"

; Linha 5: Volumes
TEXT 25, 420, "1", 0, 1, 1, "VOL. FRZ"
TEXT 25, 450, "3", 0, 1, 1, "${v(data.volume_freezer)}L"
TEXT 160, 420, "1", 0, 1, 1, "VOL. REF"
TEXT 160, 450, "3", 0, 1, 1, "${v(data.volume_refrigerator)}L"
TEXT 300, 420, "1", 0, 1, 1, "VOL. TOT"
TEXT 300, 450, "4", 0, 1, 1, "${v(data.volume_total)}L"

; Linha 6: Compressor e Dados Finais
TEXT 160, 520, "1", 0, 1, 1, "PRESSÃO ALTA/BAIXA (psig)"
TEXT 160, 540, "1", 0, 1, 1, "(${v(data.pressure_high_low)})"
TEXT 300, 520, "1", 0, 1, 1, "TAMANHO"
TEXT 300, 545, "5", 0, 1, 1, "${v(data.size || 'G')}"

TEXT 25, 570, "1", 0, 1, 1, "CORRENTE"
TEXT 25, 595, "3", 0, 1, 1, "${v(data.electric_current)}A"
TEXT 160, 570, "1", 0, 1, 1, "POT. DEGELO"
TEXT 160, 595, "3", 0, 1, 1, "${v(data.defrost_power)}W"

; Rodapé Lateral (Garantia)
TEXT 20, 640, "1", 0, 1, 1, "PRODUTO REMANUFATURADO - GARANTIA AMBICOM"

PRINT 1
`;
};
