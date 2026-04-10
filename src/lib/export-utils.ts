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
 * TSPLBuilder - Motor de design calibrado para o layout técnico da Ambicom.
 */
class TSPLBuilder {
    private commands: string[] = [];

    constructor(widthMm: number, heightMm: number) {
        this.commands.push(`SIZE ${widthMm} mm, ${heightMm} mm`);
        this.commands.push(`GAP 3 mm, 0`);
        this.commands.push(`DIRECTION 1,0`); // Inversão para saída natural da Elgin
        this.commands.push(`REFERENCE 0,0`);
        this.commands.push(`CLS`);
    }

    addText(x: number, y: number, font: string, rot: number, xmul: number, ymul: number, content: string) {
        this.commands.push(`TEXT ${x},${y},"${font}",${rot},${xmul},${ymul},"${content}"`);
    }

    addBar(x: number, y: number, w: number, h: number) {
        this.commands.push(`BAR ${x},${y},${w},${h}`);
    }

    addBox(x1: number, y1: number, x2: number, y2: number, t: number) {
        this.commands.push(`BOX ${x1},${y1},${x2},${y2},${t}`);
    }

    addQRCode(x: number, y: number, level: string, cellW: number, rot: number, content: string) {
        this.commands.push(`QRCODE ${x},${y},${level},${cellW},A,${rot},"${content}"`);
    }

    generate(): string {
        this.commands.push("PRINT 1\n");
        return this.commands.join("\n");
    }
}

export const generateLabelTSPL = (data: any): string => {
    const val = (v: any) => v || "";
    const builder = new TSPLBuilder(80, 55);

    // --- 1. CABEÇALHO (LATERAL ESQUERDA NA IMAGEM) ---
    // Y=15 (Topo), X=625 (Extrema direita no modo Direction 1)
    builder.addText(615, 10, "4", 270, 1, 1, "Ambicom");
    builder.addText(585, 10, "1", 270, 1, 1, "R. Wenceslau Marek, 10 - Aguas Belas,");
    builder.addText(570, 10, "1", 270, 1, 1, "Sao Jose dos Pinhais - PR, 83010-520");
    builder.addText(540, 10, "3", 270, 1, 1, "SAC : 041 - 3382-5410");

    // Bloco Garantia (Canto superior direito da imagem)
    builder.addText(620, 280, "1", 270, 1, 1, "PRODUTO");
    builder.addText(605, 280, "1", 270, 1, 1, "REMANUFATURADO");
    builder.addText(590, 280, "1", 270, 1, 1, "GARANTIA");
    builder.addText(575, 280, "1", 270, 1, 1, "AMBICOM");

    // --- 2. GRADE DA TABELA (BOX INICIA EM X=520) ---
    builder.addBox(15, 10, 520, 430, 2);

    // Linhas Horizontais (Divisores de seções)
    builder.addBar(450, 10, 2, 420); // Abaixo de Modelo/Voltagem
    builder.addBar(350, 10, 2, 420); // Abaixo de Serial/PNC/60Hz
    builder.addBar(280, 10, 2, 420); // Abaixo de Gas/Compressor
    builder.addBar(210, 10, 2, 420); // Abaixo de Volumes
    builder.addBar(140, 10, 2, 420); // Abaixo de Pressão/Capacidade
    builder.addBar(70, 10, 2, 420);  // Abaixo de Corrente/Potência

    // Linhas Verticais (Divisores de colunas internos)
    builder.addBar(450, 150, 70, 2);   // Divisor Modelo / Voltagem
    builder.addBar(350, 120, 100, 2);  // Divisor QR Code / Serial
    builder.addBar(350, 290, 100, 2);  // Divisor Serial / PNC
    builder.addBar(210, 150, 70, 2);   // Divisor Gas / Carga
    builder.addBar(210, 290, 70, 2);   // Divisor Carga / 60Hz (ou labels)
    builder.addBar(140, 150, 70, 2);   // Divisor Vol. Freezer / Vol. Refrig
    builder.addBar(140, 290, 70, 2);   // Divisor Vol. Refrig / Vol. Total
    builder.addBar(70, 250, 70, 2);    // Divisor P. Alta / Cap. Cong
    builder.addBar(15, 220, 55, 2);    // Divisor Corrente / Potência

    // --- 3. CONTEÚDO DOS BOXES ---

    // ROW 1: MODELO | VOLTAGEM
    builder.addText(510, 15, "1", 270, 1, 1, "MODELO");
    builder.addText(490, 15, "4", 270, 1, 1, val(data.model || data.modelo));
    builder.addText(510, 160, "1", 270, 1, 1, "VOLTAGEM");
    builder.addText(485, 160, "5", 270, 1, 1, `${val(data.voltage || data.tensao)} V`);

    // ROW 2: QR CODE | SERIAL | PNC | 60Hz
    builder.addQRCode(445, 15, "L", 4, 270, val(data.internal_serial));
    builder.addText(445, 130, "0", 270, 1, 1, "NUMERO DE SERIE AMBICOM:");
    builder.addText(425, 130, "4", 270, 1, 1, val(data.internal_serial));
    builder.addText(385, 130, "3", 270, 1, 1, val(data.commercial_code || data.codigo_comercial));

    builder.addText(445, 300, "1", 270, 1, 1, "PNC/ML");
    builder.addText(400, 300, "5", 270, 1, 1, val(data.pnc_ml));

    builder.addText(445, 415, "5", 270, 1, 1, "60 Hz");

    // ROW 3: GAS | CARGA | COMPRESSOR
    builder.addText(340, 15, "1", 270, 1, 1, "GAS FRIGOR.");
    builder.addText(315, 15, "3", 270, 1, 1, val(data.refrigerant_gas));
    builder.addText(340, 160, "1", 270, 1, 1, "CARGA GAS");
    builder.addText(315, 160, "4", 270, 1, 1, `${val(data.gas_charge)} g`);
    builder.addText(340, 300, "1", 270, 1, 1, "COMPRESSOR");
    builder.addText(315, 300, "3", 270, 1, 1, val(data.compressor));

    // ROW 4: VOLUMES
    builder.addText(270, 15, "1", 270, 1, 1, "VOL. FREEZER");
    builder.addText(240, 15, "4", 270, 1, 1, `${val(data.volume_freezer)} L`);
    builder.addText(270, 160, "1", 270, 1, 1, "VOL. REFRIG.");
    builder.addText(240, 160, "4", 270, 1, 1, `${val(data.volume_refrigerator)} L`);
    builder.addText(270, 300, "1", 270, 1, 1, "VOLUME TOTAL");
    builder.addText(240, 300, "5", 270, 1, 1, `${val(data.volume_total)} L`);

    // ROW 5: PRESSÃO | CAPACIDADE
    builder.addText(200, 15, "1", 270, 1, 1, "P. DE ALTA / P. DE BAIXA");
    builder.addText(175, 15, "2", 270, 1, 1, `(${val(data.pressure_high_low)}) psig`);
    builder.addText(200, 260, "1", 270, 1, 1, "CAPAC. CONG.");
    builder.addText(175, 260, "4", 270, 1, 1, val(data.freezing_capacity));

    // ROW 6: CORRENTE | POTÊNCIA | TAMANHO
    builder.addText(130, 15, "1", 270, 1, 1, "CORRENTE");
    builder.addText(100, 15, "4", 270, 1, 1, `${val(data.electric_current)} A`);
    builder.addText(130, 230, "1", 270, 1, 1, "POT. DEGELO");
    builder.addText(100, 230, "4", 270, 1, 1, `${val(data.defrost_power)} W`);
    builder.addText(130, 340, "1", 270, 1, 1, "TAMANHO");
    builder.addText(90, 340, "5", 270, 1, 1, val(data.size || 'G'));

    return builder.generate();
};
