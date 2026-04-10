import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';

// ─── Relatório A4 ─────────────────────────────────────────────────────────────
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

// ─── TSPL Generator — Elgin L42 Pro (LANDSCAPE 80x55) ─────────────────────────
export function generateLabelsTSPL(products: any[]): string {
    const sv = (v: any) => String(v ?? '').trim().replace(/"/g, "'").replace(/\r?\n/g, ' ') || '-';

    const clean = (val: string, unit: string) => {
        if (val === '-') return '-';
        const cleanVal = val.replace(new RegExp(`\\s*${unit}$`, 'i'), '').trim();
        return `${cleanVal} ${unit}`;
    };

    // Dimensões: 80mm largura (640 dots) x 55mm altura (440 dots)
    const X0 = 24;  // Margem esquerda
    const X1 = 616; // Margem direita (80mm - 3mm)
    const GW = X1 - X0;

    // Linhas horizontais (Y) — Total 440 dots
    const GY = 90; // Topo da grade
    const r = [
        GY,
        GY + 50,  // r[1] Modelo
        GY + 100, // r[2] Serial/QR
        GY + 150, // r[3] PNC
        GY + 200, // r[4] Gas
        GY + 250, // r[5] Vol
        GY + 300, // r[6] Pressão
        GY + 340, // r[7] Base
    ];

    const colW = Math.floor(GW / 3);
    const c1 = X0 + colW;
    const c2 = X0 + colW * 2;

    const lines: string[] = [
        'SIZE 80 mm,55 mm', // FORMATO CORRETO DA BOBINA
        'GAP 3 mm,0 mm',
        'DIRECTION 1',
        'OFFSET 0 mm',
        'SPEED 4',
        'DENSITY 10',
        'CODEPAGE UTF-8',
        'SET TEAR OFF',
        '',
    ];

    for (const p of products) {
        const model = sv(p.model ?? p.modelo);
        const voltage = clean(sv(p.voltage ?? p.tensao), 'V');
        const serial = sv(p.internal_serial);
        const pncMl = sv(p.pnc_ml);
        const gas = sv(p.refrigerant_gas);
        const gasChg = clean(sv(p.gas_charge), 'g');
        const comp = sv(p.compressor);
        const volFrz = clean(sv(p.volume_freezer), 'L');
        const volRef = clean(sv(p.volume_refrigerator), 'L');
        const volTot = clean(sv(p.volume_total), 'L');
        const current = clean(sv(p.electric_current), 'A');
        const defrost = clean(sv(p.defrost_power), 'W');
        const dispSize = (p.size === 'Pequeno' ? 'P' : p.size === 'Médio' ? 'M' : p.size === 'Grande' ? 'G' : p.size) || '-';

        lines.push('CLS');

        // Cabeçalho horizontal (aproveitando os 80mm)
        lines.push(`TEXT ${X0},10,"4",0,1,1,"AMBICOM"`);
        lines.push(`TEXT ${X0},50,"1",0,1,1,"R. Wenceslau Marek, 10 - SJP/PR"`);
        lines.push(`TEXT ${X0},62,"2",0,1,1,"SAC: 041-3382-5410"`);

        // Bloco Remanufaturado à direita
        lines.push(`BOX 400,8,${X1},80,2`);
        const stampCX = 508;
        ['PRODUTO', 'REMANUFATURADO', 'GARANTIA', 'AMBICOM'].forEach((t, i) => {
            const tx = stampCX - Math.floor((t.length * 8) / 2);
            lines.push(`TEXT ${tx},${14 + i * 16},"1",0,1,1,"${t}"`);
        });

        // Grade Técnica
        lines.push(`BOX ${X0},${GY},${X1},435,2`);

        // L1: MODELO | VOLTAGEM | FREQ
        lines.push(`LINE ${X0},${r[1]},${X1},${r[1]},2`);
        lines.push(`LINE ${c1},${GY},${c1},${r[1]},2`);
        lines.push(`LINE ${c2},${GY},${c2},${r[1]},2`);
        lines.push(`TEXT ${X0 + 4},${GY + 4},"1",0,1,1,"MODELO"`);
        lines.push(`TEXT ${X0 + 4},${GY + 18},"3",0,1,1,"${model}"`);
        lines.push(`TEXT ${c1 + 4},${GY + 4},"1",0,1,1,"VOLTAGEM"`);
        lines.push(`TEXT ${c1 + 4},${GY + 18},"3",0,1,1,"${voltage}"`);
        lines.push(`TEXT ${c2 + 4},${GY + 4},"1",0,1,1,"FREQ."`);
        lines.push(`TEXT ${c2 + 4},${GY + 18},"3",0,1,1,"60 Hz"`);

        // L2: QR | SERIAL
        lines.push(`LINE ${X0},${r[2]},${X1},${r[2]},2`);
        if (serial !== '-') lines.push(`QRCODE ${X0 + 10},${r[1] + 4},L,4,A,0,"${serial}"`);
        lines.push(`TEXT ${X0 + 120},${r[1] + 6},"1",0,1,1,"NR. SERIE AMBICOM:"`);
        lines.push(`TEXT ${X0 + 120},${r[1] + 22},"3",0,1,1,"${serial}"`);

        // L3: PNC | COMPRESSOR
        lines.push(`LINE ${X0},${r[3]},${X1},${r[3]},2`);
        lines.push(`LINE ${c2},${r[2]},${c2},${r[3]},2`);
        lines.push(`TEXT ${X0 + 4},${r[2] + 4},"1",0,1,1,"PNC/ML"`);
        lines.push(`TEXT ${X0 + 4},${r[2] + 18},"3",0,1,1,"${pncMl}"`);
        lines.push(`TEXT ${c2 + 4},${r[2] + 4},"1",0,1,1,"COMPRESSOR"`);
        lines.push(`TEXT ${c2 + 4},${r[2] + 18},"2",0,1,1,"${comp}"`);

        // L4: GAS | CARGA
        lines.push(`LINE ${X0},${r[4]},${X1},${r[4]},2`);
        lines.push(`LINE ${c1},${r[3]},${c1},${r[4]},2`);
        lines.push(`TEXT ${X0 + 4},${r[3] + 4},"1",0,1,1,"GAS FRIGOR."`);
        lines.push(`TEXT ${X0 + 4},${r[3] + 18},"3",0,1,1,"${gas}"`);
        lines.push(`TEXT ${c1 + 4},${r[3] + 4},"1",0,1,1,"CARGA"`);
        lines.push(`TEXT ${c1 + 4},${r[3] + 18},"3",0,1,1,"${gasChg}"`);

        // L5: VOLUMES
        lines.push(`LINE ${X0},${r[5]},${X1},${r[5]},2`);
        lines.push(`LINE ${c1},${r[4]},${c1},${r[5]},2`);
        lines.push(`LINE ${c2},${r[4]},${c2},${r[5]},2`);
        lines.push(`TEXT ${X0 + 4},${r[4] + 4},"1",0,1,1,"FREEZER"`);
        lines.push(`TEXT ${X0 + 4},${r[4] + 18},"2",0,1,1,"${volFrz}"`);
        lines.push(`TEXT ${c1 + 4},${r[4] + 4},"1",0,1,1,"REFRIG."`);
        lines.push(`TEXT ${c1 + 4},${r[4] + 18},"2",0,1,1,"${volRef}"`);
        lines.push(`TEXT ${c2 + 4},${r[4] + 4},"1",0,1,1,"TOTAL"`);
        lines.push(`TEXT ${c2 + 4},${r[4] + 18},"2",0,1,1,"${volTot}"`);

        // L6: CORRENTE | POTENCIA | TAMANHO
        lines.push(`LINE ${c1},${r[5]},${c1},435,2`);
        lines.push(`LINE ${c2},${r[5]},${c2},435,2`);
        lines.push(`TEXT ${X0 + 4},${r[5] + 4},"1",0,1,1,"CORRENTE"`);
        lines.push(`TEXT ${X0 + 4},${r[5] + 18},"3",0,1,1,"${current}"`);
        lines.push(`TEXT ${c1 + 4},${r[5] + 4},"1",0,1,1,"POTENCIA"`);
        lines.push(`TEXT ${c1 + 4},${r[5] + 18},"3",0,1,1,"${defrost}"`);
        lines.push(`TEXT ${c2 + 4},${r[5] + 4},"1",0,1,1,"TAMANHO"`);
        lines.push(`TEXT ${c2 + 60},${r[5] + 60},"5",0,1,1,"${dispSize}"`);

        lines.push('PRINT 1,1');
    }
    return lines.join('\r\n');
}

// ─── PDF (LANDSCAPE 80x55) ────────────────────────────────────────────────────
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: [80, 55], compress: true });

    const cleanStr = (val: string, unit: string) => {
        const s = String(val ?? '').trim();
        if (s === '-' || !s) return '-';
        const cleanVal = s.replace(new RegExp(`\\s*${unit}$`, 'i'), '').trim();
        return `${cleanVal} ${unit}`;
    };

    const X0 = 3, X1 = 77, CW = X1 - X0;
    const GY = 12; // Topo da grade no PDF
    const r = [GY, GY + 6, GY + 13, GY + 20, GY + 27, GY + 34, GY + 41];

    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        if (idx > 0) doc.addPage([80, 55], 'l');
        const val = (v: any) => String(v ?? '').trim() || '-';

        // Cabeçalho PDF
        doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("AMBICOM", X0, 6);
        doc.setFontSize(5); doc.setFont("helvetica", "normal");
        doc.text("R. Wenceslau Marek, 10 - SJP/PR", X0, 9);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7);
        doc.text("SAC: 041-3382-5410", X0, 11.5);

        // Bloco Stamp Garantia
        doc.rect(55, 2, 22, 9);
        doc.setFontSize(4); doc.setFont("helvetica", "normal");
        ["PRODUTO", "REMANUFATURADO", "GARANTIA", "AMBICOM"].forEach((t, i) =>
            doc.text(t, 66, 3.8 + i * 1.8, { align: 'center' })
        );

        doc.setLineWidth(0.2);
        const colW = CW / 3;
        const c1 = X0 + colW, c2 = X0 + colW * 2;

        const hL = (y: number) => doc.line(X0, y, X1, y);
        const vL = (x: number, y0: number, y1: number) => doc.line(x, y0, x, y1);
        const lbl = (t: string, x: number, y: number) => { doc.setFontSize(3.5); doc.setTextColor(100); doc.text(t, x, y); };
        const val2 = (t: string, x: number, y: number, sz: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(sz); doc.setTextColor(0); doc.text(t, x, y); };

        doc.rect(X0, GY, CW, 53 - GY);

        // L1
        hL(r[1]); vL(c1, r[0], r[1]); vL(c2, r[0], r[1]);
        lbl('MODELO', X0 + 1, r[0] + 2); val2(val(p.model || p.modelo), X0 + 1, r[0] + 5, 7);
        lbl('VOLTAGEM', c1 + 1, r[0] + 2); val2(cleanStr(val(p.voltage || p.tensao), 'V'), c1 + 1, r[0] + 5, 7);
        lbl('FREQ.', c2 + 1, r[0] + 2); val2('60 Hz', c2 + 1, r[0] + 5, 7);

        // L2
        hL(r[2]);
        if (val(p.internal_serial) !== '-') {
            try {
                const qr = await QRCode.toDataURL(val(p.internal_serial), { margin: 0 });
                doc.addImage(qr, 'PNG', X0 + 2, r[1] + 0.5, 6, 6);
            } catch { }
        }
        lbl('NR. SERIE AMBICOM:', X0 + 15, r[1] + 2.5); val2(val(p.internal_serial), X0 + 15, r[1] + 6, 8);

        // L3
        hL(r[3]); vL(c2, r[2], r[3]);
        lbl('PNC/ML', X0 + 1, r[2] + 2); val2(val(p.pnc_ml), X0 + 1, r[2] + 5.5, 7);
        lbl('COMPRESSOR', c2 + 1, r[2] + 2); val2(val(p.compressor), c2 + 1, r[2] + 5.5, 6);

        // L4
        hL(r[4]); vL(c1, r[3], r[4]);
        lbl('GAS FRIGOR.', X0 + 1, r[3] + 2); val2(val(p.refrigerant_gas), X0 + 1, r[3] + 5.5, 7);
        lbl('CARGA GAS', c1 + 1, r[3] + 2); val2(cleanStr(val(p.gas_charge), 'g'), c1 + 1, r[3] + 5.5, 7);

        // L5
        hL(r[5]); vL(c1, r[4], r[5]); vL(c2, r[4], r[5]);
        lbl('FREEZER', X0 + 1, r[4] + 2); val2(cleanStr(val(p.volume_freezer), 'L'), X0 + 1, r[4] + 5.5, 6);
        lbl('REFRIG.', c1 + 1, r[4] + 2); val2(cleanStr(val(p.volume_refrigerator), 'L'), c1 + 1, r[4] + 5.5, 6);
        lbl('TOTAL', c2 + 1, r[4] + 2); val2(cleanStr(val(p.volume_total), 'L'), c2 + 1, r[4] + 5.5, 6);

        // L6
        vL(c1, r[5], 53); vL(c2, r[5], 53);
        lbl('CORRENTE', X0 + 1, r[5] + 2); val2(cleanStr(val(p.electric_current), 'A'), X0 + 1, r[5] + 6, 7);
        lbl('POTENCIA', c1 + 1, r[5] + 2); val2(cleanStr(val(p.defrost_power), 'W'), c1 + 1, r[5] + 6, 7);
        lbl('TAMANHO', c2 + 1, r[5] + 2);
        const ds = p.size === 'Pequeno' ? 'P' : p.size === 'Médio' ? 'M' : p.size === 'Grande' ? 'G' : (p.size || '-');
        doc.setFontSize(22); doc.text(ds, c2 + colW / 2, 51, { align: 'center' });
    }
    return doc;
};

export const pdfToBase64 = (doc: jsPDF): string => doc.output('datauristring').split(',')[1];

export const printLabels = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    doc.save(`etiquetas_ambicom_${Date.now()}.pdf`);
};

export const printLabelsNative = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) {
        w.addEventListener('load', () => w.print(), { once: true });
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
};
