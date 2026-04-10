import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';
import { calculateProductSize } from './product-utils';

// ─── Relatório A4 ─────────────────────────────────────────────────────────────
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
    // Label dimensions: 80mm wide x 55mm tall (Orientação Paisagem)
    const labelWidth = 80;
    const labelHeight = 55;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [labelWidth, labelHeight]
    });

    // Configura o PDF para informar ao visualizador/driver da impressora
    // que ele deve ajustar a escala e rotacionar automaticamente para caber na página
    doc.viewerPreferences({
        'PrintScaling': 'AppDefault'
    });

    // Margens e limites horizontais
    const X0 = 3;
    const X1 = 77;
    const CW = X1 - X0;

    // Alturas e linhas
    // Total disponível: 55mm - margem 3 = 52. Começamos grid em 14. 
    // Grid: 7 linhas. 52 - 14 = 38mm de grid.
    // L1: 4.5mm, L2: 10mm, L3..7: 4.5mm (Total: 4.5*6 + 10 = 37mm)
    const Y_START = 14;
    const r = [
        Y_START,               // 14.0
        Y_START + 4.5,         // 18.5
        Y_START + 14.5,        // 28.5 (QR Code com 10mm)
        Y_START + 19,          // 33.0
        Y_START + 23.5,        // 37.5
        Y_START + 28,          // 42.0
        Y_START + 32.5,        // 46.5
        Y_START + 37           // 51.0 (Margem fundo de 4mm)
    ];

    for (let index = 0; index < products.length; index++) {
        const p = products[index];
        if (index > 0) doc.addPage([labelWidth, labelHeight], 'landscape');

        const val = (v: any) => v || "";

        // --- Header Section --- 
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Ambicom", X0, 5.5);

        // Subtitle (Right aligned block) 
        doc.setFontSize(5);
        doc.setFont("helvetica", "bold");
        const subtitleX = 58;
        doc.text("PRODUTO", subtitleX + 3.5, 4.5);
        doc.text("REMANUFATURADO", subtitleX, 6.5);
        doc.text("GARANTIA", subtitleX + 3, 8.5);
        doc.text("AMBICOM", subtitleX + 3.5, 10.5);

        // Address & SAC 
        doc.setFont("helvetica", "normal");
        doc.setFontSize(4);
        doc.text("R. Wenceslau Marek, 10 - Águas Belas,", X0, 8.5);
        doc.text("São José dos Pinhais - PR, 83010-520", X0, 10.5);

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(`SAC : 041 - 3382-5410`, X0, 13);

        // --- Grid Section --- 
        doc.setLineWidth(0.3);

        // Row 1: MODELO | VOLTAGEM 
        const cMod = X0 + (CW * 0.5);
        doc.line(X0, r[0], X1, r[0]); // Horizontal Top 
        doc.line(cMod, r[0], cMod, r[1]); // Vertical Divider 

        doc.setFontSize(4.5);
        doc.text("MODELO", X0 + ((cMod - X0) / 2), r[0] + 1.5, { align: 'center' });
        doc.setFontSize(10);
        doc.text(val(p.model), X0 + ((cMod - X0) / 2), r[0] + 3.8, { align: 'center' });

        doc.setFontSize(4.5);
        doc.text("VOLTAGEM", cMod + ((X1 - cMod) / 2), r[0] + 1.5, { align: 'center' });
        doc.setFontSize(10);
        doc.text(val(p.voltage), cMod + ((X1 - cMod) / 2), r[0] + 3.8, { align: 'center' });

        doc.line(X0, r[1], X1, r[1]); // Divider 

        // Row 2: NÚMERO DE SÉRIE AMBICOM (With QR code on the left) 
        const qrData = val(p.internal_serial).trim();
        const qrW = 9.5;
        if (qrData) {
            try {
                const qrImgData = await QRCode.toDataURL(qrData, { margin: 0, width: 100, color: { dark: "#000000", light: "#ffffff" } });
                doc.addImage(qrImgData, 'PNG', X0 + 0.5, r[1] + 0.25, qrW, qrW);
            } catch (err) { }
        }
        const cSer = X0 + qrW + 1;
        doc.line(cSer, r[1], cSer, r[2]); // QR border

        doc.setFontSize(4.5);
        doc.text("NÚMERO DE SÉRIE AMBICOM:", cSer + ((X1 - cSer) / 2), r[1] + 2, { align: 'center' });
        doc.setFontSize(10);
        doc.text(val(p.internal_serial), cSer + ((X1 - cSer) / 2), r[1] + 5.5, { align: 'center' });
        doc.setFontSize(8);
        doc.text(val(p.commercial_code), cSer + ((X1 - cSer) / 2), r[1] + 8.5, { align: 'center' });

        doc.line(X0, r[2], X1, r[2]); // Divider 

        // Row 3: PNC/ML | Frequência 
        const cPnc = X0 + (CW * 0.65);
        doc.line(cPnc, r[2], cPnc, r[3]); // Vertical 

        doc.setFontSize(4.5);
        doc.text("PNC/ML", X0 + ((cPnc - X0) / 2), r[2] + 1.5, { align: 'center' });
        doc.setFontSize(10);
        doc.text(val(p.pnc_ml), X0 + ((cPnc - X0) / 2), r[2] + 3.8, { align: 'center' });

        doc.setFontSize(9);
        doc.text(val(p.frequency) || "60 Hz", cPnc + ((X1 - cPnc) / 2), r[2] + 3.2, { align: 'center' });

        doc.line(X0, r[3], X1, r[3]); // Divider 

        // Helpers for 3 columns
        const colW = CW / 3;
        const c1 = X0 + colW;
        const c2 = X0 + colW * 2;

        // Row 4: GÁS FRIGOR. | CARGA GÁS | COMPRESSOR 
        doc.line(c1, r[3], c1, r[4]);
        doc.line(c2, r[3], c2, r[4]);

        doc.setFontSize(4.5);
        doc.text("GÁS FRIGOR.", X0 + (colW / 2), r[3] + 1.5, { align: 'center' });
        doc.setFontSize(8);
        doc.text(val(p.refrigerant_gas), X0 + (colW / 2), r[3] + 3.8, { align: 'center' });

        doc.setFontSize(4.5);
        doc.text("CARGA GÁS", c1 + (colW / 2), r[3] + 1.5, { align: 'center' });
        doc.setFontSize(9);
        doc.text(val(p.gas_charge), c1 + (colW / 2), r[3] + 3.8, { align: 'center' });

        doc.setFontSize(4.5);
        doc.text("COMPRESSOR", c2 + (colW / 2), r[3] + 1.5, { align: 'center' });
        doc.setFontSize(6.5);
        doc.text(val(p.compressor), c2 + (colW / 2), r[3] + 3.8, { align: 'center' });

        doc.line(X0, r[4], X1, r[4]);

        // Row 5: VOL. FREEZER | VOL. REFRIG. | VOLUME TOTAL 
        doc.line(c1, r[4], c1, r[5]);
        doc.line(c2, r[4], c2, r[5]);

        doc.setFontSize(4.5);
        doc.text("VOL. FREEZER", X0 + (colW / 2), r[4] + 1.5, { align: 'center' });
        doc.setFontSize(8);
        doc.text(val(p.volume_freezer), X0 + (colW / 2), r[4] + 3.8, { align: 'center' });

        doc.setFontSize(4.5);
        doc.text("VOL. REFRIG.", c1 + (colW / 2), r[4] + 1.5, { align: 'center' });
        doc.setFontSize(8);
        doc.text(val(p.volume_refrigerator), c1 + (colW / 2), r[4] + 3.8, { align: 'center' });

        doc.setFontSize(4.5);
        doc.text("VOLUME TOTAL", c2 + (colW / 2), r[4] + 1.5, { align: 'center' });
        doc.setFontSize(8);
        doc.text(val(p.volume_total), c2 + (colW / 2), r[4] + 3.8, { align: 'center' });

        doc.line(X0, r[5], X1, r[5]);

        // Row 6: PRESSÃO ALTA | PRESSÃO BAIXA | CAPAC. CONG. 
        doc.line(c1, r[5], c1, r[6]);
        doc.line(c2, r[5], c2, r[6]);

        doc.setFontSize(4.5);
        doc.text("PRESSÃO ALTA", X0 + (colW / 2), r[5] + 1.5, { align: 'center' });
        doc.setFontSize(6.5);

        const pressures = (p.pressure_high_low || "").split('/');
        doc.text(val(pressures[0]), X0 + (colW / 2), r[5] + 3.8, { align: 'center' });

        doc.setFontSize(4.5);
        doc.text("PRESSÃO BAIXA", c1 + (colW / 2), r[5] + 1.5, { align: 'center' });
        doc.setFontSize(6.5);
        doc.text(val(pressures[1] || ""), c1 + (colW / 2), r[5] + 3.8, { align: 'center' });

        doc.setFontSize(4.5);
        doc.text("CAPAC. CONG.", c2 + (colW / 2), r[5] + 1.5, { align: 'center' });
        doc.setFontSize(7.5);
        doc.text(val(p.freezing_capacity), c2 + (colW / 2), r[5] + 3.8, { align: 'center' });

        doc.line(X0, r[6], X1, r[6]);

        // Row 7: CORRENTE | POT. DEGELO | GRADE 
        doc.line(c1, r[6], c1, r[7]);
        doc.line(c2, r[6], c2, r[7]);

        doc.setFontSize(4.5);
        doc.text("CORRENTE", X0 + (colW / 2), r[6] + 1.5, { align: 'center' });
        doc.setFontSize(8);
        doc.text(val(p.electric_current), X0 + (colW / 2), r[6] + 3.8, { align: 'center' });

        doc.setFontSize(4.5);
        doc.text("POT. DEGELO", c1 + (colW / 2), r[6] + 1.5, { align: 'center' });
        doc.setFontSize(8);
        doc.text(val(p.defrost_power), c1 + (colW / 2), r[6] + 3.8, { align: 'center' });

        doc.setFontSize(4.5);
        doc.text("TAMANHO", c2 + (colW / 2), r[6] + 1.5, { align: 'center' });
        doc.setFontSize(9.5);

        // Map size to initial 
        const fullSize = p.size || await calculateProductSize(p.volume_total);
        const displaySize = fullSize === 'Pequeno' ? 'P' : fullSize === 'Médio' ? 'M' : fullSize === 'Grande' ? 'G' : "";

        doc.text(displaySize, c2 + (colW / 2), r[6] + 4, { align: 'center' });

        // Vertical Border edges 
        doc.line(X0, r[0], X0, r[7]);
        doc.line(X1, r[0], X1, r[7]);
        doc.line(X0, r[7], X1, r[7]); // Bottom border line 

    }

    return doc;
};

export const pdfToBase64 = (doc: jsPDF): string =>
    doc.output('datauristring').split(',')[1];

export const printLabels = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    doc.save(`etiquetas_ambicom_${Date.now()}.pdf`);
};

export const printLabelsNative = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);

    // Força o diálogo de impressão nativo do PDF (útil para que o driver rotacione/ajuste)
    doc.autoPrint({ variant: 'non-conform' });

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) return;
    w.addEventListener('load', () => w.print(), { once: true });
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
