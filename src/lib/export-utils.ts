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
    const Y_MAX = 624;

    // --- NOVAS ALTURAS AJUSTADAS ---
    const HEADER_H = 119;         // Aumentado +4mm (87 + 32)
    const ROW_STD = 43;           // Diminuído -2mm (59 - 16)
    const ROW2_H = 127;           // Inalterado (QR Code)
    // -------------------------------

    const Y_HEADER_END = Y0 + HEADER_H;
    const Y_ROW1_END = Y_HEADER_END + ROW_STD;
    const Y_ROW2_END = Y_ROW1_END + ROW2_H;
    
    // Centros e Divisões
    const CENTER_DIV = 220;
    const COL1_DIV = 150, COL2_DIV = 294;
    const CENTER_LEFT = 118, CENTER_RIGHT = 322;
    const CENTER_COL1 = 83, CENTER_COL2 = 222, CENTER_COL3 = 359;

    const lines: string[] = [];
    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        lines.push('SIZE 55 mm,80 mm', 'GAP 0 mm,0 mm', 'DIRECTION 1', 'CLS', 'CODEPAGE UTF-8');

        // HEADER (Amplo)
        lines.push(`TEXT ${X0 + 10},${Y0 + 35},"4",0,1,1,"Ambicom"`);
        lines.push(`TEXT ${X0 + 200},${Y0 + 15},"2",0,1,1,"PRODUTO REMANUFATURADO"`);
        lines.push(`TEXT ${X0 + 200},${Y0 + 40},"2",0,1,1,"GARANTIA AMBICOM"`);
        lines.push(`TEXT ${X0 + 10},${Y0 + 75},"1",0,1,1,"R. Wenceslau Marek, 10 - SJP/PR"`);
        lines.push(`TEXT ${X0 + 10},${Y0 + 95},"3",0,1,1,"SAC: 041-3382-5410"`);
        lines.push(`LINE ${X0},${Y_HEADER_END},${X1},${Y_HEADER_END},3`);

        // ROW 1
        lines.push(`LINE ${CENTER_DIV},${Y_HEADER_END},${CENTER_DIV},${Y_ROW1_END},2`);
        lines.push(`TEXT ${CENTER_LEFT},${Y_HEADER_END + 10},"1",0,1,1,"MODELO"`);
        lines.push(`TEXT ${CENTER_LEFT},${Y_HEADER_END + 28},"3",0,1,1,"${sv(p.model || p.modelo)}"`);
        lines.push(`TEXT ${CENTER_RIGHT},${Y_HEADER_END + 10},"1",0,1,1,"VOLTAGEM"`);
        lines.push(`TEXT ${CENTER_RIGHT},${Y_HEADER_END + 28},"3",0,1,1,"${sv(p.voltage || p.tensao)}"`);
        lines.push(`LINE ${X0},${Y_ROW1_END},${X1},${Y_ROW1_END},2`);

        // ROW 2 (QR)
        const serial = sv(p.internal_serial);
        if (serial !== '-') lines.push(`QRCODE ${X0 + 15},${Y_ROW1_END + 10},L,7,A,0,"${serial}"`);
        lines.push(`TEXT ${X0 + 160},${Y_ROW1_END + 35},"2",0,1,1,"SERIAL AMBICOM:"`);
        lines.push(`TEXT ${X0 + 160},${Y_ROW1_END + 70},"5",0,1,1,"${serial}"`);
        lines.push(`LINE ${X0},${Y_ROW2_END},${X1},${Y_ROW2_END},2`);

        // ROWS 3-7 (Compactas)
        let curY = Y_ROW2_END;
        const rows = [
            { l: ["PNC/ML", "FREQ.", ""], v: [p.pnc_ml, p.frequency || "60 Hz", ""], isPnc: true },
            { l: ["GÁS FRIG.", "CARGA GÁS", "COMPR."], v: [p.refrigerant_gas, p.gas_charge, p.compressor] },
            { l: ["VOL. FRZ", "VOL. REF.", "VOL. TOT."], v: [p.volume_freezer, p.volume_refrigerator, p.volume_total] },
            { l: ["P. ALTA", "P. BAIXA", "CAP. CONG."], v: [String(p.pressure_high_low).split('/')[0], String(p.pressure_high_low).split('/')[1], p.freezing_capacity] },
            { l: ["CORRENTE", "POT. DEG.", "TAM."], v: [p.electric_current, p.defrost_power, p.size] }
        ];

        rows.forEach(r => {
            const nextY = curY + ROW_STD;
            if(r.isPnc) {
                lines.push(`LINE ${CENTER_DIV},${curY},${CENTER_DIV},${nextY},2`);
                lines.push(`TEXT ${CENTER_LEFT},${curY+10},"1",0,1,1,"${r.l[0]}"`,`TEXT ${CENTER_LEFT},${curY+30},"3",0,1,1,"${sv(r.v[0])}"`);
                lines.push(`TEXT ${CENTER_RIGHT},${curY+20},"2",0,1,1,"${sv(r.v[1])}"`);
            } else {
                lines.push(`LINE ${COL1_DIV},${curY},${COL1_DIV},${nextY},2`,`LINE ${COL2_DIV},${curY},${COL2_DIV},${nextY},2`);
                lines.push(`TEXT ${CENTER_COL1},${curY+8},"1",0,1,1,"${r.l[0]}"`,`TEXT ${CENTER_COL1},${curY+28},"2",0,1,1,"${sv(r.v[0])}"`);
                lines.push(`TEXT ${CENTER_COL2},${curY+8},"1",0,1,1,"${r.l[1]}"`,`TEXT ${CENTER_COL2},${curY+28},"2",0,1,1,"${sv(r.v[1])}"`);
                lines.push(`TEXT ${CENTER_COL3},${curY+8},"1",0,1,1,"${r.l[2]}"`,`TEXT ${CENTER_COL3},${curY+28},"2",0,1,1,"${sv(r.v[2])}"`);
            }
            lines.push(`LINE ${X0},${nextY},${X1},${nextY},2`);
            curY = nextY;
        });

        lines.push(`LINE ${X0},${Y_HEADER_END},${X0},${Y_MAX},3`,`LINE ${X1},${Y_HEADER_END},${X1},${Y_MAX},3`);
        lines.push('PRINT 1,1');
    }
    return lines.join('\r\n');
}

// ─── PDF (Layout Retrato 55x80 baseado no Layout Antigo) ─────────────────────────────────
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [55, 80] });
    const dToM = (dots: number) => dots / 8;

    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        if (idx > 0) doc.addPage([55, 80], 'p');
        const val = (v: any) => String(v ?? '').trim() || '-';

        const X0 = 2, X1 = 53, Y0 = 2;
        const CENTER_X = 27.5;

        // --- ALTURAS ESPELHADAS ---
        const Y_HEADER_END = Y0 + dToM(119); 
        const ROW_H = dToM(43);           
        const Y_ROW1_END = Y_HEADER_END + ROW_H;
        const Y_ROW2_END = Y_ROW1_END + dToM(127);
        // --------------------------

        doc.setLineWidth(0.2);

        // HEADER
        doc.setFont("helvetica", "bold").setFontSize(14).text("Ambicom", X0 + 1, Y0 + 8);
        doc.setFontSize(5).text("PRODUTO REMANUFATURADO", X1 - 1, Y0 + 4, {align: 'right'});
        doc.text("GARANTIA AMBICOM", X1 - 1, Y0 + 7, {align: 'right'});
        doc.setFont("helvetica", "normal").setFontSize(4.5).text("R. Wenceslau Marek, 10 - SJP/PR", X0 + 1, Y0 + 12);
        doc.setFont("helvetica", "bold").setFontSize(8).text("SAC: 041-3382-5410", X0 + 1, Y_HEADER_END - 2);
        doc.line(X0, Y_HEADER_END, X1, Y_HEADER_END);

        // ROW 1
        doc.line(CENTER_X, Y_HEADER_END, CENTER_X, Y_ROW1_END);
        doc.setFontSize(3.5).text("MODELO", (X0+CENTER_X)/2, Y_HEADER_END+2.5, {align:'center'});
        doc.setFontSize(8).text(val(p.model || p.modelo), (X0+CENTER_X)/2, Y_HEADER_END+5, {align:'center'});
        doc.setFontSize(3.5).text("VOLTAGEM", (X1+CENTER_X)/2, Y_HEADER_END+2.5, {align:'center'});
        doc.setFontSize(8).text(val(p.voltage || p.tensao), (X1+CENTER_X)/2, Y_HEADER_END+5, {align:'center'});
        doc.line(X0, Y_ROW1_END, X1, Y_ROW1_END);

        // ROW 2 (QR)
        const serial = val(p.internal_serial);
        if (serial !== '-') {
            const qrImg = await QRCode.toDataURL(serial, { margin: 0 });
            doc.addImage(qrImg, 'PNG', X0 + 3, Y_ROW1_END + 1, 14, 14);
        }
        doc.setFontSize(4).text("SERIAL AMBICOM:", X0 + 20, Y_ROW1_END + 5);
        doc.setFontSize(11).text(serial, X0 + 20, Y_ROW1_END + 11);
        doc.line(X0, Y_ROW2_END, X1, Y_ROW2_END);

        // ROWS 3-7
        let curY = Y_ROW2_END;
        const rows = [
            { l: ["PNC/ML", "FREQ.", ""], v: [p.pnc_ml, p.frequency || "60 Hz", ""], isPnc: true },
            { l: ["GÁS FRIG.", "CARGA GÁS", "COMPR."], v: [p.refrigerant_gas, p.gas_charge, p.compressor] },
            { l: ["VOL. FRZ", "VOL. REF.", "VOL. TOT."], v: [p.volume_freezer, p.volume_refrigerator, p.volume_total] },
            { l: ["P. ALTA", "P. BAIXA", "CAP. CONG."], v: [String(p.pressure_high_low).split('/')[0], String(p.pressure_high_low).split('/')[1], p.freezing_capacity] },
            { l: ["CORRENTE", "POT. DEG.", "TAM."], v: [p.electric_current, p.defrost_power, p.size] }
        ];

        const COL1_X = X0 + (X1-X0)*0.33, COL2_X = X0 + (X1-X0)*0.66;
        rows.forEach(r => {
            const nextY = curY + ROW_H;
            if(r.isPnc) {
                doc.line(CENTER_X, curY, CENTER_X, nextY);
                doc.setFontSize(3.5).text(r.l[0], (X0+CENTER_X)/2, curY+2, {align:'center'});
                doc.setFontSize(7).text(val(r.v[0]), (X0+CENTER_X)/2, curY+4.5, {align:'center'});
                doc.setFontSize(7).text(val(r.v[1]), (CENTER_X+X1)/2, curY+3.5, {align:'center'});
            } else {
                doc.line(COL1_X, curY, COL1_X, nextY); doc.line(COL2_X, curY, COL2_X, nextY);
                const centers = [(X0+COL1_X)/2, (COL1_X+COL2_X)/2, (COL2_X+X1)/2];
                r.l.forEach((lbl, i) => {
                    doc.setFontSize(3).text(lbl, centers[i], curY+2.2, {align:'center'});
                    doc.setFontSize(5.5).text(val(r.v[i]), centers[i], curY+4.5, {align:'center'});
                });
            }
            doc.line(X0, nextY, X1, nextY);
            curY = nextY;
        });

        doc.line(X0, Y_HEADER_END, X0, curY); doc.line(X1, Y_HEADER_END, X1, curY);
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
