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

/**
 * Gera o código TSPL para uma etiqueta industrial (80x55mm)
 */
export const generateLabelTSPL = (data: any): string => {
    const val = (v: any) => v || "";
    const internalSerial = val(data.internal_serial);
    const model = val(data.model || data.modelo);
    const voltage = val(data.voltage || data.tensao);
    const pnc_ml = val(data.pnc_ml);
    const frequency = val(data.frequency || data.frequencia || '60 Hz');
    const gas = val(data.refrigerant_gas || data.gas_refrigerante);
    const gasCharge = val(data.gas_charge || data.carga_gas);
    const compressor = val(data.compressor);
    const volFreezer = val(data.volume_freezer);
    const volRefrig = val(data.volume_refrigerator);
    const volTotal = formatTotalVolume(data.volume_freezer, data.volume_refrigerator, data.volume_total);
    const pressure = val(data.pressure_high_low || data.pressao_alta_baixa);
    const capacCong = val(data.freezing_capacity || data.capacidade_congelamento);
    const current = val(data.electric_current || data.corrente_eletrica);
    const power = val(data.defrost_power || data.potencia_degelo);
    const size = data.size || data.tamanho ? String(data.size || data.tamanho).charAt(0).toUpperCase() : '-';

    return `SIZE 80 mm, 55 mm
GAP 3 mm, 0
DIRECTION 1,0
REFERENCE 0,0
CLS
; --- CABEÇALHO ---
TEXT 625, 15, "3", 90, 1, 1, "Ambicom"
TEXT 580, 15, "2", 90, 1, 1, "R. Wenceslau Marek, 10 - Aguas Belas,"
TEXT 565, 15, "2", 90, 1, 1, "Sao Jose dos Pinhais - PR, 83010-520"
TEXT 545, 15, "2", 90, 1, 1, "SAC: 041 - 3382-5410"
; --- BLOCO PRODUTO / GARANTIA ---
TEXT 625, 285, "1", 90, 1, 1, "PRODUTO"
TEXT 610, 285, "1", 90, 1, 1, "REMANUFATURADO"
TEXT 595, 285, "1", 90, 1, 1, "GARANTIA"
TEXT 580, 285, "1", 90, 1, 1, "AMBICOM"
; --- GRADE (BOX E LINHAS EXTERNAS) ---
BAR 20, 10, 500, 3          ; Linha do topo da grade
BAR 20, 430, 500, 3         ; Linha da base da grade
BAR 20, 10, 3, 420          ; Lateral esquerda
BAR 520, 10, 3, 420         ; Lateral direita
; --- COLUNAS VERTICAIS ---
BAR 460, 10, 3, 420         ; Coluna: Modelo/Voltagem
BAR 360, 10, 3, 420         ; Coluna: Serial/Código
BAR 290, 10, 3, 420         ; Coluna: PNC/Frequência
BAR 220, 10, 3, 420         ; Coluna: Gás/Compressor
BAR 150, 10, 3, 420         ; Coluna: Volumes
BAR 90, 10, 3, 420          ; Coluna: Pressão/Capacidade
; --- DIVISÓRIAS HORIZONTAIS INTERNAS ---
BAR 460, 215, 60, 3         ; Divisória Modelo | Voltagem
BAR 360, 215, 100, 3        ; Divisória N.Serie Ambicom | Código Comercial
BAR 290, 215, 70, 3         ; Divisória PNC/ML | Frequência
BAR 220, 215, 70, 3         ; Divisória Gás/Carga | Compressor
BAR 150, 215, 70, 3         ; Divisória Vol. Freezer/Refrig. | Vol. Total
BAR 90, 215, 60, 3          ; Divisória P. Alta/Baixa | Cap. Cong.
BAR 20, 215, 70, 3          ; Divisória Corrente/Pot. Degelo | Tamanho
; --- MODELO / VOLTAGEM ---
TEXT 510, 15, "2", 90, 1, 1, "MODELO"
TEXT 485, 15, "3", 90, 1, 1, "${val(data.model || data.modelo)}"
TEXT 510, 225, "2", 90, 1, 1, "VOLTAGEM"
TEXT 485, 225, "3", 90, 1, 1, "${val(data.voltage || data.tensao)}"
; --- QR CODE E SERIAL ---
QRCODE 455, 20, L, 4, A, 90, "${val(data.internal_serial)}"
TEXT 455, 110, "1", 90, 1, 1, "N. SERIE AMBICOM:"
TEXT 430, 110, "3", 90, 1, 1, "${val(data.internal_serial)}"
TEXT 390, 110, "2", 90, 1, 1, "${val(data.commercial_code || data.codigo_comercial)}"
; --- PNC / FREQUENCIA ---
TEXT 345, 15, "2", 90, 1, 1, "PNC/ML"
TEXT 315, 15, "3", 90, 1, 1, "${val(data.pnc_ml)}"
TEXT 345, 270, "2", 90, 1, 1, "FREQ."
TEXT 315, 270, "3", 90, 1, 1, "${val(data.frequency || '60 Hz')}"
; --- GAS / COMPRESSOR ---
TEXT 275, 15, "1", 90, 1, 1, "GAS/CARGA"
TEXT 245, 15, "2", 90, 1, 1, "${val(data.refrigerant_gas)} / ${val(data.gas_charge)}"
TEXT 275, 300, "1", 90, 1, 1, "COMPRESSOR"
TEXT 245, 300, "2", 90, 1, 1, "${val(data.compressor)}"
; --- VOLUMES ---
TEXT 205, 15, "1", 90, 1, 1, "VOL. FREEZER/REFRIG."
TEXT 175, 15, "2", 90, 1, 1, "${val(data.volume_freezer)} / ${val(data.volume_refrigerator)}"
TEXT 205, 300, "1", 90, 1, 1, "VOL. TOTAL"
TEXT 175, 300, "2", 90, 1, 1, "${val(data.volume_total)}"
; --- PRESSÃO / CAPACIDADE ---
TEXT 135, 15, "1", 90, 1, 1, "P. ALTA/BAIXA"
TEXT 110, 15, "1", 90, 1, 1, "${val(data.pressure_high_low)}"
TEXT 135, 300, "1", 90, 1, 1, "CAP. CONG."
TEXT 110, 300, "2", 90, 1, 1, "${val(data.freezing_capacity)}"
; --- RODAPÉ (CORRENTE / POTÊNCIA / TAMANHO) ---
TEXT 75, 15, "1", 90, 1, 1, "CORRENTE: ${val(data.electric_current)}"
TEXT 55, 15, "1", 90, 1, 1, "POT. DEGELO: ${val(data.defrost_power)}"
TEXT 75, 330, "2", 90, 1, 1, "TAMANHO"
TEXT 45, 330, "3", 90, 1, 1, "${data.size || '-'}"
PRINT 1
`;
};

