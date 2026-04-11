import jsPDF from 'jspdf';
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

// ─── TSPL Generator — Elgin L42 Pro (LANDSCAPE 80x55 com conteúdo ROTACIONADO) ─
export function generateLabelsTSPL(products: any[]): string {
    const sv = (v: any) => String(v ?? '').trim().replace(/"/g, "'").replace(/\r?\n/g, ' ') || '-';

    // Higienização rigorosa para evitar unidades duplicadas ("V V", "L L")
    const clean = (val: string, unit: string) => {
        if (!val || val === '-') return '-';
        const cleanVal = val.replace(new RegExp(`\\s*${unit}$`, 'i'), '').trim();
        return `${cleanVal} ${unit}`;
    };

    // FÍSICO: 80mm de largura (640 dots) e 55mm de altura (440 dots)
    // DESIGN: 55mm de largura (440 dots) e 80mm de altura (640 dots)
    // Para imprimir RETRATO em uma bobina PAISAGEM, usamos a rotação nativa do DIRECTION.

    const lines: string[] = [
        'SIZE 80 mm,55 mm', // Bobina física deitada
        'GAP 3 mm,0 mm',
        'DIRECTION 0,1',    // Gira a página inteira em 90° 
        'OFFSET 0 mm',
        'SPEED 4',
        'DENSITY 10',
        'CODEPAGE UTF-8',
        'SET TEAR OFF',
        '',
    ];

    for (const p of products) {
        // Coordenadas baseadas em um canvas virtual 55x80 (Portait)
        const X0 = 16, X1 = 424, GW = X1 - X0;
        const GY = 116;
        const r = [GY, GY + 52, GY + 166, GY + 222, GY + 278, GY + 334, GY + 390, GY + 456];
        const colPart = Math.floor(GW / 3), c1 = X0 + colPart, c2 = X0 + colPart * 2;
        const cMod = X0 + Math.floor(GW * 0.5), cSer = X0 + 88;

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
        // Usamos as coordenadas PORTRAIT (55x80). O DIRECTION 0,1 fará a mágica de girar para a bobina física 80x55.

        // Cabeçalho
        lines.push(`TEXT ${X0},8,"3",0,1,1,"AMBICOM"`);
        lines.push(`TEXT ${X0},38,"1",0,1,1,"R. Wenceslau Marek, 10 - Aguas Belas"`);
        lines.push(`TEXT ${X0},52,"1",0,1,1,"SJP - PR, 83010-520"`);
        lines.push(`TEXT ${X0},68,"2",0,1,1,"SAC: 041-3382-5410"`);

        // Stamp box
        lines.push(`BOX 260,4,${X1},108,2`);
        const stampCX = Math.floor((260 + X1) / 2);
        ['PRODUTO', 'REMANUFATURADO', 'GARANTIA', 'AMBICOM'].forEach((t, i) => {
            const tx = stampCX - Math.floor((t.length * 8) / 2);
            lines.push(`TEXT ${tx},${14 + i * 20},"1",0,1,1,"${t}"`);
        });

        // Grade
        lines.push(`BOX ${X0},${GY},${X1},${r[7]},2`);
        lines.push(`LINE ${X0},${r[1]},${X1},${r[1]},2`);
        lines.push(`LINE ${cMod},${GY},${cMod},${r[1]},2`);
        lines.push(`TEXT ${X0 + 4},${GY + 6},"1",0,1,1,"MODELO"`);
        lines.push(`TEXT ${X0 + 4},${GY + 20},"3",0,1,1,"${model}"`);
        lines.push(`TEXT ${cMod + 4},${GY + 6},"1",0,1,1,"VOLTAGEM"`);
        lines.push(`TEXT ${cMod + 4},${GY + 20},"3",0,1,1,"${voltage}"`);

        // Serial/QR
        lines.push(`LINE ${X0},${r[2]},${X1},${r[2]},2`);
        lines.push(`LINE ${cSer},${r[1]},${cSer},${r[2]},2`);
        if (serial !== '-') lines.push(`QRCODE ${X0 + 2},${r[1] + 2},L,4,A,0,"${serial}"`);
        lines.push(`TEXT ${cSer + 4},${r[1] + 4},"1",0,1,1,"N. SERIE AMBICOM:"`);
        lines.push(`TEXT ${cSer + 4},${r[1] + 20},"2",0,1,1,"${serial}"`);

        // PNC
        lines.push(`LINE ${X0},${r[3]},${X1},${r[3]},2`);
        lines.push(`TEXT ${X0 + 4},${r[2] + 4},"1",0,1,1,"PNC/ML"`);
        lines.push(`TEXT ${X0 + 4},${r[2] + 18},"2",0,1,1,"${pncMl}"`);

        // Gas/Carga/Comp
        lines.push(`LINE ${X0},${r[4]},${X1},${r[4]},2`);
        lines.push(`LINE ${c1},${r[3]},${c1},${r[4]},2`);
        lines.push(`LINE ${c2},${r[3]},${c2},${r[4]},2`);
        lines.push(`TEXT ${X0 + 4},${r[3] + 4},"1",0,1,1,"GAS FRIG."`);
        lines.push(`TEXT ${X0 + 4},${r[3] + 16},"2",0,1,1,"${gas}"`);
        lines.push(`TEXT ${c1 + 4},${r[3] + 4},"1",0,1,1,"CARGA"`);
        lines.push(`TEXT ${c1 + 4},${r[3] + 16},"2",0,1,1,"${gasChg}"`);
        lines.push(`TEXT ${c2 + 4},${r[3] + 4},"1",0,1,1,"COMPR."`);
        lines.push(`TEXT ${c2 + 4},${r[3] + 16},"2",0,1,1,"${comp}"`);

        // Volumes
        lines.push(`LINE ${X0},${r[5]},${X1},${r[5]},2`);
        lines.push(`LINE ${c1},${r[4]},${c1},${r[5]},2`);
        lines.push(`LINE ${c2},${r[4]},${c2},${r[5]},2`);
        lines.push(`TEXT ${X0 + 4},${r[4] + 4},"1",0,1,1,"FREEZER"`);
        lines.push(`TEXT ${X0 + 4},${r[4] + 16},"1",0,1,1,"${volFrz}"`);
        lines.push(`TEXT ${c1 + 4},${r[4] + 4},"1",0,1,1,"REFRIG."`);
        lines.push(`TEXT ${c1 + 4},${r[4] + 16},"1",0,1,1,"${volRef}"`);
        lines.push(`TEXT ${c2 + 4},${r[4] + 4},"1",0,1,1,"TOTAL"`);
        lines.push(`TEXT ${c2 + 4},${r[4] + 16},"1",0,1,1,"${volTot}"`);

        // Base
        lines.push(`LINE ${c1},${r[6]},${c1},${r[7]},2`);
        lines.push(`LINE ${c2},${r[6]},${c2},${r[7]},2`);
        lines.push(`TEXT ${X0 + 4},${r[6] + 4},"1",0,1,1,"CORRENTE"`);
        lines.push(`TEXT ${X0 + 4},${r[6] + 16},"2",0,1,1,"${current}"`);
        lines.push(`TEXT ${c1 + 4},${r[6] + 4},"1",0,1,1,"POTENCIA"`);
        lines.push(`TEXT ${c1 + 4},${r[6] + 16},"2",0,1,1,"${defrost}"`);
        lines.push(`TEXT ${c2 + 4},${r[6] + 4},"1",0,1,1,"TAMANHO"`);
        const col3CX = c2 + Math.floor(colPart / 2) - 16;
        lines.push(`TEXT ${col3CX},${r[6] + 40},"5",0,1,1,"${dispSize}"`);

        lines.push('PRINT 1,1');
    }
    return lines.join('\r\n');
}

// ─── PDF (RETRATO 55x80 para Visualização na Tela) ───────────────────────────
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    // Voltamos para Retrato para você visualizar corretamente no monitor
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [55, 80], compress: true });

    const cleanStr = (val: string, unit: string) => {
        const s = String(val ?? '').trim();
        if (!s || s === '-') return '-';
        const cleanVal = s.replace(new RegExp(`\\s*${unit}$`, 'i'), '').trim();
        return `${cleanVal} ${unit}`;
    };

    const X0 = 2, X1 = 53, CW = X1 - X0;
    const GY = 14.5;
    const r = [GY, GY + 6.5, GY + 20.5, GY + 27.5, GY + 34.5, GY + 41.5, GY + 48.5, GY + 57];

    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        if (idx > 0) doc.addPage([55, 80], 'p');
        const val = (v: any) => String(v ?? '').trim() || '-';

        // Cabeçalho Retrato
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.text("Ambicom", X0, 5);
        doc.setFont("helvetica", "normal"); doc.setFontSize(4);
        doc.text("R. Wenceslau Marek, 10 - Aguas Belas", X0, 8);
        doc.text("SJP - PR, 83010-520", X0, 10.5);
        doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
        doc.text("SAC: 041-3382-5410", X0, 13.5);

        // Bloco Stamp Garantia
        doc.setFontSize(4); doc.setFont("helvetica", "normal");
        ["PRODUTO", "REMANUFATURADO", "GARANTIA", "AMBICOM"].forEach((t, i) =>
            doc.text(t, 42, 5 + i * 2.5, { align: 'center' })
        );

        doc.setLineWidth(0.25);
        const colW = CW / 3;
        const c1 = X0 + colW, c2 = X0 + colW * 2;
        const cMod = X0 + Math.floor(CW * 0.50);
        const cSer = X0 + 10;

        const hL = (y: number) => doc.line(X0, y, X1, y);
        const vL = (x: number, y0: number, y1: number) => doc.line(x, y0, x, y1);
        const lbl = (t: string, x: number, y: number) => { doc.setFontSize(3.5); doc.setTextColor(100); doc.text(t, x, y); };
        const val2 = (t: string, x: number, y: number, sz: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(sz); doc.setTextColor(0); doc.text(t, x, y); };

        doc.rect(X0, r[0], CW, r[7] - r[0]);

        // L1
        hL(r[1]); vL(cMod, r[0], r[1]);
        lbl('MODELO', X0 + 1, r[0] + 2); val2(val(p.model || p.modelo), X0 + 1, r[0] + 5.5, 8);
        lbl('VOLTAGEM', cMod + 1, r[0] + 2); val2(cleanStr(val(p.voltage || p.tensao), 'V'), cMod + 1, r[0] + 5.5, 8);

        // L2
        hL(r[2]); vL(cSer, r[1], r[2]);
        if (val(p.internal_serial) !== '-') {
            try {
                const qr = await QRCode.toDataURL(val(p.internal_serial), { margin: 0 });
                doc.addImage(qr, 'PNG', X0 + 0.5, r[1] + 0.5, 9, 9);
            } catch { }
        }
        lbl('NR. SERIE AMBICOM:', cSer + 1, r[1] + 2.5); val2(val(p.internal_serial), cSer + 1, r[1] + 7, 7.5);

        // L3
        hL(r[3]);
        lbl('PNC/ML', X0 + 1, r[2] + 2); val2(val(p.pnc_ml), X0 + 1, r[2] + 5.8, 7);

        // L4, L5
        [[r[3], r[4], 'GAS FRIG.', val(p.refrigerant_gas), 'CARGA', cleanStr(val(p.gas_charge), 'g'), 'COMPR.', val(p.compressor)],
        [r[4], r[5], 'FREEZER', cleanStr(val(p.volume_freezer), 'L'), 'REFRIG.', cleanStr(val(p.volume_refrigerator), 'L'), 'TOTAL', cleanStr(val(p.volume_total), 'L')]
        ].forEach(([ry0, ry1, l1, v1, l2, v2, l3, v3]) => {
            hL(ry1 as number); vL(c1, ry0 as number, ry1 as number); vL(c2, ry0 as number, ry1 as number);
            [[X0, l1, v1], [c1, l2, v2], [c2, l3, v3]].forEach(([cx, lb, vl]) => {
                lbl(lb as string, (cx as number) + 1, (ry0 as number) + 2);
                val2(vl as string, (cx as number) + 1, (ry0 as number) + 5.8, 6.5);
            });
        });

        // L7
        vL(c1, r[6], r[7]); vL(c2, r[6], r[7]);
        lbl('CORRENTE', X0 + 1, r[6] + 2); val2(cleanStr(val(p.electric_current), 'A'), X0 + 1, r[6] + 6.5, 7);
        lbl('POTENCIA', c1 + 1, r[6] + 2); val2(cleanStr(val(p.defrost_power), 'W'), c1 + 1, r[6] + 6.5, 7);
        lbl('TAMANHO', c2 + 1, r[6] + 2);
        const ds = p.size === 'Pequeno' ? 'P' : p.size === 'Médio' ? 'M' : p.size === 'Grande' ? 'G' : (p.size || '-');
        doc.setFontSize(18); doc.text(ds, c2 + colW / 2, r[6] + 12, { align: 'center' });
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
