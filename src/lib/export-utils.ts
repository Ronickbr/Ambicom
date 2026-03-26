import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';
import { calculateProductSize } from './product-utils';

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

export const printLabels = async (products: any[]) => {
    // Label dimensions: 100mm wide x 135mm tall approx for high fidelity
    const labelWidth = 100;
    const labelHeight = 135;
    const doc = new jsPDF({
        unit: 'mm',
        format: [labelWidth, labelHeight]
    });

    for (let index = 0; index < products.length; index++) {
        const p = products[index];
        if (index > 0) doc.addPage([labelWidth, labelHeight]);

        // Helper to get value or empty string
        const val = (v: any) => v || "";

        // --- Header Section ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("Ambicom", 8, 12);

        // Subtitle (Right aligned block)
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        const subtitleX = 68;
        doc.text("PRODUTO", subtitleX + 5, 10);
        doc.text("REMANUFATURADO", subtitleX, 13);
        doc.text("GARANTIA", subtitleX + 4, 16);
        doc.text("AMBICOM", subtitleX + 4.5, 19);

        // Address & SAC
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text("R. Wenceslau Marek, 10 - Águas Belas,", 8, 17);
        doc.text("São José dos Pinhais - PR, 83010-520", 8, 20);

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`SAC : 041 - 3382-5410`, 8, 26);

        // --- Grid Section ---
        let currentY = 28;
        doc.setLineWidth(0.4);

        // Row 1: MODELO | VOLTAGEM
        doc.line(8, currentY, 92, currentY); // Horizontal Top
        doc.line(45, currentY, 45, currentY + 12); // Vertical Divider

        doc.setFontSize(6.5);
        doc.text("MODELO", 22, currentY + 4, { align: 'center' });
        doc.setFontSize(18);
        doc.text(val(p.model), 22, currentY + 10, { align: 'center' });

        doc.setFontSize(6.5);
        doc.text("VOLTAGEM", 68.5, currentY + 4, { align: 'center' });
        doc.setFontSize(18);
        doc.text(val(p.voltage), 68.5, currentY + 10, { align: 'center' });

        currentY += 12;
        doc.line(8, currentY, 92, currentY); // Divider

        // Row 2: NÚMERO DE SÉRIE AMBICOM (With QR code on the left)
        const qrData = val(p.internal_serial).trim();
        if (qrData) {
            try {
                const qrImgData = await QRCode.toDataURL(qrData, {
                    margin: 0,
                    width: 100,
                    color: {
                        dark: "#000000",
                        light: "#ffffff"
                    }
                });
                // QR code position: left of the serial number field
                doc.addImage(qrImgData, 'PNG', 10, currentY + 1, 15, 15);
            } catch (err) {
                // QR generation error handled silently
            }
        }

        doc.setFontSize(6);
        doc.text("NÚMERO DE SÉRIE AMBICOM:", 59, currentY + 3, { align: 'center' });
        doc.setFontSize(18);
        doc.text(val(p.internal_serial), 59, currentY + 9, { align: 'center' });
        doc.setFontSize(16);
        doc.text(val(p.commercial_code), 59, currentY + 15, { align: 'center' });

        currentY += 17;
        doc.line(8, currentY, 92, currentY); // Divider

        // Row 3: PNC/ML | Frequência
        doc.line(60, currentY, 60, currentY + 10); // Vertical
        doc.setFontSize(6.5);
        doc.text("PNC/ML", 34, currentY + 2.5, { align: 'center' });
        doc.setFontSize(18);
        doc.text(val(p.pnc_ml), 34, currentY + 8.5, { align: 'center' });

        doc.setFontSize(16);
        doc.text(val(p.frequency) || "60 Hz", 76, currentY + 7.5, { align: 'center' });

        currentY += 10;
        doc.line(8, currentY, 92, currentY); // Divider

        // Row 4: GÁS FRIGOR. | CARGA GÁS | COMPRESSOR
        doc.line(34, currentY, 34, currentY + 12);
        doc.line(60, currentY, 60, currentY + 12);

        doc.setFontSize(6.5);
        doc.text("GÁS FRIGOR.", 21, currentY + 2.5, { align: 'center' });
        doc.setFontSize(12);
        doc.text(val(p.refrigerant_gas), 21, currentY + 8, { align: 'center' });

        doc.setFontSize(6.5);
        doc.text("CARGA GÁS", 47, currentY + 2.5, { align: 'center' });
        doc.setFontSize(16);
        doc.text(val(p.gas_charge), 47, currentY + 8, { align: 'center' });

        doc.setFontSize(6.5);
        doc.text("COMPRESSOR", 76, currentY + 2.5, { align: 'center' });
        doc.setFontSize(10);
        doc.text(val(p.compressor), 76, currentY + 8, { align: 'center' });

        currentY += 12;
        doc.line(8, currentY, 92, currentY);

        // Row 5: VOL. FREEZER | VOL. REFRIG. | VOLUME TOTAL
        doc.line(34, currentY, 34, currentY + 12);
        doc.line(60, currentY, 60, currentY + 12);

        doc.setFontSize(6.5);
        doc.text("VOL. FREEZER", 21, currentY + 2.5, { align: 'center' });
        doc.setFontSize(12);
        doc.text(val(p.volume_freezer), 21, currentY + 8, { align: 'center' });

        doc.setFontSize(6.5);
        doc.text("VOL. REFRIG.", 47, currentY + 2.5, { align: 'center' });
        doc.setFontSize(12);
        doc.text(val(p.volume_refrigerator), 47, currentY + 8, { align: 'center' });

        doc.setFontSize(6.5);
        doc.text("VOLUME TOTAL", 76, currentY + 2.5, { align: 'center' });
        doc.setFontSize(12);
        doc.text(val(p.volume_total), 76, currentY + 8, { align: 'center' });

        currentY += 12;
        doc.line(8, currentY, 92, currentY);

        // Row 6: PRESSÃO ALTA / BAIXA | CAPAC. CONG.
        doc.line(60, currentY, 60, currentY + 12);

        doc.setFontSize(6.5);
        doc.text("P. DE ALTA / P. DE BAIXA", 34, currentY + 2.5, { align: 'center' });
        doc.setFontSize(8);
        doc.text(val(p.pressure_high_low), 34, currentY + 8, { align: 'center' });

        doc.setFontSize(6.5);
        doc.text("CAPAC. CONG.", 76, currentY + 2.5, { align: 'center' });
        doc.setFontSize(10);
        doc.text(val(p.freezing_capacity), 76, currentY + 8, { align: 'center' });

        currentY += 12;
        doc.line(8, currentY, 92, currentY);

        // Row 7: CORRENTE | POT. DEGELO | GRADE
        doc.line(34, currentY, 34, currentY + 12);
        doc.line(60, currentY, 60, currentY + 12);

        doc.setFontSize(6.5);
        doc.text("CORRENTE", 21, currentY + 2.5, { align: 'center' });
        doc.setFontSize(12);
        doc.text(val(p.electric_current), 21, currentY + 8, { align: 'center' });

        doc.setFontSize(6.5);
        doc.text("POT. DEGELO", 47, currentY + 2.5, { align: 'center' });
        doc.setFontSize(12);
        doc.text(val(p.defrost_power), 47, currentY + 8, { align: 'center' });

        doc.setFontSize(6.5);
        doc.text("TAMANHO", 76, currentY + 2.5, { align: 'center' });
        doc.setFontSize(14);

        // Map size to initial
        const fullSize = p.size || await calculateProductSize(p.volume_total);
        const displaySize = fullSize === 'Pequeno' ? 'P' : fullSize === 'Médio' ? 'M' : fullSize === 'Grande' ? 'G' : "";

        doc.text(displaySize, 76, currentY + 9, { align: 'center' });

        currentY += 12;

        // Vertical Border edges
        doc.line(8, 28, 8, currentY);
        doc.line(92, 28, 92, currentY);
        doc.line(8, currentY, 92, currentY); // Bottom border line

    }

    const timestamp = new Date().getTime();
    doc.save(`etiquetas_ambicom_${timestamp}.pdf`);
};
