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
        orientation: 'l', // Paisagem para melhor aproveitamento da bobina
        putOnlyUsedFonts: true,
        compress: true
    });

    for (let index = 0; index < products.length; index++) {
        const p = products[index];
        if (index > 0) doc.addPage([labelWidth, labelHeight], 'l');

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
 * Gera o código ZPL para uma etiqueta industrial (55x80mm)
 */
export const generateLabelZPL = (data: any): string => {
    // Helper para evitar undefined
    const val = (v: any) => v || "";

    return `^XA
^CI28
^FWR            # Gira todo o conteúdo 90 graus (Paisagem)
^PW440          # Largura física da etiqueta (55mm)
^LL640          # Comprimento físico da etiqueta (80mm)
^LH0,0          # Define a origem no canto

# --- CABEÇALHO ---
^FO380,15^A0R,45,45^FDAmbicom^FS
^FO360,15^A0R,15,15^FDR. Wenceslau Marek, 10 - Aguas Belas,^FS
^FO345,15^A0R,15,15^FDSao Jose dos Pinhais - PR, 83010-520^FS
^FO320,15^A0R,25,25^FDSAC: 041 - 3382-5410^FS

^FO380,450^A0R,15,15^FB160,1,0,C^FDPRODUTO^FS
^FO365,450^A0R,15,15^FB160,1,0,C^FDREMANUFATURADO^FS
^FO350,450^A0R,15,15^FB160,1,0,C^FDGARANTIA^FS
^FO335,450^A0R,15,15^FB160,1,0,C^FDAMBICOM^FS

# --- LINHAS DA GRADE (Invertidas para Rotação) ---
^FO20,10^GB300,620,2^FS        # Borda externa
^FO260,10^GB0,620,2^FS         # Linha abaixo do Modelo
^FO160,10^GB0,620,2^FS         # Linha abaixo do Serial
^FO90,10^GB0,620,2^FS          # Linha abaixo do PNC
^FO20,10^GB300,0,2^FS          # Linha lateral esquerda
^FO20,630^GB300,0,2^FS         # Linha lateral direita
^FO260,320^GB60,0,2^FS         # Divisória Modelo/Voltagem

# --- CONTEÚDO ---
# MODELO / VOLTAGEM
^FO295,10^A0R,15,15^FB205,1,0,C^FDMODELO^FS
^FO270,10^A0R,30,30^FB205,1,0,C^FD${val(data.model || data.modelo)}^FS
^FO295,320^A0R,15,15^FB215,1,0,C^FDVOLTAGEM^FS
^FO270,320^A0R,30,30^FB215,1,0,C^FD${val(data.voltage || data.tensao)}^FS

# QR CODE E SERIAL
^FO180,20^BQR,2,4^FDQA,${val(data.internal_serial)}^FS
^FO240,150^A0R,15,15^FB330,1,0,C^FDNUMERO DE SERIE AMBICOM:^FS
^FO210,150^A0R,35,35^FB330,1,0,C^FD${val(data.internal_serial)}^FS
^FO170,150^A0R,25,25^FB330,1,0,C^FD${val(data.commercial_code || data.codigo_comercial)}^FS

# PNC / FREQUENCIA
^FO130,10^A0R,15,15^FB250,1,0,C^FDPNC/ML^FS
^FO100,10^A0R,40,40^FB250,1,0,C^FD${val(data.pnc_ml)}^FS
^FO130,350^A0R,15,15^FB170,1,0,C^FDFREQUENCIA^FS
^FO100,350^A0R,35,35^FB170,1,0,C^FD${val(data.frequency || data.frequencia || '60 Hz')}^FS

# DADOS TÉCNICOS (GAS / COMPRESSOR)
^FO65,10^A0R,15,15^FB140,1,0,C^FDGAS FRIGOR.^FS
^FO40,10^A0R,25,25^FB140,1,0,C^FD${val(data.refrigerant_gas || data.gas_refrigerante)}^FS
^FO65,450^A0R,15,15^FB140,1,0,C^FDCOMPRESSOR^FS
^FO40,450^A0R,25,25^FB140,1,0,C^FD${val(data.compressor)}^FS

^XZ`;
};

