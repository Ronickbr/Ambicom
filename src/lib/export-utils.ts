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
    
    // --- DISTRIBUIÇÃO PARA LIMITE DE 608 DOTS ---
    const HEADER_H = 125; 
    const ROW_QR_H = 140;
    const ROW_STD = 56; // Ajustado para fechar a conta em ~608-610 dots totais

    const Y_HEADER_END = Y0 + HEADER_H;
    const Y_ROW1_END = Y_HEADER_END + ROW_STD;
    const Y_ROW2_END = Y_ROW1_END + ROW_QR_H;
    const Y_ROW3_END = Y_ROW2_END + ROW_STD;

    const lines: string[] = [];
    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        lines.push('SIZE 55 mm,80 mm', 'GAP 0 mm,0 mm', 'DIRECTION 1', 'CLS', 'CODEPAGE UTF-8');

        // HEADER
        lines.push(`TEXT ${X0 + 5},${Y0 + 20},"4",0,1,1,"Ambicom"`);
        lines.push(`TEXT ${X1 - 5},${Y0 + 5},"1",0,1,1,2,"PRODUTO"`);
        lines.push(`TEXT ${X1 - 5},${Y0 + 22},"1",0,1,1,2,"REMANUFATURADO"`);
        lines.push(`TEXT ${X1 - 5},${Y0 + 39},"1",0,1,1,2,"GARANTIA"`);
        lines.push(`TEXT ${X1 - 5},${Y0 + 56},"1",0,1,1,2,"AMBICOM"`);
        lines.push(`TEXT ${X0 + 5},${Y0 + 72},"1",0,1,1,"R. Wenceslau Marek, 10 - Águas Belas, SJP - PR"`);
        lines.push(`TEXT ${X0 + 5},${Y0 + 95},"3",0,1,1,"SAC: 041-3382-5410"`);
        lines.push(`LINE ${X0},${Y_HEADER_END},${X1},${Y_HEADER_END},3`);

        // ROW 1: MODELO | VOLTAGEM
        lines.push(`LINE 220,${Y_HEADER_END},220,${Y_ROW1_END},2`);
        lines.push(`TEXT 118,${Y_HEADER_END+10},"1",0,1,1,2,"MODELO"`, `TEXT 118,${Y_HEADER_END+35},"3",0,1,1,2,"${sv(p.model || p.modelo)}"`);
        lines.push(`TEXT 322,${Y_HEADER_END+10},"1",0,1,1,2,"VOLTAGEM"`, `TEXT 322,${Y_HEADER_END+35},"3",0,1,1,2,"${sv(p.voltage || p.tensao)}"`);
        lines.push(`LINE ${X0},${Y_ROW1_END},${X1},${Y_ROW1_END},2`);

        // ROW 2: QR & SERIAL
        const serial = sv(p.internal_serial);
        const commCode = sv(p.commercial_code);
        if (serial !== '-') lines.push(`QRCODE ${X0 + 20},${Y_ROW1_END + 15},L,7,A,0,"${serial}"`);
        lines.push(`TEXT 280,${Y_ROW1_END + 25},"2",0,1,1,2,"NÚMERO DE SÉRIE AMBICOM:"`);
        lines.push(`TEXT 280,${Y_ROW1_END + 60},"5",0,1,1,2,"${serial}"`);
        // Inclusão do Commercial Code
        lines.push(`TEXT 280,${Y_ROW1_END + 105},"3",0,1,1,2,"${commCode}"`);   
        lines.push(`LINE ${X0},${Y_ROW2_END},${X1},${Y_ROW2_END},2`);

        // ROW 3: PNC
        lines.push(`LINE 220,${Y_ROW2_END},220,${Y_ROW3_END},2`);
        lines.push(`TEXT 118,${Y_ROW2_END+10},"1",0,1,1,2,"PNC/ML"`, `TEXT 118,${Y_ROW2_END+35},"3",0,1,1,2,"${sv(p.pnc_ml)}"`);
        lines.push(`TEXT 322,${Y_ROW2_END+25},"3",0,1,1,2,"${sv(p.frequency) || '60 Hz'}"`);
        lines.push(`LINE ${X0},${Y_ROW3_END},${X1},${Y_ROW3_END},2`);

        // ROWS 4-7: DADOS TÉCNICOS
        let curY = Y_ROW3_END;
        const rows = [
            { l: ["GÁS FRIG.", "CARGA GÁS", "COMPR."], v: [p.refrigerant_gas, p.gas_charge, p.compressor] },
            { l: ["VOL. FRZ", "VOL. REF.", "VOL. TOT."], v: [p.volume_freezer, p.volume_refrigerator, p.volume_total] },
            { l: ["P. ALTA", "P. BAIXA", "CAP. CONG."], v: [String(p.pressure_high_low).split('/')[0], String(p.pressure_high_low).split('/')[1], p.freezing_capacity] },
            { l: ["CORRENTE", "POT. DEG.", "TAM."], v: [p.electric_current, p.defrost_power, p.size] }
        ];

        rows.forEach(r => {
            lines.push(`LINE 150,${curY},150,${curY+ROW_STD},2`, `LINE 294,${curY},294,${curY+ROW_STD},2`);
            const c = [83, 222, 359];
            r.l.forEach((lbl, i) => {
                lines.push(`TEXT ${c[i]},${curY+8},"1",0,1,1,2,"${lbl}"`, `TEXT ${c[i]},${curY+30},"2",0,1,1,2,"${sv(r.v[i])}"`);
            });
            curY += ROW_STD;
            lines.push(`LINE ${X0},${curY},${X1},${curY},2`);
        });

        // Bordas verticais fechando no 608-610 dots aprox.
        lines.push(`LINE ${X0},${Y_HEADER_END},${X0},${curY},3`, `LINE ${X1},${Y_HEADER_END},${X1},${curY},3`);
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
        const X0 = 2, X1 = 53, Y0 = 2, CENTER_X = 27.5;

        // --- AJUSTE PARA TERMINAR EM 76mm (608 dots) ---
        const H_HEADER = 17; 
        const H_STD = 7.0; 
        const H_QR = 18;

        let curY = Y0;

        // --- HEADER ---
        doc.setFont("helvetica", "bold").setFontSize(16).text("Ambicom", X0 + 1, curY + 6);
        
        doc.setFontSize(5);
        doc.text("PRODUTO", X1 - 1, curY + 3, { align: 'right' });
        doc.text("REMANUFATURADO", X1 - 1, curY + 5.2, { align: 'right' });
        doc.text("GARANTIA", X1 - 1, curY + 7.4, { align: 'right' });
        doc.text("AMBICOM", X1 - 1, curY + 9.6, { align: 'right' });

        doc.setFont("helvetica", "normal").setFontSize(6).text("R. Wenceslau Marek, 10 - Águas Belas, SJP - PR", X0 + 1, curY + 11);
        doc.setFont("helvetica", "bold").setFontSize(8).text("SAC: 41-3382-5410", X0 + 1, curY + 15);
        
        curY += H_HEADER;
        doc.setLineWidth(0.4).line(X0, curY, X1, curY);

        // --- ROW 1: MODELO | VOLTAGEM ---
        doc.setLineWidth(0.2).line(CENTER_X, curY, CENTER_X, curY + H_STD);
        doc.setFontSize(5).text("MODELO", (X0 + CENTER_X) / 2, curY + 2.2, { align: 'center' });
        doc.setFontSize(9).text(val(p.model || p.modelo), (X0 + CENTER_X) / 2, curY + 5.8, { align: 'center' });
        doc.setFontSize(5).text("VOLTAGEM", (X1 + CENTER_X) / 2, curY + 2.2, { align: 'center' });
        doc.setFontSize(9).text(val(p.voltage || p.tensao), (X1 + CENTER_X) / 2, curY + 5.8, { align: 'center' });
        curY += H_STD;
        doc.line(X0, curY, X1, curY);

        // --- ROW 2: QR & SERIAL & COMMERCIAL ---
        const serial = val(p.internal_serial);
        const commCode = val(p.commercial_code);
        if (serial !== '-') {
            try {
                const qrImg = await QRCode.toDataURL(serial, { margin: 0 });
                doc.addImage(qrImg, 'PNG', X0 + 3, curY + 1.5, 15, 15);
            } catch (e) {}
        }
        const textStartX = X0 + 20;
        doc.setFontSize(5).text("NÚMERO DE SÉRIE AMBICOM:", textStartX, curY + 4);
        doc.setFontSize(11).text(serial, textStartX, curY + 9.5);
        doc.setFontSize(8).text(commCode, textStartX, curY + 14.5);
        curY += H_QR;
        doc.line(X0, curY, X1, curY);

        // --- LISTA DE LINHAS RESTANTES (PNC + TÉCNICAS) ---
        const rows = [
            { isPnc: true, l: ["PNC/ML", "FREQUÊNCIA"], v: [p.pnc_ml, p.frequency || "60 Hz"] },
            { l: ["GÁS FRIG.", "CARGA GÁS", "COMPR."], v: [p.refrigerant_gas, p.gas_charge, p.compressor] },
            { l: ["VOL. FRZ", "VOL. REF.", "VOL. TOT."], v: [p.volume_freezer, p.volume_refrigerator, p.volume_total] },
            { l: ["P. ALTA em kpa", "P. BAIXA em kpa", "CAP. CONG."], v: [String(p.pressure_high_low).split('/')[0], String(p.pressure_high_low).split('/')[1], p.freezing_capacity] },
            { l: ["CORRENTE", "POT. DEG.", "TAM."], v: [p.electric_current, p.defrost_power, p.size] }
        ];

        const COL1 = X0 + (X1 - X0) * 0.33, COL2 = X0 + (X1 - X0) * 0.66;
        
        rows.forEach(r => {
            if (r.isPnc) {
                // Row 3: PNC | FREQUÊNCIA
                doc.line(CENTER_X, curY, CENTER_X, curY + H_STD);
                doc.setFontSize(5).text(r.l[0], (X0 + CENTER_X) / 2, curY + 2.2, { align: 'center' });
                doc.setFontSize(8).text(val(r.v[0]), (X0 + CENTER_X) / 2, curY + 5.8, { align: 'center' });
                
                doc.setFontSize(5).text(r.l[1], (X1 + CENTER_X) / 2, curY + 2.2, { align: 'center' });
                doc.setFontSize(8).text(val(r.v[1]), (X1 + CENTER_X) / 2, curY + 5.8, { align: 'center' });
            } else {
                // Rows 4 a 7: Dados técnicos em 3 colunas
                doc.line(COL1, curY, COL1, curY + H_STD); 
                doc.line(COL2, curY, COL2, curY + H_STD);
                const centers = [(X0 + COL1) / 2, (COL1 + COL2) / 2, (COL2 + X1) / 2];
                r.l.forEach((lbl, i) => {
                    doc.setFontSize(5).text(lbl, centers[i], curY + 2.2, { align: 'center' });
                    doc.setFontSize(6.5).text(val(r.v[i]), centers[i], curY + 5.8, { align: 'center' });
                });
            }
            curY += H_STD;
            doc.line(X0, curY, X1, curY);
        });

        // Bordas laterais para fechar o desenho da tabela
        doc.line(X0, Y0 + H_HEADER, X0, curY); 
        doc.line(X1, Y0 + H_HEADER, X1, curY);
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
        
        try {
            doc.save(fileName);
            console.log("doc.save() executado com sucesso.");
        } catch (err) {
            console.error("Erro no doc.save():", err);
            
            // Método alternativo via Blob caso doc.save falhe
            try {
                console.log("Tentando fallback via Blob e tag <a>...");
                const blob = doc.output('blob');
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    if (document.body.contains(a)) document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 1000);
            } catch (fallbackErr) {
                console.error("Erro no fallback de download:", fallbackErr);
            }
        }
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
