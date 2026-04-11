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

// ─── TSPL Generator — Elgin L42 Pro (LANDSCAPE 80x55 com mapeamento manual) ───
export function generateLabelsTSPL(products: any[]): string {
    const sv = (v: any) => String(v ?? '').trim().replace(/"/g, "'").replace(/\r?\n/g, ' ') || '-';

    // Higienização para evitar unidades duplicadas
    const clean = (val: string, unit: string) => {
        if (!val || val === '-') return '-';
        const cleanVal = val.replace(new RegExp(`\\s*${unit}$`, 'i'), '').trim();
        return `${cleanVal} ${unit}`;
    };

    // Dimensões Físicas: 80mm x 55mm (640 x 440 dots)
    // Dimensões Design: 55mm x 80mm (440 x 640 dots)

    // Função de Mapeamento (Gira o conteúdo 90° CW manualmente)
    // Design(px, py) -> Físico(tx, ty)
    const mapX = (py: number) => 640 - py; // A altura do design vira o cabeçote (X)
    const mapY = (px: number) => px;       // A largura do design vira o avanço (Y)

    const lines: string[] = [
        'SIZE 80 mm,55 mm',
        'GAP 3 mm,0 mm',
        'DIRECTION 1', // Impressão normal
        'OFFSET 0 mm',
        'SPEED 3',
        'DENSITY 10',
        'CODEPAGE UTF-8',
        'SET TEAR OFF',
        '',
    ];

    for (const p of products) {
        // Coordenadas ORIGINAIS (Layout Retrato 55x80)
        const X0 = 16, X1 = 424, GW = X1 - X0;
        const GY = 116;
        const r = [GY, GY + 52, GY + 166, GY + 222, GY + 278, GY + 334, GY + 390, GY + 460];
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

        // --- Cabeçalho Rotacionado 90° ---
        // TEXT X, Y, font, rotation, mx, my, content
        lines.push(`TEXT ${mapX(8)},${mapY(X0)},"3",90,1,1,"AMBICOM"`);
        lines.push(`TEXT ${mapX(38)},${mapY(X0)},"1",90,1,1,"R. Wenceslau Marek, 10 - Aguas Belas"`);
        lines.push(`TEXT ${mapX(52)},${mapY(X0)},"1",90,1,1,"SJP - PR, 83010-520"`);
        lines.push(`TEXT ${mapX(68)},${mapY(X0)},"2",90,1,1,"SAC: 041-3382-5410"`);

        // Stamp Box Rotacionada
        // BOX x,y,x,y,thickness -> Como girou, o box vira uma composição de 4 linhas
        const bX0 = mapX(108), bX1 = mapX(4), bY0 = mapY(260), bY1 = mapY(X1);
        lines.push(`BOX ${bX0},${bY0},${bX1},${bY1},2`);
        const stampCX = (108 + 4) / 2;
        ['PRODUTO', 'REMANUFATURADO', 'GARANTIA', 'AMBICOM'].forEach((t, i) => {
            const ty = mapY(260) + 12; // centro horizontal no design
            const tx = mapX(16 + i * 20); // vertical no design
            lines.push(`TEXT ${tx},${ty},"1",90,1,1,"${t}"`);
        });

        // --- Grade Técnica Rotacionada ---
        // Moldura externa
        lines.push(`BOX ${mapX(r[7])},${mapY(X0)},${mapX(GY)},${mapY(X1)},2`);

        // L1: MODELO | VOLTAGEM
        lines.push(`LINE ${mapX(r[1])},${mapY(X0)},${mapX(r[1])},${mapY(X1)},2`); // Linha horizontal do design vira vertical
        lines.push(`LINE ${mapX(GY)},${mapY(cMod)},${mapX(r[1])},${mapY(cMod)},2`); // Divisor

        lines.push(`TEXT ${mapX(GY + 6)},${mapY(X0 + 4)},"1",90,1,1,"MODELO"`);
        lines.push(`TEXT ${mapX(GY + 22)},${mapY(X0 + 4)},"3",90,1,1,"${model}"`);
        lines.push(`TEXT ${mapX(GY + 6)},${mapY(cMod + 4)},"1",90,1,1,"VOLTAGEM"`);
        lines.push(`TEXT ${mapX(GY + 22)},${mapY(cMod + 4)},"3",90,1,1,"${voltage}"`);

        // L2: QR | SERIAL
        lines.push(`LINE ${mapX(r[2])},${mapY(X0)},${mapX(r[2])},${mapY(X1)},2`);
        lines.push(`LINE ${mapX(r[1])},${mapY(cSer)},${mapX(r[2])},${mapY(cSer)},2`);
        if (serial !== '-') lines.push(`QRCODE ${mapX(r[1] + 130)},${mapY(X0 + 2)},L,4,A,90,"${serial}"`);
        lines.push(`TEXT ${mapX(r[1] + 6)},${mapY(cSer + 4)},"1",90,1,1,"N. SERIE:"`);
        lines.push(`TEXT ${mapX(r[1] + 22)},${mapY(cSer + 4)},"2",90,1,1,"${serial}"`);

        // L3: PNC
        lines.push(`LINE ${mapX(r[3])},${mapY(X0)},${mapX(r[3])},${mapY(X1)},2`);
        lines.push(`TEXT ${mapX(r[2] + 4)},${mapY(X0 + 4)},"1",90,1,1,"PNC/ML"`);
        lines.push(`TEXT ${mapX(r[2] + 18)},${mapY(X0 + 4)},"2",90,1,1,"${pncMl}"`);

        // L4, L5, L6
        [r[3], r[4], r[5], r[6]].forEach(y => lines.push(`LINE ${mapX(y)},${mapY(X0)},${mapX(y)},${mapY(X1)},2`));
        [c1, c2].forEach(x => lines.push(`LINE ${mapX(r[3])},${mapY(x)},${mapX(r[7])},${mapY(x)},2`));

        // L4
        lines.push(`TEXT ${mapX(r[3] + 4)},${mapY(X0 + 4)},"1",90,1,1,"GAS"`); lines.push(`TEXT ${mapX(r[3] + 16)},${mapY(X0 + 4)},"2",90,1,1,"${gas}"`);
        lines.push(`TEXT ${mapX(r[3] + 4)},${mapY(c1 + 4)},"1",90,1,1,"CARGA"`); lines.push(`TEXT ${mapX(r[3] + 16)},${mapY(c1 + 4)},"2",90,1,1,"${gasChg}"`);
        lines.push(`TEXT ${mapX(r[3] + 4)},${mapY(c2 + 4)},"1",90,1,1,"COMPR."`); lines.push(`TEXT ${mapX(r[3] + 16)},${mapY(c2 + 4)},"2",90,1,1,"${comp}"`);

        // L5
        lines.push(`TEXT ${mapX(r[4] + 4)},${mapY(X0 + 4)},"1",90,1,1,"FREEZ"`); lines.push(`TEXT ${mapX(r[4] + 18)},${mapY(X0 + 4)},"2",90,1,1,"${volFrz}"`);
        lines.push(`TEXT ${mapX(r[4] + 4)},${mapY(c1 + 4)},"1",90,1,1,"REFRIG"`); lines.push(`TEXT ${mapX(r[4] + 18)},${mapY(c1 + 4)},"2",90,1,1,"${volRef}"`);
        lines.push(`TEXT ${mapX(r[4] + 4)},${mapY(c2 + 4)},"1",90,1,1,"TOTAL"`); lines.push(`TEXT ${mapX(r[4] + 18)},${mapY(c2 + 4)},"2",90,1,1,"${volTot}"`);

        // L7
        lines.push(`TEXT ${mapX(r[6] + 4)},${mapY(X0 + 4)},"1",90,1,1,"CORRENTE"`); lines.push(`TEXT ${mapX(r[6] + 20)},${mapY(X0 + 4)},"3",90,1,1,"${current}"`);
        lines.push(`TEXT ${mapX(r[6] + 4)},${mapY(c1 + 4)},"1",90,1,1,"POTENCIA"`); lines.push(`TEXT ${mapX(r[6] + 20)},${mapY(c1 + 4)},"3",90,1,1,"${defrost}"`);
        lines.push(`TEXT ${mapX(r[6] + 4)},${mapY(c2 + 4)},"1",90,1,1,"TAMANHO"`); lines.push(`TEXT ${mapX(r[6] + 50)},${mapY(c2 + 40)},"5",90,1,1,"${dispSize}"`);

        lines.push('PRINT 1,1');
    }
    return lines.join('\r\n');
}

// ─── PDF (RETRATO 55x80 - Visualização na Tela) ──────────────────────────────
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [55, 80], compress: true });

    const cleanStr = (val: string, unit: string) => {
        const s = String(val ?? '').trim();
        if (!s || s === '-') return '-';
        const cleanVal = s.replace(new RegExp(`\\s*${unit}$`, 'i'), '').trim();
        return `${cleanVal} ${unit}`;
    };

    const X0 = 2, X1 = 53, CW = X1 - X0;
    const GY = 14.5;
    const r = [GY, GY + 6.5, GY + 20.5, GY + 27.5, GY + 34.5, GY + 41.5, GY + 48.5, GY + 57.5];

    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        if (idx > 0) doc.addPage([55, 80], 'p');
        const val = (v: any) => String(v ?? '').trim() || '-';

        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Ambicom", X0, 5);
        doc.setFont("helvetica", "normal"); doc.setFontSize(4);
        doc.text("R. Wenceslau Marek, 10 - Aguas Belas", X0, 8);
        doc.text("SJP - PR, 83010-520", X0, 10.5);
        doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); doc.text("SAC: 041-3382-5410", X0, 13.5);

        ["PRODUTO", "REMANUFATURADO", "GARANTIA", "AMBICOM"].forEach((t, i) => {
            doc.setFontSize(3.5);
            doc.text(t, 42, 5 + i * 2.5, { align: 'center' });
        });

        doc.setLineWidth(0.25);
        const colW = CW / 3;
        const c1 = X0 + colW, c2 = X0 + colW * 2;
        const cMod = X0 + (CW * 0.50);
        const cSer = X0 + 10;

        const hL = (y: number) => doc.line(X0, y, X1, y);
        const vL = (x: number, y0: number, y1: number) => doc.line(x, y0, x, y1);
        const lbl = (t: string, x: number, y: number) => { doc.setFontSize(3.5); doc.setTextColor(100); doc.text(t, x, y); };
        const val2 = (t: string, x: number, y: number, sz: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(sz); doc.setTextColor(0); doc.text(t, x, y); };

        doc.rect(X0, r[0], CW, r[7] - r[0]);

        hL(r[1]); vL(cMod, r[0], r[1]);
        lbl('MODELO', X0 + 1, r[0] + 2); val2(val(p.model || p.modelo), X0 + 1, r[0] + 5.5, 8);
        lbl('VOLTAGEM', cMod + 1, r[0] + 2); val2(cleanStr(val(p.voltage || p.tensao), 'V'), cMod + 1, r[0] + 5.5, 8);

        hL(r[2]); vL(cSer, r[1], r[2]);
        if (val(p.internal_serial) !== '-') {
            try {
                const qr = await QRCode.toDataURL(val(p.internal_serial), { margin: 0 });
                doc.addImage(qr, 'PNG', X0 + 0.5, r[1] + 0.5, 9, 9);
            } catch { }
        }
        lbl('NR. SERIE:', cSer + 1, r[1] + 2.5); val2(val(p.internal_serial), cSer + 1, r[1] + 7, 7.5);

        hL(r[3]); hL(r[4]); hL(r[5]); hL(r[6]);
        vL(c1, r[3], r[7]); vL(c2, r[3], r[7]);

        lbl('PNC/ML', X0 + 1, r[2] + 2); val2(val(p.pnc_ml), X0 + 1, r[2] + 5.8, 7);

        // L4 GAS
        lbl('GAS', X0 + 1, r[3] + 2); val2(val(p.refrigerant_gas), X0 + 1, r[3] + 5.8, 6.5);
        lbl('CARGA', c1 + 1, r[3] + 2); val2(cleanStr(val(p.gas_charge), 'g'), c1 + 1, r[3] + 5.8, 6.5);
        lbl('COMPR.', c2 + 1, r[3] + 2); val2(val(p.compressor), c2 + 1, r[3] + 5.8, 6.5);

        // L5 VOLS
        lbl('FREEZ', X0 + 1, r[4] + 2); val2(cleanStr(val(p.volume_freezer), 'L'), X0 + 1, r[4] + 5.5, 6);
        lbl('REFRIG', c1 + 1, r[4] + 2); val2(cleanStr(val(p.volume_refrigerator), 'L'), c1 + 1, r[4] + 5.5, 6);
        lbl('TOTAL', c2 + 1, r[4] + 2); val2(cleanStr(val(p.volume_total), 'L'), c2 + 1, r[4] + 5.5, 6);

        // L7 BASE
        lbl('CORRENTE', X0 + 1, r[6] + 2); val2(cleanStr(val(p.electric_current), 'A'), X0 + 1, r[6] + 6.5, 7);
        lbl('POTENCIA', c1 + 1, r[6] + 2); val2(cleanStr(val(p.defrost_power), 'W'), c1 + 1, r[6] + 6.5, 7);
        lbl('TAMANHO', c2 + 1, r[6] + 2);
        const ds = p.size === 'Pequeno' ? 'P' : p.size === 'Médio' ? 'M' : p.size === 'Grande' ? 'G' : (p.size || '-');
        doc.setFontSize(22); doc.text(ds, c2 + colW / 2, r[6] + 12, { align: 'center' });
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
