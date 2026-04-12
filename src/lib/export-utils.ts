import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';

// ─── Relatórios Comuns ────────────────────────────────────────────────────────
export const exportToPDF = (title: string, headers: string[], data: (string | number | boolean | null)[][], fileName: string) => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text(title, 14, 22);
    doc.setFontSize(11); doc.setTextColor(100);
    const date = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em: ${date}`, 14, 30);
    autoTable(doc, {
        head: [headers], body: data, startY: 35, theme: 'grid',
        headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] }, margin: { top: 35 },
    });
    doc.save(`${fileName}_${new Date().getTime()}.pdf`);
};

export const exportToExcel = (data: Record<string, unknown>[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
    XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
};

// ─── TSPL Generator — Elgin L42 Pro (SINTAXE RIGOROSA 80x55) ──────────────────
export function generateLabelsTSPL(products: any[]): string {
    const sv = (v: any) => String(v ?? '').trim().replace(/"/g, "'").replace(/\r?\n/g, ' ') || '-';
    const MM = 8;
    const X0 = 16, X1 = 424, Y0 = 16;
    const Y_MAX = 624; // 80mm - margem

    // Re-distribuição das alturas para ocupar os 624 dots úteis
    const HEADER_H = 110; 
    const ROW_MODELO_H = 65;
    const ROW_QR_H = 145;
    const ROW_PNC_H = 65;
    const ROW_DATA_H = 59; // Altura para as 4 linhas restantes (59 * 4 = 236)
    // Total: 110+65+145+65+236 = 621 dots (quase os 624 disponíveis)

    const Y_HEADER_END = Y0 + HEADER_H;
    const Y_ROW1_END = Y_HEADER_END + ROW_MODELO_H;
    const Y_ROW2_END = Y_ROW1_END + ROW_QR_H;
    const Y_ROW3_END = Y_ROW2_END + ROW_PNC_H;

    const CENTER_DIV = 220;
    const COL1_DIV = 150, COL2_DIV = 294;

    const lines: string[] = [];
    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        lines.push('SIZE 55 mm,80 mm', 'GAP 0 mm,0 mm', 'DIRECTION 1', 'CLS', 'CODEPAGE UTF-8');

        // HEADER com quebras de linha
        lines.push(`TEXT ${X0 + 5},${Y0 + 20},"4",0,1,1,"Ambicom"`);
        // Texto à direita com quebra manual (usando múltiplas linhas TEXT)
        lines.push(`TEXT ${X1 - 5},${Y0 + 5},"1",0,1,1,2,"PRODUTO"`);
        lines.push(`TEXT ${X1 - 5},${Y0 + 25},"1",0,1,1,2,"REMANUFATURADO"`);
        lines.push(`TEXT ${X1 - 5},${Y0 + 45},"1",0,1,1,2,"GARANTIA"`);
        lines.push(`TEXT ${X1 - 5},${Y0 + 65},"1",0,1,1,2,"AMBICOM"`);
        
        lines.push(`TEXT ${X0 + 5},${Y0 + 75},"3",0,1,1,"SAC: 041-3382-5410"`);
        lines.push(`LINE ${X0},${Y_HEADER_END},${X1},${Y_HEADER_END},3`);

        // ROW 1: MODELO
        lines.push(`LINE ${CENTER_DIV},${Y_HEADER_END},${CENTER_DIV},${Y_ROW1_END},2`);
        lines.push(`TEXT ${118},${Y_HEADER_END + 10},"1",0,1,1,2,"MODELO"`);
        lines.push(`TEXT ${118},${Y_HEADER_END + 35},"3",0,1,1,2,"${sv(p.model || p.modelo)}"`);
        lines.push(`TEXT ${322},${Y_HEADER_END + 10},"1",0,1,1,2,"VOLTAGEM"`);
        lines.push(`TEXT ${322},${Y_HEADER_END + 35},"3",0,1,1,2,"${sv(p.voltage || p.tensao)}"`);
        lines.push(`LINE ${X0},${Y_ROW1_END},${X1},${Y_ROW1_END},2`);

        // ROW 2: QR
        const serial = sv(p.internal_serial);
        if (serial !== '-') lines.push(`QRCODE ${X0 + 15},${Y_ROW1_END + 15},L,8,A,0,"${serial}"`);
        lines.push(`TEXT ${X0 + 160},${Y_ROW1_END + 30},"2",0,1,1,"SERIAL AMBICOM:"`);
        lines.push(`TEXT ${X0 + 160},${Y_ROW1_END + 70},"5",0,1,1,"${serial}"`);
        lines.push(`LINE ${X0},${Y_ROW2_END},${X1},${Y_ROW2_END},2`);

        // ROW 3: PNC
        lines.push(`LINE ${CENTER_DIV},${Y_ROW2_END},${CENTER_DIV},${Y_ROW3_END},2`);
        lines.push(`TEXT ${118},${Y_ROW2_END + 10},"1",0,1,1,2,"PNC/ML"`);
        lines.push(`TEXT ${118},${Y_ROW2_END + 35},"3",0,1,1,2,"${sv(p.pnc_ml)}"`);
        lines.push(`TEXT ${322},${Y_ROW2_END + 25},"3",0,1,1,2,"${sv(p.frequency) || "60 Hz"}"`);
        lines.push(`LINE ${X0},${Y_ROW3_END},${X1},${Y_ROW3_END},2`);

        // ROWS 4-7: Dados Técnicos (Distribuídos)
        let curY = Y_ROW3_END;
        const rows = [
            { l: ["GÁS FRIG.", "CARGA GÁS", "COMPR."], v: [p.refrigerant_gas, p.gas_charge, p.compressor] },
            { l: ["VOL. FRZ", "VOL. REF.", "VOL. TOT."], v: [p.volume_freezer, p.volume_refrigerator, p.volume_total] },
            { l: ["P. ALTA", "P. BAIXA", "CAP. CONG."], v: [String(p.pressure_high_low).split('/')[0], String(p.pressure_high_low).split('/')[1], p.freezing_capacity] },
            { l: ["CORRENTE", "POT. DEG.", "TAM."], v: [p.electric_current, p.defrost_power, p.size] }
        ];

        rows.forEach(r => {
            const nextY = curY + ROW_DATA_H;
            lines.push(`LINE ${COL1_DIV},${curY},${COL1_DIV},${nextY},2`,`LINE ${COL2_DIV},${curY},${COL2_DIV},${nextY},2`);
            const centers = [83, 222, 359];
            r.l.forEach((lbl, i) => {
                lines.push(`TEXT ${centers[i]},${curY + 8},"1",0,1,1,2,"${lbl}"`);
                lines.push(`TEXT ${centers[i]},${curY + 32},"2",0,1,1,2,"${sv(r.v[i])}"`);
            });
            lines.push(`LINE ${X0},${nextY},${X1},${nextY},2`);
            curY = nextY;
        });

        lines.push(`LINE ${X0},${Y_HEADER_END},${X0},Y_MAX,3`,`LINE ${X1},${Y_HEADER_END},${X1},Y_MAX,3`);
        lines.push('PRINT 1,1');
    }
    return lines.join('\r\n');
}

// ─── PDF (Layout Retrato 55x80 baseado no Layout Antigo) ─────────────────────────────────
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [55, 80] });

    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        if (idx > 0) doc.addPage([55, 80], 'p');
        const val = (v: any) => String(v ?? '').trim() || '-';

        const X0 = 2, X1 = 53, Y0 = 2;
        const CENTER_X = 27.5;

        // Distribuição vertical (em mm)
        const H_HEADER = 15;
        const H_MODELO = 8;
        const H_QR = 18;
        const H_PNC = 8;
        const H_ROW = 7.5; // Altura para as linhas técnicas

        let currentY = Y0;

        // --- HEADER ---
        doc.setFont("helvetica", "bold").setFontSize(16).text("Ambicom", X0 + 1, currentY + 7);
        
        doc.setFontSize(5);
        // Texto solicitado com quebras de linha à direita
        doc.text("PRODUTO", X1 - 1, currentY + 3, { align: 'right' });
        doc.text("REMANUFATURADO", X1 - 1, currentY + 5.5, { align: 'right' });
        doc.text("GARANTIA", X1 - 1, currentY + 8, { align: 'right' });
        doc.text("AMBICOM", X1 - 1, currentY + 10.5, { align: 'right' });

        doc.setFontSize(9).text("SAC: 041-3382-5410", X0 + 1, currentY + 13);
        currentY += H_HEADER;
        doc.setLineWidth(0.4).line(X0, currentY, X1, currentY);

        // --- ROW 1: MODELO ---
        doc.setLineWidth(0.2).line(CENTER_X, currentY, CENTER_X, currentY + H_MODELO);
        doc.setFontSize(4).text("MODELO", (X0 + CENTER_X) / 2, currentY + 2.5, { align: 'center' });
        doc.setFontSize(10).text(val(p.model || p.modelo), (X0 + CENTER_X) / 2, currentY + 6.5, { align: 'center' });
        doc.setFontSize(4).text("VOLTAGEM", (X1 + CENTER_X) / 2, currentY + 2.5, { align: 'center' });
        doc.setFontSize(10).text(val(p.voltage || p.tensao), (X1 + CENTER_X) / 2, currentY + 6.5, { align: 'center' });
        currentY += H_MODELO;
        doc.line(X0, currentY, X1, currentY);

        // --- ROW 2: QR & SERIAL ---
        const serial = val(p.internal_serial);
        if (serial !== '-') {
            const qrImg = await QRCode.toDataURL(serial, { margin: 0 });
            doc.addImage(qrImg, 'PNG', X0 + 2, currentY + 1.5, 15, 15);
        }
        doc.setFontSize(5).text("SERIAL AMBICOM:", X0 + 20, currentY + 5);
        doc.setFontSize(12).text(serial, X0 + 20, currentY + 11);
        currentY += H_QR;
        doc.line(X0, currentY, X1, currentY);

        // --- ROW 3: PNC ---
        doc.line(CENTER_X, currentY, CENTER_X, currentY + H_PNC);
        doc.setFontSize(4).text("PNC/ML", (X0 + CENTER_X) / 2, currentY + 2.5, { align: 'center' });
        doc.setFontSize(9).text(val(p.pnc_ml), (X0 + CENTER_X) / 2, currentY + 6.5, { align: 'center' });
        doc.setFontSize(9).text(val(p.frequency) || "60 Hz", (X1 + CENTER_X) / 2, currentY + 5.5, { align: 'center' });
        currentY += H_PNC;
        doc.line(X0, currentY, X1, currentY);

        // --- ROWS TÉCNICAS (4-7) ---
        const rows = [
            { l: ["GÁS FRIG.", "CARGA GÁS", "COMPR."], v: [p.refrigerant_gas, p.gas_charge, p.compressor] },
            { l: ["VOL. FRZ", "VOL. REF.", "VOL. TOT."], v: [p.volume_freezer, p.volume_refrigerator, p.volume_total] },
            { l: ["P. ALTA", "P. BAIXA", "CAP. CONG."], v: [String(p.pressure_high_low).split('/')[0], String(p.pressure_high_low).split('/')[1], p.freezing_capacity] },
            { l: ["CORRENTE", "POT. DEG.", "TAM."], v: [p.electric_current, p.defrost_power, p.size] }
        ];

        const COL1_X = X0 + (X1 - X0) * 0.33, COL2_X = X0 + (X1 - X0) * 0.66;
        rows.forEach(r => {
            doc.line(COL1_X, currentY, COL1_X, currentY + H_ROW);
            doc.line(COL2_X, currentY, COL2_X, currentY + H_ROW);
            const centers = [(X0 + COL1_X) / 2, (COL1_X + COL2_X) / 2, (COL2_X + X1) / 2];
            r.l.forEach((lbl, i) => {
                doc.setFontSize(3.5).text(lbl, centers[i], currentY + 2.5, { align: 'center' });
                doc.setFontSize(7).text(val(r.v[i]), centers[i], currentY + 6, { align: 'center' });
            });
            currentY += H_ROW;
            doc.line(X0, currentY, X1, currentY);
        });

        // Moldura lateral final
        doc.line(X0, Y0 + H_HEADER, X0, currentY);
        doc.line(X1, Y0 + H_HEADER, X1, currentY);
    }
    return doc;
};

export const pdfToBase64 = (doc: jsPDF): string => doc.output('datauristring').split(',')[1];
export const printLabels = async (products: any[]) => { 
    console.log("Chamando printLabels com produtos:", products);
    try {
        const doc = await generateLabelsPDF(products); 
        console.log("Doc PDF gerado, chamando doc.save()...");
        const fileName = `etiquetas_ambicom_${Date.now()}.pdf`;
        
        // Obter blob e url
        const blob = doc.output('blob');
        const url = window.URL.createObjectURL(blob);

        try {
            doc.save(fileName);
            console.log("doc.save() executado.");
        } catch (err) {
            console.error("Erro no doc.save():", err);
        }
        
        // Método alternativo garantido via Blob e tag <a>
        try {
            console.log("Tentando download via Blob e tag <a>...");
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                if (document.body.contains(a)) document.body.removeChild(a);
            }, 1000);
            console.log("Download via tag <a> disparado com sucesso.");
        } catch (err) {
            console.error("Erro no método alternativo via Blob:", err);
        }

        // Revoga URL depois de 1 minuto para dar tempo em dispositivos mais lentos
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
        }, 60000);
        
    } catch (err) {
        console.error("Erro interno no printLabels:", err);
        throw err;
    }
};

export const printLabelsNative = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    
    // Configura o PDF para abrir a janela de impressão automaticamente ao ser visualizado
    doc.autoPrint();
    
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    
    // Cria um iframe oculto para impressão direta do documento PDF
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    
    iframe.onload = () => {
        try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        } catch (e) {
            console.error('Erro na impressão nativa do PDF:', e);
        }
    };
    
    document.body.appendChild(iframe);
    
    // Limpeza após tempo seguro
    setTimeout(() => {
        if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
        }
        URL.revokeObjectURL(url);
    }, 60_000);
};
