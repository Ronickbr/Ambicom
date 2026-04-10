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
 * TSPL Designer - Mapeador de Coordenadas para Rotação Técnica Industrial.
 * Desenha em 55x80 (Retrato) e converte para 80x55 (Físico) via 90°.
 */
class TSPLPortraitDesigner {
    private commands: string[] = [];
    // Dimensões virtuais (O que o usuário quer ver)
    private vW = 440; // 55mm
    private vH = 640; // 80mm

    constructor() {
        this.commands.push(`SIZE 80 mm, 55 mm`);
        this.commands.push(`GAP 3 mm, 0`);
        this.commands.push(`DIRECTION 0,0`);
        this.commands.push(`REFERENCE 0,0`);
        this.commands.push(`CLS`);
    }

    // Tradutor de Coordenadas: (vx, vy) -> (px, py)
    // vx: 0 a 440 | vy: 0 a 640
    private map(vx: number, vy: number): { x: number, y: number } {
        return {
            x: Math.round(vy),
            y: Math.round(this.vW - vx)
        };
    }

    addText(vx: number, vy: number, font: string, xmul: number, ymul: number, content: string) {
        const p = this.map(vx, vy);
        // Usamos rotação fixa de 90 para converter retrato em plano de impressão
        this.commands.push(`TEXT ${p.x},${p.y},"${font}",90,${xmul},${ymul},"${content}"`);
    }

    addBar(vx: number, vy: number, vw: number, vh: number) {
        const p = this.map(vx, vy);
        // Invertemos largura e altura da barra na rotação
        this.commands.push(`BAR ${p.x},${p.y},${vh},${vw}`);
    }

    addBox(vx1: number, vy1: number, vx2: number, vy2: number, t: number) {
        const p1 = this.map(vx1, vy1);
        const p2 = this.map(vx2, vy2);
        this.commands.push(`BOX ${p1.x},${p1.y},${p2.x},${p2.y},${t}`);
    }

    addQRCode(vx: number, vy: number, content: string) {
        const p = this.map(vx, vy);
        this.commands.push(`QRCODE ${p.x},${p.y},L,4,A,90,"${content}"`);
    }

    generate(): string {
        this.commands.push("PRINT 1\n");
        return this.commands.join("\n");
    }
}

export const generateLabelTSPL = (data: any): string => {
    const clean = (v: any) => {
        if (!v) return "-";
        // Remove unidades duplicadas se já existirem no dado
        return String(v).replace(/[VLgWAsig()]/g, "").trim();
    };

    const d = new TSPLPortraitDesigner();

    // --- 1. CABEÇALHO (TOPO DA ETIQUETA VERTICAL) ---
    d.addText(15, 20, "3", 1, 1, "Ambicom");
    d.addText(45, 20, "1", 1, 1, "PRODUTO REMANUFATURADO");
    d.addText(60, 20, "1", 1, 1, "GARANTIA AMBICOM");
    d.addText(85, 20, "1", 1, 1, "R. Wenceslau Marek, 10 - Aguas Belas, SJP - PR");
    d.addText(105, 20, "2", 1, 1, "SAC: 041 3382-5410");

    // --- 2. GRADE TÉCNICA (Y=140 até 620) ---
    // Coluna 1: Modelo / PNC / Gás / Vol. Freezer / Pressão / Corrente
    d.addBar(130, 20, 400, 2); // Topo da grade

    // Linha Modelo / Voltagem
    d.addText(145, 25, "1", 1, 1, "MODELO");
    d.addText(170, 25, "3", 1, 1, clean(data.model || data.modelo));
    d.addText(145, 225, "1", 1, 1, "VOLTAGEM");
    d.addText(170, 225, "4", 1, 1, clean(data.voltage || data.tensao) + " V");
    d.addBar(195, 20, 400, 2);

    // Linha Serial / QR Code / PNC
    d.addQRCode(205, 340, clean(data.internal_serial));
    d.addText(210, 25, "1", 1, 1, "N. SERIE AMBICOM:");
    d.addText(230, 25, "4", 1, 1, clean(data.internal_serial));
    d.addText(265, 25, "1", 1, 1, "PNC/ML:");
    d.addText(285, 25, "3", 1, 1, clean(data.pnc_ml));
    d.addBar(310, 20, 400, 2);

    // Linha Gás / Carga / 60Hz
    d.addText(325, 25, "1", 1, 1, "GAS FRIG.");
    d.addText(345, 25, "3", 1, 1, clean(data.refrigerant_gas));
    d.addText(325, 160, "1", 1, 1, "CARGA");
    d.addText(345, 160, "3", 1, 1, clean(data.gas_charge) + " g");
    d.addText(325, 320, "4", 1, 1, "60 Hz");
    d.addBar(370, 20, 400, 2);

    // Linha Volumes
    d.addText(385, 25, "1", 1, 1, "VOL. FREEZER");
    d.addText(405, 25, "3", 1, 1, clean(data.volume_freezer) + " L");
    d.addText(385, 160, "1", 1, 1, "VOL. REFRIG");
    d.addText(405, 160, "3", 1, 1, clean(data.volume_refrigerator) + " L");
    d.addText(385, 310, "1", 1, 1, "VOL. TOTAL");
    d.addText(405, 310, "4", 1, 1, clean(data.volume_total) + " L");
    d.addBar(435, 20, 400, 2);

    // Linha Compressor / Pressão / Potência
    d.addText(450, 25, "1", 1, 1, "COMPRESSOR");
    d.addText(470, 25, "3", 1, 1, clean(data.compressor));
    d.addText(450, 220, "1", 1, 1, "PRESSÃO (H/L)");
    d.addText(470, 220, "2", 1, 1, clean(data.pressure_high_low));
    d.addBar(500, 20, 400, 2);

    // Rodapé: Corrente / Tamanho / Potência
    d.addText(515, 25, "1", 1, 1, "CORRENTE");
    d.addText(535, 25, "4", 1, 1, clean(data.electric_current) + " A");
    d.addText(515, 160, "1", 1, 1, "POT. DEGELO");
    d.addText(535, 160, "3", 1, 1, clean(data.defrost_power) + " W");
    d.addText(515, 310, "1", 1, 1, "TAMANHO");
    d.addText(535, 310, "5", 1, 1, clean(data.size || "G"));
    d.addBar(565, 20, 400, 2);

    return d.generate();
};
