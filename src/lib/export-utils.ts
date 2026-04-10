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

export const generateLabelZPL = (data: any): string => {
    const v = (val: any) => {
        if (!val) return "-";
        return String(val).replace(/[VLgWAsig()]/g, "").trim();
    };

    const serial = v(data.internal_serial);
    const model = v(data.model || data.modelo);
    const voltage = v(data.voltage || data.tensao);
    const pnc = v(data.pnc_ml);
    const gas = v(data.refrigerant_gas);
    const charge = v(data.gas_charge);
    const compressor = v(data.compressor);
    const volFrz = v(data.volume_freezer);
    const volRef = v(data.volume_refrigerator);
    const volTot = v(data.volume_total);
    const press = v(data.pressure_high_low);
    const current = v(data.electric_current);
    const power = v(data.defrost_power);
    const size = v(data.size || 'G');

    // TEMPLATE ZPL PROFISSIONAL (v2.24.0)
    return `^XA
^FWT
^PW640
^LL440
^CI28

; --- INSTITUCIONAL (SIDELABEL) ---
^FO22,256^A0B,45,45^FDAmbicom^FS
^FO67,187^A0B,15,15^FDR. Wenceslau Marek, 10 - Aguas Belas,^FS
^FO85,196^A0B,15,15^FDSao Jose dos Pinhais - PR^FS
^FO102,216^A0B,25,25^FDSAC: 041 - 3382-5410^FS

; Bloco Garantia
^FO26,-3^A0B,15,15^FB160,1,0,C^FDPRODUTO^FS
^FO45,-3^A0B,15,15^FB160,1,0,C^FDREMANUFATURADO^FS
^FO63,-3^A0B,15,15^FB160,1,0,C^FDGARANTIA^FS
^FO80,-2^A0B,15,15^FB160,1,0,C^FDAMBICOM^FS

; --- GRADE TÉCNICA ---
^FO131,16^GB500,420,4^FS

; LINHA 1: MODELO E VOLTAGEM
^FO145,261^A0B,15,15^FDMODELO^FS
^FO170,261^A0B,30,30^FD${model}^FS
^FO147,-10^A0B,15,15^FDVOLTAGEM^FS
^FO170,-10^A0B,35,35^FD${voltage}V^FS

; LINHA 2: SERIE E PNC
^FO209,58^A0B,15,15^FDNUMERO DE SERIE AMBICOM:^FS
^FO235,58^A0B,45,45^FD${serial}^FS
^FO209,350^BQN,2,4^FDQA,${serial}^FS
^FO413,60^A0B,15,15^FDPNC/ML^FS
^FO435,60^A0B,25,25^FD${pnc}^FS

; LINHA 3: GAS E FREQUENCIA
^FO297,294^A0B,15,15^FDFREQUENCIA^FS
^FO330,294^A0B,30,30^FD60 Hz^FS
^FO416,311^A0B,15,15^FDGAS FRIGOR.^FS
^FO440,311^A0B,25,25^FD${gas}^FS
^FO361,315^A0B,15,15^FDCARGA GAS^FS
^FO385,315^A0B,25,25^FD${charge} g^FS

; LINHA 4: COMPRESSOR E VOLUMES
^FO294,157^A0B,15,15^FDCOMPRESSOR^FS
^FO320,157^A0B,25,25^FD${compressor}^FS
^FO472,191^A0B,15,15^FDVOL. FRZ^FS
^FO495,191^A0B,25,25^FD${volFrz} L^FS
^FO472,303^A0B,15,15^FDVOL. REF^FS
^FO495,303^A0B,25,25^FD${volRef} L^FS
^FO471,68^A0B,15,15^FDVOL. TOT^FS
^FO495,68^A0B,35,35^FD${volTot} L^FS

; LINHA 5: PARAMETROS FB 
^FO150,495^A0N,15,15^FDP. ALTA / P. BAIXA^FS
^FO170,495^A0N,20,20^FD${press}^FS

; RADAPÉ
^FO30,555^A0N,15,15^FDCORRENTE ^FS
^FO30,575^A0N,25,25^FD${current} A^FS
^FO180,555^A0N,15,15^FDPOT. DEGELO^FS
^FO180,575^A0N,25,25^FD${power} W^FS
^FO350,555^A0N,15,15^FDTAMANHO^FS
^FO350,575^A0N,40,40^FD${size}^FS

^XZ`;
};

// Alias para compatibilidade com o sistema de exportação
export const generateLabelTSPL = generateLabelZPL;


