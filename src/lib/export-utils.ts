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
        // Limpeza de unidades duplicadas
        return String(val).replace(/[VLgWAsig()]/g, "").trim();
    };

    // LABELS: 80mm (L) x 55mm (A)
    // Usamos 90 graus para ler a etiqueta na vertical (80mm de altura)
    return `SIZE 80 mm, 55 mm
GAP 3 mm, 0
DIRECTION 1,0
REFERENCE 0,0
CLS

; --- LATERAL ESQUERDA: INSTITUCIONAL (LOGO Ambicom) ---
TEXT 620, 20, "3", 90, 1, 1, "Ambicom"
TEXT 590, 20, "1", 90, 1, 1, "R. Wenceslau Marek, 10 - Aguas Belas"
TEXT 575, 20, "1", 90, 1, 1, "Sao Jose dos Pinhais - PR | SAC: 041 3382-5410"

; --- GRADE TÉCNICA (BOX INICIA EM X=550) ---
BOX 20, 15, 550, 425, 2

; Divisores de Coluna Internos (Horizontais na bobina, Verticais na etiqueta)
BAR 380, 15, 2, 410   ; Divisor Col 1 / 2
BAR 210, 15, 2, 410   ; Divisor Col 2 / 3

; Divisores de Linha Internos (Verticais na bobina, Horizontais na etiqueta)
BAR 20, 90, 530, 2    ; Linha 1
BAR 20, 180, 530, 2   ; Linha 2
BAR 20, 250, 530, 2   ; Linha 3
BAR 20, 330, 530, 2   ; Linha 4

; --- COLUNA 1: IDENTIFICAÇÃO (X=540 a 390) ---
TEXT 535, 25, "1", 90, 1, 1, "MODELO"
TEXT 515, 25, "3", 90, 1, 1, "${v(data.model || data.modelo)}"
TEXT 535, 220, "1", 90, 1, 1, "VOLTAGEM"
TEXT 510, 220, "4", 90, 1, 1, "${v(data.voltage || data.tensao)} V"

; --- COLUNA 2: DADOS FLUIDOS (X=370 a 220) ---
QRCODE 370, 330, L, 4, 90, "${v(data.internal_serial)}"
TEXT 370, 25, "1", 90, 1, 1, "N. SERIE AMBICOM:"
TEXT 345, 25, "3", 90, 1, 1, "${v(data.internal_serial)}"
TEXT 305, 25, "1", 90, 1, 1, "PNC/ML:"
TEXT 285, 25, "2", 90, 1, 1, "${v(data.pnc_ml)}"
TEXT 370, 250, "4", 90, 1, 1, "60 Hz"

; --- COLUNA 3: DADOS TÉCNICOS (X=200 a 25) ---
TEXT 200, 25, "1", 90, 1, 1, "GAS"
TEXT 180, 25, "2", 90, 1, 1, "${v(data.refrigerant_gas)}"
TEXT 200, 140, "1", 90, 1, 1, "CARGA"
TEXT 180, 140, "2", 90, 1, 1, "${v(data.gas_charge)} g"
TEXT 200, 280, "1", 90, 1, 1, "COMPRESSOR"
TEXT 180, 280, "2", 90, 1, 1, "${v(data.compressor)}"

TEXT 150, 25, "1", 90, 1, 1, "VOL. FRZ"
TEXT 130, 25, "2", 90, 1, 1, "${v(data.volume_freezer)} L"
TEXT 150, 140, "1", 90, 1, 1, "VOL. REF"
TEXT 130, 140, "2", 90, 1, 1, "${v(data.volume_refrigerator)} L"
TEXT 150, 280, "1", 90, 1, 1, "VOL. TOT"
TEXT 130, 280, "3", 90, 1, 1, "${v(data.volume_total)} L"

TEXT 80, 25, "1", 90, 1, 1, "CAP. CONG."
TEXT 60, 25, "2", 90, 1, 1, "${v(data.freezing_capacity)}"
TEXT 80, 280, "1", 90, 1, 1, "TAMANHO"
TEXT 50, 280, "5", 90, 1, 1, "${v(data.size || 'G')}"

TEXT 30, 25, "1", 90, 1, 1, "PRODUTO REMANUFATURADO - GARANTIA AMBICOM"

PRINT 1
`;
};

