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
GAP 3 mm, 0 mm
DIRECTION 1,0
REFERENCE 0,0
CLS

' === CABEÇALHO: Ambicom + Endereço + Produto Remanufaturado ===
TEXT 15,425,"0",90,45,45,"Ambicom"
TEXT 65,425,"0",90,15,15,"R. Wenceslau Marek, 10 - Aguas Belas,"
TEXT 80,425,"0",90,15,15,"Sao Jose dos Pinhais - PR, 83010-520"
TEXT 100,425,"0",90,25,25,"SAC: 041 - 3382-5410"

TEXT 15,170,"0",90,15,15,"PRODUTO"
TEXT 30,170,"0",90,15,15,"REMANUFATURADO"
TEXT 45,170,"0",90,15,15,"GARANTIA"
TEXT 60,170,"0",90,15,15,"AMBICOM"

' === CAIXAS E LINHAS (^GB convertidos) ===

' Caixa externa: ^FO10,120^GB420,500,2
BOX 120,10,620,430,2

' Linhas horizontais (^GB largura,0,espessura → BAR vertical em TSPL)
' ^FO10,180^GB420,0,2
BAR 180,10,2,420

' ^FO10,280^GB420,0,2
BAR 280,10,2,420

' ^FO10,350^GB420,0,2
BAR 350,10,2,420

' ^FO10,420^GB420,0,2
BAR 420,10,2,420

' ^FO10,490^GB420,0,2
BAR 490,10,2,420

' ^FO10,550^GB420,0,2
BAR 550,10,2,420

' Linhas verticais (^GB0,altura,espessura → BAR horizontal em TSPL)
' ^FO215,120^GB0,60,2
BAR 120,225,60,2

' ^FO260,280^GB0,70,2
BAR 280,180,70,2

' ^FO150,350^GB0,140,2
BAR 350,290,140,2

' ^FO290,350^GB0,270,2
BAR 350,150,270,2

' ^FO150,550^GB0,70,2
BAR 550,290,70,2

' === MODELO / VOLTAGEM ===
TEXT 125,430,"0",90,15,15,"MODELO"
TEXT 145,430,"0",90,30,30,"${val(data.model || data.modelo)}"

TEXT 125,225,"0",90,15,15,"VOLTAGEM"
TEXT 145,225,"0",90,30,30,"${val(data.voltage || data.tensao)}"

' === QR CODE + NUMERO DE SERIE ===
QRCODE 182,420,H,4,A,90,"${val(data.internal_serial)}"

TEXT 185,430,"0",90,15,15,"NUMERO DE SERIE AMBICOM:"
TEXT 205,430,"0",90,35,35,"${val(data.internal_serial)}"
TEXT 245,430,"0",90,25,25,"${val(data.commercial_code || data.codigo_comercial)}"

' === PNC/ML / FREQUENCIA ===
TEXT 285,430,"0",90,15,15,"PNC/ML"
TEXT 305,430,"0",90,40,40,"${val(data.pnc_ml)}"

TEXT 285,180,"0",90,15,15,"FREQUENCIA"
TEXT 305,180,"0",90,35,35,"${val(data.frequency || data.frequencia || '60 Hz')}"

' === GAS FRIGOR. / CARGA GAS / COMPRESSOR ===
TEXT 355,430,"0",90,15,15,"GAS FRIGOR."
TEXT 375,430,"0",90,25,25,"${val(data.refrigerant_gas || data.gas_refrigerante)}"

TEXT 355,290,"0",90,15,15,"CARGA GAS"
TEXT 375,290,"0",90,25,25,"${val(data.gas_charge || data.carga_gas)}"

TEXT 355,150,"0",90,15,15,"COMPRESSOR"
TEXT 375,150,"0",90,25,25,"${val(data.compressor)}"

' === VOL. FREEZER / VOL. REFRIG. / VOLUME TOTAL ===
TEXT 425,430,"0",90,15,15,"VOL. FREEZER"
TEXT 445,430,"0",90,25,25,"${val(data.volume_freezer)}"

TEXT 425,290,"0",90,15,15,"VOL. REFRIG."
TEXT 445,290,"0",90,25,25,"${val(data.volume_refrigerator)}"

TEXT 425,150,"0",90,15,15,"VOLUME TOTAL"
TEXT 445,150,"0",90,25,25,"${formatTotalVolume(data.volume_freezer, data.volume_refrigerator, data.volume_total)}"

' === P. ALTA / P. BAIXA / CAPAC. CONG. ===
TEXT 495,430,"0",90,15,15,"P. DE ALTA / P. DE BAIXA"
TEXT 515,430,"0",90,20,20,"${val(data.pressure_high_low || data.pressao_alta_baixa)}"

TEXT 495,150,"0",90,15,15,"CAPAC. CONG."
TEXT 515,150,"0",90,25,25,"${val(data.freezing_capacity || data.capacidade_congelamento)}"

' === CORRENTE / POT. DEGELO / TAMANHO ===
TEXT 555,430,"0",90,15,15,"CORRENTE"
TEXT 575,430,"0",90,25,25,"${val(data.electric_current || data.corrente_eletrica)}"

TEXT 555,290,"0",90,15,15,"POT. DEGELO"
TEXT 575,290,"0",90,25,25,"${val(data.defrost_power || data.potencia_degelo)}"

TEXT 555,150,"0",90,15,15,"TAMANHO"
TEXT 575,150,"0",90,30,30,"${data.size || data.tamanho ? String(data.size || data.tamanho).charAt(0).toUpperCase() : '-'}"

PRINT 1
`;
};

