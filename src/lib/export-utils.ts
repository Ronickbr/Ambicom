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

    // Configurações da etiqueta: 55mm x 80mm
    const MM = 8; // dots/mm
    const LABEL_W = 55 * MM;      // 440 dots
    const LABEL_H = 80 * MM;      // 640 dots
    const MARGIN = 2 * MM;        // 16 dots (2mm)
    
    // Área útil: 408 x 608 dots
    const X0 = MARGIN;            // 16
    const X1 = LABEL_W - MARGIN;  // 424
    const Y0 = MARGIN;            // 16
    const Y_MAX = LABEL_H - MARGIN; // 624
    
    // Alturas ajustadas (-1 dot cada)
    const HEADER_H = 79;          // era 80
    const ROW1_H = 67;            // era 68
    const ROW2_H = 127;           // era 128
    const ROW_STD = 67;           // era 68 (para rows 3-7)
    
    // Posições Y calculadas (total = 608 dots exatos)
    const Y_HEADER_END = Y0 + HEADER_H;           // 16 + 79 = 95
    const Y_ROW1_END = Y_HEADER_END + ROW1_H;     // 95 + 67 = 162
    const Y_ROW2_END = Y_ROW1_END + ROW2_H;       // 162 + 127 = 289
    const Y_ROW3_END = Y_ROW2_END + ROW1_H;       // 289 + 67 = 356
    const Y_ROW4_END = Y_ROW3_END + ROW_STD;      // 356 + 67 = 423
    const Y_ROW5_END = Y_ROW4_END + ROW_STD;      // 423 + 67 = 490
    const Y_ROW6_END = Y_ROW5_END + ROW_STD;      // 490 + 67 = 557
    const Y_ROW7_END = Y_ROW6_END + ROW_STD;      // 557 + 67 = 624 = Y_MAX ✓
    
    // Divisórias verticais
    const CENTER_DIV = X0 + Math.round((X1 - X0) * 0.50);  // 220
    const COL1_DIV = X0 + Math.round((X1 - X0) * 0.33);    // 150
    const COL2_DIV = X0 + Math.round((X1 - X0) * 0.66);    // 294
    
    // Centros para alinhamento
    const CENTER_LEFT = Math.round((X0 + CENTER_DIV) / 2);     // 118
    const CENTER_RIGHT = Math.round((CENTER_DIV + X1) / 2);    // 322
    const CENTER_COL1 = Math.round((X0 + COL1_DIV) / 2);       // 83
    const CENTER_COL2 = Math.round((COL1_DIV + COL2_DIV) / 2); // 222
    const CENTER_COL3 = Math.round((COL2_DIV + X1) / 2);       // 359

    const lines: string[] = [];

    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        if (idx > 0) lines.push('');

        lines.push('SIZE 55 mm,80 mm');
        lines.push('GAP 0 mm,0 mm');
        lines.push('DIRECTION 1');
        lines.push('REFERENCE 0,0');
        lines.push('CLS');
        lines.push('CODEPAGE UTF-8');

        const val = (v: any) => String(v ?? '').trim() || '';
        
        // === HEADER (79 dots) ===
        lines.push(`TEXT ${X0 + 10},${Y0 + 35},"4",0,1,1,"Ambicom"`);
        
        const rightX = X0 + 200;
        lines.push(`TEXT ${rightX + 20},${Y0 + 15},"2",0,1,1,"PRODUTO"`);
        lines.push(`TEXT ${rightX},${Y0 + 35},"2",0,1,1,"REMANUFATURADO"`);
        lines.push(`TEXT ${rightX + 15},${Y0 + 55},"2",0,1,1,"GARANTIA"`);
        lines.push(`TEXT ${rightX + 20},${Y0 + 75},"2",0,1,1,"AMBICOM"`);
        
        lines.push(`TEXT ${X0 + 10},${Y0 + 55},"1",0,1,1,"R. Wenceslau Marek, 10 - Águas Belas,"`);
        lines.push(`TEXT ${X0 + 10},${Y0 + 72},"1",0,1,1,"São José dos Pinhais - PR, 83010-520"`);
        lines.push(`TEXT ${X0 + 10},${Y0 + 72},"3",0,1,1,"SAC: 041-3382-5410"`);

        lines.push(`LINE ${X0},${Y_HEADER_END},${X1},${Y_HEADER_END},3`);

        // === ROW 1: MODELO | VOLTAGEM (67 dots) ===
        let currentY = Y_HEADER_END;
        const row1End = Y_ROW1_END;
        
        lines.push(`LINE ${CENTER_DIV},${currentY},${CENTER_DIV},${row1End},2`);
        
        const model = sv(p.model || p.modelo);
        lines.push(`TEXT ${CENTER_LEFT},${currentY + 24},"2",0,1,1,"MODELO"`);
        lines.push(`TEXT ${CENTER_LEFT},${currentY + 54},"4",0,1,1,"${model}"`);
        
        const voltage = sv(p.voltage || p.tensao);
        lines.push(`TEXT ${CENTER_RIGHT},${currentY + 24},"2",0,1,1,"VOLTAGEM"`);
        lines.push(`TEXT ${CENTER_RIGHT},${currentY + 54},"4",0,1,1,"${voltage}"`);
        
        lines.push(`LINE ${X0},${row1End},${X1},${row1End},2`);
        currentY = row1End;

        // === ROW 2: NÚMERO DE SÉRIE (127 dots) ===
        const row2End = Y_ROW2_END;
        const serial = sv(p.internal_serial);
        
        // QR Code: cellwidth 8, margem ajustada para 127 dots
        if (serial && serial !== '-') {
            lines.push(`QRCODE ${X0 + 8},${currentY + 5},L,8,A,0,"${serial}"`);
        }
        
        const textX = X0 + 140;
        lines.push(`TEXT ${textX},${currentY + 34},"2",0,1,1,"NÚMERO DE SÉRIE AMBICOM:"`);
        lines.push(`TEXT ${textX},${currentY + 74},"5",0,1,1,"${serial}"`);
        const commercialCode = sv(p.commercial_code);
        lines.push(`TEXT ${textX},${currentY + 109},"3",0,1,1,"${commercialCode}"`);
        
        lines.push(`LINE ${X0},${row2End},${X1},${row2End},2`);
        currentY = row2End;

        // === ROW 3: PNC/ML | Frequência (67 dots) ===
        const row3End = Y_ROW3_END;
        
        lines.push(`LINE ${CENTER_DIV},${currentY},${CENTER_DIV},${row3End},2`);
        
        const pncMl = sv(p.pnc_ml);
        lines.push(`TEXT ${CENTER_LEFT},${currentY + 24},"2",0,1,1,"PNC/ML"`);
        lines.push(`TEXT ${CENTER_LEFT},${currentY + 54},"4",0,1,1,"${pncMl}"`);
        
        const frequency = sv(p.frequency) || "60 Hz";
        lines.push(`TEXT ${CENTER_RIGHT},${currentY + 44},"3",0,1,1,"${frequency}"`);
        
        lines.push(`LINE ${X0},${row3End},${X1},${row3End},2}`);
        currentY = row3End;

        // === ROWS 4-7: 3 colunas (67 dots cada) ===
        const rows3Col = [
            { labels: ["GÁS FRIGOR.", "CARGA GÁS", "COMPRESSOR"], 
              values: [sv(p.refrigerant_gas), sv(p.gas_charge), sv(p.compressor)],
              fonts: ["3", "3", "2"] },
            { labels: ["VOL. FREEZER", "VOL. REFRIG.", "VOLUME TOTAL"], 
              values: [sv(p.volume_freezer), sv(p.volume_refrigerator), sv(p.volume_total)],
              fonts: ["3", "3", "3"] },
            { labels: ["PRESSÃO ALTA", "PRESSÃO BAIXA", "CAPAC. CONG."], 
              values: [String(p.pressure_high_low || "").split('/')[0] || '-', 
                      String(p.pressure_high_low || "").split('/')[1] || '-', 
                      sv(p.freezing_capacity)],
              fonts: ["2", "2", "2"] },
            { labels: ["CORRENTE", "POT. DEGELO", "TAMANHO"], 
              values: [sv(p.electric_current), sv(p.defrost_power), 
                      (p.size === 'Pequeno' ? 'P' : p.size === 'Médio' ? 'M' : p.size === 'Grande' ? 'G' : p.size) || '-'],
              fonts: ["3", "3", "5"] }
        ];

        for (let i = 0; i < rows3Col.length; i++) {
            const row = rows3Col[i];
            const rowEnd = currentY + ROW_STD;
            
            lines.push(`LINE ${COL1_DIV},${currentY},${COL1_DIV},${rowEnd},2`);
            lines.push(`LINE ${COL2_DIV},${currentY},${COL2_DIV},${rowEnd},2`);
            lines.push(`LINE ${X0},${rowEnd},${X1},${rowEnd},2`);
            
            // Coluna 1
            lines.push(`TEXT ${CENTER_COL1},${currentY + 21},"2",0,1,1,"${row.labels[0]}"}`);
            lines.push(`TEXT ${CENTER_COL1},${currentY + 51},"${row.fonts[0]}",0,1,1,"${row.values[0]}"}`);
            
            // Coluna 2
            lines.push(`TEXT ${CENTER_COL2},${currentY + 21},"2",0,1,1,"${row.labels[1]}"}`);
            lines.push(`TEXT ${CENTER_COL2},${currentY + 51},"${row.fonts[1]}",0,1,1,"${row.values[1]}"}`);
            
            // Coluna 3
            lines.push(`TEXT ${CENTER_COL3},${currentY + 21},"2",0,1,1,"${row.labels[2]}"}`);
            lines.push(`TEXT ${CENTER_COL3},${currentY + 51},"${row.fonts[2]}",0,1,1,"${row.values[2]}"}`);
            
            currentY = rowEnd;
        }

        // Bordas verticais externas
        lines.push(`LINE ${X0},${Y_HEADER_END},${X0},${Y_MAX},3`);
        lines.push(`LINE ${X1},${Y_HEADER_END},${X1},${Y_MAX},3`);

        lines.push('PRINT 1,1');
    }
    
    return lines.join('\r\n');
}

// ─── PDF (Layout Retrato 55x80 baseado no Layout Antigo) ─────────────────────────────────
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    // Definindo a unidade como mm para facilitar a relação com a etiqueta física
    const doc = new jsPDF({ 
        orientation: 'p', 
        unit: 'mm', 
        format: [55, 80], 
        compress: true 
    });

    // Função auxiliar para converter dots (do TSPL) para MM (do PDF)
    // Se TSPL usa 8 dots/mm, dividimos por 8.
    const dToM = (dots: number) => dots / 8;

    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        if (idx > 0) doc.addPage([55, 80], 'p');

        const val = (v: any) => String(v ?? '').trim() || '-';

        // Constantes de Layout baseadas no seu TSPL (convertidas para mm)
        const MARGIN = 2; // 16 dots
        const X0 = MARGIN;
        const X1 = 55 - MARGIN;
        const Y0 = MARGIN;
        const CENTER_X = 55 / 2;
        const COL1_X = X0 + (X1 - X0) * 0.33;
        const COL2_X = X0 + (X1 - X0) * 0.66;

        // Alturas das seções (espelhando os dots do TSPL)
        const Y_HEADER_END = Y0 + dToM(79);   // 11.87mm
        const Y_ROW1_END = Y_HEADER_END + dToM(67);
        const Y_ROW2_END = Y_ROW1_END + dToM(127);
        const ROW_H = dToM(67); // Altura padrão das linhas 3 a 7

        doc.setLineWidth(0.2);

        // === HEADER ===
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Ambicom", X0 + 1, Y0 + 5);

        doc.setFontSize(5);
        const headerTextX = X0 + 25;
        doc.text("PRODUTO REMANUFATURADO", headerTextX, Y0 + 4);
        doc.text("GARANTIA AMBICOM", headerTextX, Y0 + 7);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(4);
        doc.text("R. Wenceslau Marek, 10 - Águas Belas, SJP - PR", X0 + 1, Y0 + 10);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text("SAC: 041-3382-5410", X0 + 1, Y_HEADER_END - 1);

        doc.line(X0, Y_HEADER_END, X1, Y_HEADER_END);

        // === ROW 1: MODELO | VOLTAGEM ===
        doc.line(CENTER_X, Y_HEADER_END, CENTER_X, Y_ROW1_END);
        
        doc.setFontSize(4);
        doc.text("MODELO", (X0 + CENTER_X) / 2, Y_HEADER_END + 3, { align: 'center' });
        doc.setFontSize(9);
        doc.text(val(p.model || p.modelo), (X0 + CENTER_X) / 2, Y_HEADER_END + 7, { align: 'center' });

        doc.setFontSize(4);
        doc.text("VOLTAGEM", (CENTER_X + X1) / 2, Y_HEADER_END + 3, { align: 'center' });
        doc.setFontSize(9);
        doc.text(val(p.voltage || p.tensao), (CENTER_X + X1) / 2, Y_HEADER_END + 7, { align: 'center' });

        doc.line(X0, Y_ROW1_END, X1, Y_ROW1_END);

        // === ROW 2: QR & SERIAL ===
        const serial = val(p.internal_serial);
        if (serial !== '-') {
            try {
                const qrImg = await QRCode.toDataURL(serial, { margin: 0 });
                doc.addImage(qrImg, 'PNG', X0 + 1, Y_ROW1_END + 1, 14, 14);
            } catch (e) {}
        }

        const textStartX = X0 + 17;
        doc.setFontSize(4);
        doc.text("NÚMERO DE SÉRIE AMBICOM:", textStartX, Y_ROW1_END + 4);
        doc.setFontSize(10);
        doc.text(serial, textStartX, Y_ROW1_END + 9);
        doc.setFontSize(7);
        doc.text(val(p.commercial_code), textStartX, Y_ROW1_END + 14);

        doc.line(X0, Y_ROW2_END, X1, Y_ROW2_END);

        // === ROW 3: PNC/ML | FREQUÊNCIA ===
        const Y_ROW3_END = Y_ROW2_END + ROW_H;
        doc.line(CENTER_X, Y_ROW2_END, CENTER_X, Y_ROW3_END);
        
        doc.setFontSize(4);
        doc.text("PNC/ML", (X0 + CENTER_X) / 2, Y_ROW2_END + 3, { align: 'center' });
        doc.setFontSize(9);
        doc.text(val(p.pnc_ml), (X0 + CENTER_X) / 2, Y_ROW2_END + 7, { align: 'center' });
        
        doc.setFontSize(8);
        doc.text(val(p.frequency) || "60 Hz", (CENTER_X + X1) / 2, Y_ROW2_END + 5.5, { align: 'center' });

        doc.line(X0, Y_ROW3_END, X1, Y_ROW3_END);

        // === ROWS 4-7: 3 COLUNAS ===
        const rowData = [
            { l: ["GÁS FRIGOR.", "CARGA GÁS", "COMPRESSOR"], v: [p.refrigerant_gas, p.gas_charge, p.compressor] },
            { l: ["VOL. FREEZER", "VOL. REFRIG.", "VOLUME TOTAL"], v: [p.volume_freezer, p.volume_refrigerator, p.volume_total] },
            { l: ["PRESSÃO ALTA", "PRESSÃO BAIXA", "CAPAC. CONG."], v: [String(p.pressure_high_low || "").split('/')[0], String(p.pressure_high_low || "").split('/')[1], p.freezing_capacity] },
            { l: ["CORRENTE", "POT. DEGELO", "TAMANHO"], v: [p.electric_current, p.defrost_power, p.size] }
        ];

        let currentY = Y_ROW3_END;
        rowData.forEach((row) => {
            const nextY = currentY + ROW_H;
            
            // Linhas Verticais
            doc.line(COL1_X, currentY, COL1_X, nextY);
            doc.line(COL2_X, currentY, COL2_X, nextY);
            
            // Labels e Valores
            const centers = [(X0 + COL1_X) / 2, (COL1_X + COL2_X) / 2, (COL2_X + X1) / 2];
            
            row.l.forEach((label, i) => {
                doc.setFontSize(3.5);
                doc.text(label, centers[i], currentY + 3, { align: 'center' });
                doc.setFontSize(i === 2 && row.l[2] === "TAMANHO" ? 10 : 6);
                
                let displayVal = val(row.v[i]);
                if(label === "TAMANHO") {
                    displayVal = displayVal === 'Pequeno' ? 'P' : displayVal === 'Médio' ? 'M' : displayVal === 'Grande' ? 'G' : displayVal;
                }
                doc.text(displayVal, centers[i], currentY + 7, { align: 'center' });
            });

            doc.line(X0, nextY, X1, nextY);
            currentY = nextY;
        });

        // Bordas Laterais
        doc.line(X0, Y_HEADER_END, X0, currentY);
        doc.line(X1, Y_HEADER_END, X1, currentY);
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
