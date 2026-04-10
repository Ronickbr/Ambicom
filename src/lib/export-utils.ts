import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';

// ─── Relatório A4 ─────────────────────────────────────────────────────────────
export const exportToPDF = (title: string, headers: string[], data: (string | number | boolean | null)[][], fileName: string) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    const date = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em: ${date}`, 14, 30);
    autoTable(doc, {
        head: [headers],
        body: data,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [14, 165, 233], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { top: 35 },
    });
    doc.save(`${fileName}_${new Date().getTime()}.pdf`);
};

export const exportToExcel = (data: Record<string, unknown>[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
    XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
};

// ─── TSPL Generator — Elgin L42 Pro ──────────────────────────────────────────
// Etiqueta: 55mm de LARGURA × 80mm de ALTURA (portrait)
// A linguagem TSPL é processada pelo firmware da impressora — sem PDF, sem rotação.
//
// @ 203 DPI (8 dots/mm):
//   Largura = 55mm × 8 = 440 dots (eixo X, horizontal)
//   Altura  = 80mm × 8 = 640 dots (eixo Y, feed direction)
//
// Layout:
//   Cabeçalho: y=0..96    (12mm) — Ambicom + endereço + SAC + stamp box
//   Grade    : y=100..620 (65mm) — 7 linhas de dados técnicos
//   Margem   : y=620..640 (2.5mm)

export function generateLabelsTSPL(products: any[]): string {
    const sv = (v: any) => String(v ?? '').trim().replace(/"/g, "'").replace(/\r?\n/g, ' ') || '-';

    // ── Limites do eixo X (largura 55mm = 440 dots) ──────────────────────────
    const X0 = 16;    // 2mm margem esquerda
    const X1 = 424;   // 53mm (2mm margem direita — evita corte mecânico)
    const GW = X1 - X0; // 408 dots = 51mm úteis

    // ── Grade: linhas horizontais no eixo Y (altura 80mm = 640 dots) ─────────
    const GY = 100; // topo da grade = 12.5mm
    const r = [
        GY,           // r[0] = 100 — linha superior da grade
        GY + 72,      // r[1] = 172 — Modelo / Voltagem        (9mm)
        GY + 160,     // r[2] = 260 — QR Code / Serial         (11mm)
        GY + 220,     // r[3] = 320 — PNC/ML / Frequência      (7.5mm)
        GY + 280,     // r[4] = 380 — Gás / Carga / Compressor (7.5mm)
        GY + 340,     // r[5] = 440 — Volumes                  (7.5mm)
        GY + 400,     // r[6] = 500 — Pressões                 (7.5mm)
        GY + 520,     // r[7] = 620 — Corrente / Tamanho       (15mm — fonte 5)
    ];

    // ── Divisores de coluna ───────────────────────────────────────────────────
    const colPart = Math.floor(GW / 3);          // 136 dots = 17mm (3 colunas iguais)
    const c1 = X0 + colPart;                // 152 dots = 19mm
    const c2 = X0 + colPart * 2;            // 288 dots = 36mm
    const cMod = X0 + Math.floor(GW * 0.50);  // 220 dots = 27.5mm (50% Modelo|Voltagem)
    const cPnc = X0 + Math.floor(GW * 0.70);  // 302 dots = 37.8mm (70% PNC|Frequência)
    const cSer = X0 + 88;                     // 104 dots = 13mm  (após QR ~10mm)

    const lines: string[] = [
        'SIZE 55 mm,80 mm',   // 55mm largura × 80mm altura
        'GAP 3 mm,0 mm',
        'DIRECTION 1',         // feed normal, sem rotação
        'OFFSET 0 mm',
        'SPEED 4',
        'DENSITY 10',
        'CODEPAGE UTF-8',
        'SET TEAR OFF',
        '',
    ];

    for (const p of products) {
        const model = sv(p.model ?? p.modelo);
        const voltage = sv(p.voltage ?? p.tensao);
        const serial = sv(p.internal_serial);
        const commCode = sv(p.commercial_code);
        const pncMl = sv(p.pnc_ml);
        const gas = sv(p.refrigerant_gas);
        const gasChg = sv(p.gas_charge);
        const comp = sv(p.compressor);
        const volFrz = sv(p.volume_freezer);
        const volRef = sv(p.volume_refrigerator);
        const volTot = sv(p.volume_total);
        const pressure = sv(p.pressure_high_low);
        const freezCap = sv(p.freezing_capacity);
        const current = sv(p.electric_current);
        const defrost = sv(p.defrost_power);

        const parts = pressure === '-' ? ['-', '-'] : pressure.split('/');
        const pressH = parts[0]?.trim() || '-';
        const pressL = parts[1]?.trim() || '-';

        const sz = p.size || '-';
        const dispSize = sz === 'Pequeno' ? 'P' : sz === 'Médio' ? 'M' : sz === 'Grande' ? 'G' : sz;

        lines.push('CLS');
        lines.push('');

        // ── CABEÇALHO (y=0..96) ──────────────────────────────────────────────
        // "AMBICOM" em fonte 3 (16×24 dots)
        lines.push(`TEXT ${X0},8,"3",0,1,1,"AMBICOM"`);

        // Address (font 1 = 8×12 dots — 2 linhas curtas)
        lines.push(`TEXT ${X0},40,"1",0,1,1,"R. Wenceslau Marek, 10 - Aguas Belas"`);
        lines.push(`TEXT ${X0},54,"1",0,1,1,"SJP - PR, 83010-520"`);

        // SAC (font 2 = 12×20 dots)
        lines.push(`TEXT ${X0},70,"2",0,1,1,"SAC: 041-3382-5410"`);

        // Stamp box (x=248..424, y=4..96 = 22mm × 11.5mm)
        lines.push(`BOX 248,4,${X1},96,2`);
        const stampCX = Math.floor((248 + X1) / 2); // centro da caixa
        ['PRODUTO', 'REMANUFATURADO', 'GARANTIA', 'AMBICOM'].forEach((t, i) => {
            const tw = t.length * 8;
            const tx = stampCX - Math.floor(tw / 2);
            lines.push(`TEXT ${tx},${14 + i * 20},"1",0,1,1,"${t}"`);
        });

        lines.push('');

        // ── GRADE TÉCNICA (y=100..620) ────────────────────────────────────────
        lines.push(`BOX ${X0},${r[0]},${X1},${r[7]},2`);

        // Linha 1: MODELO (50%) | VOLTAGEM (50%) — 9mm
        lines.push(`LINE ${X0},${r[1]},${X1},${r[1]},2`);
        lines.push(`LINE ${cMod},${r[0]},${cMod},${r[1]},2`);
        lines.push(`TEXT ${X0 + 4},${r[0] + 6},"1",0,1,1,"MODELO"`);
        lines.push(`TEXT ${X0 + 4},${r[0] + 26},"3",0,1,1,"${model}"`);
        lines.push(`TEXT ${cMod + 4},${r[0] + 6},"1",0,1,1,"VOLTAGEM"`);
        lines.push(`TEXT ${cMod + 4},${r[0] + 26},"3",0,1,1,"${voltage} V"`);

        // Linha 2: QR | SERIAL — 11mm
        lines.push(`LINE ${X0},${r[2]},${X1},${r[2]},2`);
        lines.push(`LINE ${cSer},${r[1]},${cSer},${r[2]},2`);
        if (serial !== '-') {
            // QRCODE x,y,correcao,tamanhoCell,modo,rotacao,"dados"
            lines.push(`QRCODE ${X0 + 2},${r[1] + 2},L,4,A,0,"${serial}"`);
        }
        lines.push(`TEXT ${cSer + 4},${r[1] + 6},"1",0,1,1,"NUMERO DE SERIE AMBICOM:"`);
        lines.push(`TEXT ${cSer + 4},${r[1] + 24},"2",0,1,1,"${serial}"`);
        if (commCode !== '-') {
            lines.push(`TEXT ${cSer + 4},${r[1] + 56},"1",0,1,1,"${commCode}"`);
        }

        // Linha 3: PNC/ML (70%) | FREQUÊNCIA (30%) — 7.5mm
        lines.push(`LINE ${X0},${r[3]},${X1},${r[3]},2`);
        lines.push(`LINE ${cPnc},${r[2]},${cPnc},${r[3]},2`);
        lines.push(`TEXT ${X0 + 4},${r[2] + 6},"1",0,1,1,"PNC/ML"`);
        lines.push(`TEXT ${X0 + 4},${r[2] + 22},"2",0,1,1,"${pncMl}"`);
        lines.push(`TEXT ${cPnc + 4},${r[2] + 6},"1",0,1,1,"FREQUENCIA"`);
        lines.push(`TEXT ${cPnc + 4},${r[2] + 24},"3",0,1,1,"60HZ"`);

        // Linha 4: GÁS FRIGOR. | CARGA GÁS | COMPRESSOR — 7.5mm
        lines.push(`LINE ${X0},${r[4]},${X1},${r[4]},2`);
        lines.push(`LINE ${c1},${r[3]},${c1},${r[4]},2`);
        lines.push(`LINE ${c2},${r[3]},${c2},${r[4]},2`);
        lines.push(`TEXT ${X0 + 4},${r[3] + 6},"1",0,1,1,"GAS FRIGOR."`);
        lines.push(`TEXT ${X0 + 4},${r[3] + 22},"2",0,1,1,"${gas}"`);
        lines.push(`TEXT ${c1 + 4},${r[3] + 6},"1",0,1,1,"CARGA GAS"`);
        lines.push(`TEXT ${c1 + 4},${r[3] + 22},"2",0,1,1,"${gasChg !== '-' ? gasChg + ' g' : '-'}"`);
        lines.push(`TEXT ${c2 + 4},${r[3] + 6},"1",0,1,1,"COMPRESSOR"`);
        lines.push(`TEXT ${c2 + 4},${r[3] + 22},"2",0,1,1,"${comp}"`);

        // Linha 5: VOL. FREEZER | VOL. REFRIG. | VOL. TOTAL — 7.5mm
        lines.push(`LINE ${X0},${r[5]},${X1},${r[5]},2`);
        lines.push(`LINE ${c1},${r[4]},${c1},${r[5]},2`);
        lines.push(`LINE ${c2},${r[4]},${c2},${r[5]},2`);
        lines.push(`TEXT ${X0 + 4},${r[4] + 6},"1",0,1,1,"VOL. FREEZER"`);
        lines.push(`TEXT ${X0 + 4},${r[4] + 22},"2",0,1,1,"${volFrz !== '-' ? volFrz + ' L' : '-'}"`);
        lines.push(`TEXT ${c1 + 4},${r[4] + 6},"1",0,1,1,"VOL. REFRIG."`);
        lines.push(`TEXT ${c1 + 4},${r[4] + 22},"2",0,1,1,"${volRef !== '-' ? volRef + ' L' : '-'}"`);
        lines.push(`TEXT ${c2 + 4},${r[4] + 6},"1",0,1,1,"VOLUME TOTAL"`);
        lines.push(`TEXT ${c2 + 4},${r[4] + 22},"2",0,1,1,"${volTot !== '-' ? volTot + ' L' : '-'}"`);

        // Linha 6: P. ALTA | P. BAIXA | CAPAC. CONG. — 7.5mm
        lines.push(`LINE ${X0},${r[6]},${X1},${r[6]},2`);
        lines.push(`LINE ${c1},${r[5]},${c1},${r[6]},2`);
        lines.push(`LINE ${c2},${r[5]},${c2},${r[6]},2`);
        lines.push(`TEXT ${X0 + 4},${r[5] + 6},"1",0,1,1,"P. ALTA"`);
        lines.push(`TEXT ${X0 + 4},${r[5] + 22},"1",0,1,1,"${pressH}"`);
        lines.push(`TEXT ${c1 + 4},${r[5] + 6},"1",0,1,1,"P. BAIXA"`);
        lines.push(`TEXT ${c1 + 4},${r[5] + 22},"1",0,1,1,"${pressL}"`);
        lines.push(`TEXT ${c2 + 4},${r[5] + 6},"1",0,1,1,"CAPAC. CONG."`);
        lines.push(`TEXT ${c2 + 4},${r[5] + 22},"2",0,1,1,"${freezCap}"`);

        // Linha 7: CORRENTE | POT. DEGELO | TAMANHO — 15mm (font 5 = 32×48 dots)
        lines.push(`LINE ${c1},${r[6]},${c1},${r[7]},2`);
        lines.push(`LINE ${c2},${r[6]},${c2},${r[7]},2`);
        lines.push(`TEXT ${X0 + 4},${r[6] + 6},"1",0,1,1,"CORRENTE"`);
        lines.push(`TEXT ${X0 + 4},${r[6] + 22},"2",0,1,1,"${current !== '-' ? current + ' A' : '-'}"`);
        lines.push(`TEXT ${c1 + 4},${r[6] + 6},"1",0,1,1,"POT. DEGELO"`);
        lines.push(`TEXT ${c1 + 4},${r[6] + 22},"2",0,1,1,"${defrost !== '-' ? defrost + ' W' : '-'}"`);
        lines.push(`TEXT ${c2 + 4},${r[6] + 6},"1",0,1,1,"TAMANHO"`);
        // Letra G/M/P em fonte 5 (32×48 dots) centralizada na 3ª coluna
        const col3CX = c2 + Math.floor(colPart / 2) - 16;
        lines.push(`TEXT ${col3CX},${r[6] + 44},"5",0,1,1,"${dispSize}"`);

        lines.push('');
        lines.push('PRINT 1,1');
        lines.push('');
    }

    return lines.join('\r\n');
}

// ─── PDF (apenas para download local) ────────────────────────────────────────
// Para impressão remota use generateLabelsTSPL + bridge (payload_type: 'tspl')
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    // PDF em portrait 55×80mm (equivalente visual ao TSPL acima)
    const doc = new jsPDF({ unit: 'mm', format: [55, 80], putOnlyUsedFonts: true, compress: true });

    // Limites (mm)
    const X0 = 2, X1 = 53, CW = X1 - X0;
    const GY = 12.5;
    const r = [GY, GY + 9, GY + 20, GY + 27.5, GY + 35, GY + 42.5, GY + 50, GY + 65];

    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        if (idx > 0) doc.addPage([55, 80]);
        const val = (v: any) => String(v ?? '').trim() || '-';

        // Cabeçalho
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(0);
        doc.text("Ambicom", X0, 6);
        doc.setFont("helvetica", "normal"); doc.setFontSize(4);
        doc.text("R. Wenceslau Marek, 10 - Aguas Belas", X0, 9);
        doc.text("SJP - PR, 83010-520", X0, 11.5);
        doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
        doc.text("SAC: 041-3382-5410", X0, 14);

        // Stamp
        doc.setFontSize(4); doc.setFont("helvetica", "normal");
        ["PRODUTO", "REMANUFATURADO", "GARANTIA", "AMBICOM"].forEach((t, i) =>
            doc.text(t, 40, 5 + i * 2.5, { align: 'center' })
        );

        doc.setLineWidth(0.25);
        const cMod = X0 + Math.floor(CW * 0.50);
        const cPnc = X0 + Math.floor(CW * 0.70);
        const colW = CW / 3;
        const c1 = X0 + colW, c2 = X0 + colW * 2;
        const qrW = 8;
        const cSer = X0 + qrW + 2;

        const hL = (y: number) => doc.line(X0, y, X1, y);
        const vL = (x: number, y0: number, y1: number) => doc.line(x, y0, x, y1);
        const lbl = (t: string, x: number, y: number) => { doc.setFont('h', 'normal'); doc.setFontSize(3); doc.setTextColor(80, 80, 80); doc.text(t, x, y); };
        const val2 = (t: string, x: number, y: number, sz: number) => { doc.setFont('h', 'bold'); doc.setFontSize(sz); doc.setTextColor(0); doc.text(t, x, y); };

        doc.rect(X0, r[0], CW, r[7] - r[0]);

        // L1
        hL(r[1]); vL(cMod, r[0], r[1]);
        lbl('Modelo', X0 + 1, r[0] + 2); val2(val(p.model), X0 + 1, r[0] + 7, 8);
        lbl('Voltagem', cMod + 1, r[0] + 2); val2(val(p.voltage) + ' V', cMod + 1, r[0] + 7, 8);

        // L2
        hL(r[2]); vL(cSer, r[1], r[2]);
        if (val(p.internal_serial) !== '-') {
            try {
                const qr = await QRCode.toDataURL(val(p.internal_serial), { margin: 0, width: 100 });
                doc.addImage(qr, 'PNG', X0 + 0.5, r[1] + 0.5, qrW, qrW);
            } catch { /* silent */ }
        }
        lbl('Nr. Serie Ambicom:', cSer + 1, r[1] + 2.5);
        doc.setFontSize(7.5); doc.setFont('h', 'bold'); doc.setTextColor(0);
        doc.text(val(p.internal_serial), cSer + 1, r[1] + 8);
        if (val(p.commercial_code) !== '-') {
            doc.setFontSize(5.5); doc.text(val(p.commercial_code), cSer + 1, r[2] - 1);
        }

        // L3
        hL(r[3]); vL(cPnc, r[2], r[3]);
        lbl('PNC/ML', X0 + 1, r[2] + 2); val2(val(p.pnc_ml), X0 + 1, r[2] + 6, 7);
        lbl('Freq.', cPnc + 1, r[2] + 2); val2('60 Hz', cPnc + 1, r[2] + 6, 7);

        // L4, L5
        const gridsAB = [
            [r[3], r[4], 'GAS FRIGOR.', val(p.refrigerant_gas), 'CARGA GAS', val(p.gas_charge) !== '-' ? val(p.gas_charge) + ' g' : '-', 'COMPRESSOR', val(p.compressor)],
            [r[4], r[5], 'VOL.FREEZER', val(p.volume_freezer) !== '-' ? val(p.volume_freezer) + ' L' : '-', 'VOL.REFRIG.', val(p.volume_refrigerator) !== '-' ? val(p.volume_refrigerator) + ' L' : '-', 'VOL.TOTAL', val(p.volume_total) !== '-' ? val(p.volume_total) + ' L' : '-'],
        ] as const;
        gridsAB.forEach(([ry0, ry1, l1, v1, l2, v2, l3, v3]) => {
            hL(ry1 as number); vL(c1, ry0 as number, ry1 as number); vL(c2, ry0 as number, ry1 as number);
            [[X0, l1, v1], [c1, l2, v2], [c2, l3, v3]].forEach(([cx, lb, vl]) => {
                lbl(lb as string, (cx as number) + 1, (ry0 as number) + 2);
                val2(vl as string, (cx as number) + 1, (ry0 as number) + 6, 6.5);
            });
        });

        // L6
        const ps = val(p.pressure_high_low).split('/');
        hL(r[6]); vL(c1, r[5], r[6]); vL(c2, r[5], r[6]);
        [[X0, 'P.ALTA', ps[0]?.trim() || '-'], [c1, 'P.BAIXA', ps[1]?.trim() || '-'], [c2, 'CAPAC.CONG.', val(p.freezing_capacity)]].forEach(([cx, lb, vl]) => {
            lbl(lb as string, (cx as number) + 1, r[5] + 2);
            doc.setFontSize(5.5); doc.setFont('h', 'bold'); doc.setTextColor(0);
            doc.text(vl as string, (cx as number) + 1, r[5] + 6);
        });

        // L7
        vL(c1, r[6], r[7]); vL(c2, r[6], r[7]);
        lbl('Corrente', X0 + 1, r[6] + 2); val2(val(p.electric_current) !== '-' ? val(p.electric_current) + ' A' : '-', X0 + 1, r[6] + 7, 7);
        lbl('Pot.Degelo', c1 + 1, r[6] + 2); val2(val(p.defrost_power) !== '-' ? val(p.defrost_power) + ' W' : '-', c1 + 1, r[6] + 7, 7);
        lbl('Tamanho', c2 + 1, r[6] + 2);
        const ds = p.size === 'Pequeno' ? 'P' : p.size === 'Médio' ? 'M' : p.size === 'Grande' ? 'G' : (p.size || '-');
        doc.setFontSize(18); doc.setFont('h', 'bold'); doc.setTextColor(0);
        doc.text(ds, c2 + colW / 2, r[6] + 12, { align: 'center' });
    }

    return doc;
};

export const pdfToBase64 = (doc: jsPDF): string =>
    doc.output('datauristring').split(',')[1];

/** Download local como PDF */
export const printLabels = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    doc.save(`etiquetas_ambicom_${Date.now()}.pdf`);
};

/** Abrir diálogo de impressão do browser (para testes locais) */
export const printLabelsNative = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) return;
    w.addEventListener('load', () => w.print(), { once: true });
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
