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
 * TSPLBuilder - Motor de design dinâmico orientado a PAISAGEM (Landscape).
 */
class TSPLBuilder {
    private commands: string[] = [];
    private width: number;
    private height: number;

    constructor(widthMm: number, heightMm: number) {
        this.width = widthMm * 8;
        this.height = heightMm * 8;

        this.commands.push(`SIZE ${widthMm} mm, ${heightMm} mm`);
        this.commands.push(`GAP 3 mm, 0`);
        this.commands.push(`DIRECTION 0,0`); // 0 para começar do topo físico
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

    // --- CABEÇALHO (Agora deitado no topo de 80mm) ---
    builder.addText(20, 20, "3", 0, 1, 1, "Ambicom");
    builder.addText(180, 25, "1", 0, 1, 1, "PRODUTO REMANUFATURADO - GARANTIA AMBICOM");
    builder.addText(20, 55, "2", 0, 1, 1, "R. Wenceslau Marek, 10 - Aguas Belas, SJP - PR | SAC: 041 3382-5410");

    // --- GRADE TÉCNICA (X horizontal até 640 dots) ---
    // Moldura: inicia em Y=90
    builder.addBox(20, 90, 620, 420, 2);

    // Divisórias Horizontais (Dentro da tabela)
    builder.addBar(20, 160, 600, 2); // Abaixo de Modelo/Voltagem
    builder.addBar(20, 260, 600, 2); // Abaixo de Serial
    builder.addBar(20, 310, 600, 2); // Abaixo de PNC/Freq
    builder.addBar(20, 360, 600, 2); // Abaixo de Gás/Compressor

    // Divisórias Verticais
    builder.addBar(320, 90, 2, 70);   // Entre Modelo e Voltagem
    builder.addBar(450, 160, 2, 100);  // Espaço para QR Code à direita do Serial
    builder.addBar(210, 260, 2, 50);   // Divisor PNC / Freq / Tamanho (part 1)
    builder.addBar(420, 260, 2, 50);   // Divisor PNC / Freq / Tamanho (part 2)

    // --- CONTEÚDO TÉCNICO ---

    // Modelo / Voltagem
    builder.addText(30, 105, "2", 0, 1, 1, "MODELO");
    builder.addText(30, 130, "3", 0, 1, 1, val(data.model || data.modelo));
    builder.addText(335, 105, "2", 0, 1, 1, "VOLTAGEM");
    builder.addText(335, 130, "3", 0, 1, 1, val(data.voltage || data.tensao));

    // Serial (Centralizado com QR Code ao lado)
    builder.addText(30, 175, "2", 0, 1, 1, "NUMERO DE SERIE AMBICOM:");
    builder.addText(30, 210, "4", 0, 1, 1, val(data.internal_serial));
    builder.addText(30, 240, "2", 0, 1, 1, val(data.commercial_code || data.codigo_comercial));

    // QR Code na lateral direita do serial
    builder.addQRCode(470, 165, "L", 4, 0, val(data.internal_serial));

    // PNC / FREQUENCIA / TAMANHO
    builder.addText(30, 275, "1", 0, 1, 1, "PNC/ML");
    builder.addText(100, 275, "2", 0, 1, 1, val(data.pnc_ml));

    builder.addText(230, 275, "1", 0, 1, 1, "FREQ.");
    builder.addText(300, 275, "2", 0, 1, 1, "60 Hz");

    builder.addText(440, 275, "2", 0, 1, 1, "TAMANHO:");
    builder.addText(560, 275, "3", 0, 1, 1, val(data.size || '-'));

    // GÁS / CARGA / COMPRESSOR
    builder.addText(30, 325, "1", 0, 1, 1, "GAS:");
    builder.addText(70, 325, "2", 0, 1, 1, val(data.refrigerant_gas));
    builder.addText(210, 325, "1", 0, 1, 1, "CARGA:");
    builder.addText(280, 325, "2", 0, 1, 1, val(data.gas_charge));
    builder.addText(420, 325, "1", 0, 1, 1, "COMP.:");
    builder.addText(490, 325, "2", 0, 1, 1, val(data.compressor));

    // RODAPÉ (Volumes e Corrente)
    builder.addText(30, 375, "1", 0, 1, 1, "VOLUMES:");
    builder.addText(110, 375, "2", 0, 1, 1, `${val(data.volume_freezer)}F / ${val(data.volume_refrigerator)}R`);

    builder.addText(320, 375, "1", 0, 1, 1, "POT/CORR:");
    builder.addText(420, 375, "1", 0, 1, 1, `${val(data.defrost_power)}W / ${val(data.electric_current)}A`);

    builder.addText(30, 395, "1", 0, 1, 1, "CAP. CONGELAMENTO:");
    builder.addText(190, 395, "2", 0, 1, 1, val(data.freezing_capacity));

    return builder.generate();
};
