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

// ─── TSPL Generator — Elgin L42 Pro (203 DPI, 8 dots/mm) ────────────────────
// Linguagem nativa da impressora: elimina 100% dos problemas de orientação/PDF.
// O firmware da Elgin processa TSPL diretamente — sem driver, sem SumatraPDF.
//
// Layout: 80×55mm = 640×440 dots @ 203 DPI
// Fontes internas: "1"=8×12 | "2"=12×20 | "3"=16×24 | "4"=24×32 | "5"=32×48 dots
//
// Uso: const tspl = generateLabelsTSPL([product]);
//      await printService.submitPrintJob({ payload_type: 'tspl', payload_data: tspl, ... });

export function generateLabelsTSPL(products: any[]): string {
    const sv = (v: any) => String(v ?? '').trim().replace(/"/g, "'").replace(/\r?\n/g, ' ') || '-';

    // ── Constantes de layout (dots, 8 dots = 1mm) ────────────────────────────
    const X0 = 24;    // margem esquerda 3mm
    const X1 = 616;   // margem direita  77mm
    const GW = X1 - X0; // 592 dots = 74mm

    const GY = 112;   // topo da grade = 14mm
    const r = [
        GY,           // r[0] = 112  topo da grade
        GY + 40,      // r[1] = 152  fim Modelo/Voltagem (5mm)
        GY + 120,     // r[2] = 232  fim QR/Serial (10mm)
        GY + 156,     // r[3] = 268  fim PNC/Freq (4.5mm)
        GY + 192,     // r[4] = 304  fim Gás/Comp (4.5mm)
        GY + 228,     // r[5] = 340  fim Volumes (4.5mm)
        GY + 264,     // r[6] = 376  fim Pressão (4.5mm)
        GY + 304,     // r[7] = 416  fundo = 52mm (+3mm margem = 55mm ✓)
    ];

    // Splits de coluna
    const c1 = X0 + Math.floor(GW / 3);           // ≈221 (3 colunas iguais)
    const c2 = X0 + Math.floor((GW / 3) * 2);     // ≈418
    const cMod = X0 + Math.floor(GW * 0.50);         // =320 (50% Modelo/Voltagem)
    const cPnc = X0 + Math.floor(GW * 0.67);         // ≈420 (67% PNC)
    const cSer = X0 + 84;                            // após QR de 10.5mm

    const lines: string[] = [
        'SIZE 80 mm,55 mm',
        'GAP 3 mm,0 mm',
        'DIRECTION 1',      // Sem rotação — feed direction normal
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
        lines.push('; === CABECALHO ===');

        // "AMBICOM" em fonte 4 (24×32 dots)
        lines.push(`TEXT ${X0},24,"4",0,1,1,"AMBICOM"`);
        lines.push(`TEXT ${X0},64,"1",0,1,1,"R. Wenceslau Marek, 10 - Aguas Belas, SJP-PR, 83010-520"`);
        lines.push(`TEXT ${X0},80,"2",0,1,1,"SAC: 041-3382-5410"`);

        // Stamp box (53mm a 77mm)
        lines.push(`BOX 424,8,616,108,2`);
        const stampCX = 520; // centro da stamp box
        ['PRODUTO', 'REMANUFATURADO', 'GARANTIA', 'AMBICOM'].forEach((t, i) => {
            const tw = t.length * 8;
            const tx = stampCX - Math.floor(tw / 2);
            lines.push(`TEXT ${tx},${16 + i * 22},"1",0,1,1,"${t}"`);
        });

        lines.push('');
        lines.push('; === GRADE TECNICA ===');
        lines.push(`BOX ${X0},${r[0]},${X1},${r[7]},2`);

        // Linha 1: MODELO | VOLTAGEM (split 50%)
        lines.push(`LINE ${X0},${r[1]},${X1},${r[1]},2`);
        lines.push(`LINE ${cMod},${r[0]},${cMod},${r[1]},2`);
        lines.push(`TEXT ${X0 + 4},${r[0] + 4},"1",0,1,1,"MODELO"`);
        lines.push(`TEXT ${X0 + 4},${r[0] + 18},"3",0,1,1,"${model}"`);
        lines.push(`TEXT ${cMod + 4},${r[0] + 4},"1",0,1,1,"VOLTAGEM"`);
        lines.push(`TEXT ${cMod + 4},${r[0] + 18},"3",0,1,1,"${voltage} V"`);

        // Linha 2: QR CODE | SERIAL
        lines.push(`LINE ${X0},${r[2]},${X1},${r[2]},2`);
        lines.push(`LINE ${cSer},${r[1]},${cSer},${r[2]},2`);
        if (serial !== '-') {
            // QRCODE x,y,correcao,tamanhoCell,modo,rotacao,"dados"
            lines.push(`QRCODE ${X0 + 2},${r[1] + 2},L,4,A,0,"${serial}"`);
        }
        lines.push(`TEXT ${cSer + 4},${r[1] + 4},"1",0,1,1,"NUMERO DE SERIE AMBICOM:"`);
        lines.push(`TEXT ${cSer + 4},${r[1] + 20},"3",0,1,1,"${serial}"`);
        if (commCode !== '-') {
            lines.push(`TEXT ${cSer + 4},${r[1] + 56},"2",0,1,1,"${commCode}"`);
        }

        // Linha 3: PNC/ML | FREQUÊNCIA (split 67%)
        lines.push(`LINE ${X0},${r[3]},${X1},${r[3]},2`);
        lines.push(`LINE ${cPnc},${r[2]},${cPnc},${r[3]},2`);
        lines.push(`TEXT ${X0 + 4},${r[2] + 4},"1",0,1,1,"PNC/ML"`);
        lines.push(`TEXT ${X0 + 4},${r[2] + 16},"2",0,1,1,"${pncMl}"`);
        lines.push(`TEXT ${cPnc + 4},${r[2] + 4},"1",0,1,1,"FREQUENCIA"`);
        lines.push(`TEXT ${cPnc + 4},${r[2] + 16},"3",0,1,1,"60 HZ"`);

        // Linha 4: GÁS | CARGA GÁS | COMPRESSOR (3 colunas)
        lines.push(`LINE ${X0},${r[4]},${X1},${r[4]},2`);
        lines.push(`LINE ${c1},${r[3]},${c1},${r[4]},2`);
        lines.push(`LINE ${c2},${r[3]},${c2},${r[4]},2`);
        lines.push(`TEXT ${X0 + 4},${r[3] + 4},"1",0,1,1,"GAS FRIGOR."`);
        lines.push(`TEXT ${X0 + 4},${r[3] + 16},"2",0,1,1,"${gas}"`);
        lines.push(`TEXT ${c1 + 4},${r[3] + 4},"1",0,1,1,"CARGA GAS"`);
        lines.push(`TEXT ${c1 + 4},${r[3] + 16},"2",0,1,1,"${gasChg !== '-' ? gasChg + ' g' : '-'}"`);
        lines.push(`TEXT ${c2 + 4},${r[3] + 4},"1",0,1,1,"COMPRESSOR"`);
        lines.push(`TEXT ${c2 + 4},${r[3] + 16},"2",0,1,1,"${comp}"`);

        // Linha 5: VOL. FREEZER | VOL. REFRIG. | VOL. TOTAL (3 colunas)
        lines.push(`LINE ${X0},${r[5]},${X1},${r[5]},2`);
        lines.push(`LINE ${c1},${r[4]},${c1},${r[5]},2`);
        lines.push(`LINE ${c2},${r[4]},${c2},${r[5]},2`);
        lines.push(`TEXT ${X0 + 4},${r[4] + 4},"1",0,1,1,"VOL. FREEZER"`);
        lines.push(`TEXT ${X0 + 4},${r[4] + 16},"2",0,1,1,"${volFrz !== '-' ? volFrz + ' L' : '-'}"`);
        lines.push(`TEXT ${c1 + 4},${r[4] + 4},"1",0,1,1,"VOL. REFRIG."`);
        lines.push(`TEXT ${c1 + 4},${r[4] + 16},"2",0,1,1,"${volRef !== '-' ? volRef + ' L' : '-'}"`);
        lines.push(`TEXT ${c2 + 4},${r[4] + 4},"1",0,1,1,"VOLUME TOTAL"`);
        lines.push(`TEXT ${c2 + 4},${r[4] + 16},"2",0,1,1,"${volTot !== '-' ? volTot + ' L' : '-'}"`);

        // Linha 6: P. ALTA | P. BAIXA | CAPAC. CONG. (3 colunas)
        lines.push(`LINE ${X0},${r[6]},${X1},${r[6]},2`);
        lines.push(`LINE ${c1},${r[5]},${c1},${r[6]},2`);
        lines.push(`LINE ${c2},${r[5]},${c2},${r[6]},2`);
        lines.push(`TEXT ${X0 + 4},${r[5] + 4},"1",0,1,1,"P. ALTA"`);
        lines.push(`TEXT ${X0 + 4},${r[5] + 16},"1",0,1,1,"${pressH}"`);
        lines.push(`TEXT ${c1 + 4},${r[5] + 4},"1",0,1,1,"P. BAIXA"`);
        lines.push(`TEXT ${c1 + 4},${r[5] + 16},"1",0,1,1,"${pressL}"`);
        lines.push(`TEXT ${c2 + 4},${r[5] + 4},"1",0,1,1,"CAPAC. CONG."`);
        lines.push(`TEXT ${c2 + 4},${r[5] + 16},"2",0,1,1,"${freezCap}"`);

        // Linha 7: CORRENTE | POT. DEGELO | TAMANHO (3 colunas)
        lines.push(`LINE ${c1},${r[6]},${c1},${r[7]},2`);
        lines.push(`LINE ${c2},${r[6]},${c2},${r[7]},2`);
        lines.push(`TEXT ${X0 + 4},${r[6] + 4},"1",0,1,1,"CORRENTE"`);
        lines.push(`TEXT ${X0 + 4},${r[6] + 16},"2",0,1,1,"${current !== '-' ? current + ' A' : '-'}"`);
        lines.push(`TEXT ${c1 + 4},${r[6] + 4},"1",0,1,1,"POT. DEGELO"`);
        lines.push(`TEXT ${c1 + 4},${r[6] + 16},"2",0,1,1,"${defrost !== '-' ? defrost + ' W' : '-'}"`);
        lines.push(`TEXT ${c2 + 4},${r[6] + 4},"1",0,1,1,"TAMANHO"`);

        // Tamanho em fonte 5 (32×48 dots) — grande e centralizado na coluna
        const colWidthDots = Math.floor(GW / 3);
        const sizeCX = c2 + Math.floor(colWidthDots / 2) - 16;
        lines.push(`TEXT ${sizeCX},${r[6] + 8},"5",0,1,1,"${dispSize}"`);

        lines.push('');
        lines.push('PRINT 1,1');
        lines.push('');
    }

    return lines.join('\r\n');
}

// ─── PDF (download local apenas) ─────────────────────────────────────────────
// Para impressão use generateLabelsTSPL → bridge (payload_type: 'tspl')
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 55], putOnlyUsedFonts: true, compress: true });

    const X0 = 3, X1 = 77, CW = X1 - X0;
    const GY = 14;
    const r = [GY, GY + 4.5, GY + 14.5, GY + 19, GY + 23.5, GY + 28, GY + 32.5, GY + 37];

    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        if (idx > 0) doc.addPage([80, 55]);
        const val = (v: any) => String(v ?? '').trim() || '-';

        // Cabeçalho
        doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(0);
        doc.text("Ambicom", X0, 5.5);
        doc.setFont("helvetica", "normal"); doc.setFontSize(4);
        doc.text("R. Wenceslau Marek, 10 - Águas Belas, SJP - PR, 83010-520", X0, 8.5);
        doc.setFont("helvetica", "bold"); doc.setFontSize(7);
        doc.text("SAC : 041 - 3382-5410", X0, 12);

        // Stamp (sem borda para caber melhor)
        doc.setFontSize(4.5);
        ["PRODUTO", "REMANUFATURADO", "GARANTIA", "AMBICOM"].forEach((t, i) =>
            doc.text(t, 69, 4 + i * 2.8, { align: 'center' })
        );

        doc.setLineWidth(0.25);

        // Grade
        const cMod = X0 + Math.floor(CW * 0.5);
        const cPnc = X0 + Math.floor(CW * 0.67);
        const colW = CW / 3;
        const c1 = X0 + colW;
        const c2 = X0 + colW * 2;
        const qrW = 9.5;
        const cSer = X0 + qrW + 1;

        const hLine = (y: number) => doc.line(X0, y, X1, y);
        const vLine = (x: number, y0: number, y1: number) => doc.line(x, y0, x, y1);
        const lbl = (txt: string, x: number, y: number) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(3.5); doc.setTextColor(80, 80, 80); doc.text(txt.toUpperCase(), x, y); };
        const valu = (txt: string, x: number, y: number, sz: number, align: 'left' | 'center' = 'left') => { doc.setFont('helvetica', 'bold'); doc.setFontSize(sz); doc.setTextColor(0); doc.text(txt, x, y, { align }); };

        // Borda externa
        doc.rect(X0, r[0], CW, r[7] - r[0]);

        // L1
        hLine(r[1]); vLine(cMod, r[0], r[1]);
        lbl('Modelo', X0 + 1, r[0] + 1.8); valu(val(p.model), X0 + 1, r[0] + 5, 9);
        lbl('Voltagem', cMod + 1, r[0] + 1.8); valu(val(p.voltage) + ' V', cMod + 1, r[0] + 5, 9);

        // L2
        hLine(r[2]); vLine(cSer, r[1], r[2]);
        if (val(p.internal_serial) !== '-') {
            try {
                const qr = await QRCode.toDataURL(val(p.internal_serial), { margin: 0, width: 120 });
                doc.addImage(qr, 'PNG', X0 + 0.5, r[1] + 0.5, qrW, qrW);
            } catch { /* silencioso */ }
        }
        lbl('Número de Série Ambicom:', cSer + 1, r[1] + 2);
        valu(val(p.internal_serial), cSer + 1, r[1] + 6, 9);
        if (val(p.commercial_code) !== '-') { doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.text(val(p.commercial_code), cSer + 1, r[2] - 1); }

        // L3
        hLine(r[3]); vLine(cPnc, r[2], r[3]);
        lbl('PNC/ML', X0 + 1, r[2] + 1.8); valu(val(p.pnc_ml), X0 + 1, r[2] + 4.5, 8);
        lbl('Frequência', cPnc + 1, r[2] + 1.8); valu('60 Hz', cPnc + 1, r[2] + 4.5, 7.5);

        // L4, L5
        [[r[3], r[4], 'GÁS FRIGOR.', val(p.refrigerant_gas), 'CARGA GÁS', val(p.gas_charge) !== '-' ? val(p.gas_charge) + ' g' : '-', 'COMPRESSOR', val(p.compressor)],
        [r[4], r[5], 'VOL. FREEZER', val(p.volume_freezer) !== '-' ? val(p.volume_freezer) + ' L' : '-', 'VOL. REFRIG.', val(p.volume_refrigerator) !== '-' ? val(p.volume_refrigerator) + ' L' : '-', 'VOL. TOTAL', val(p.volume_total) !== '-' ? val(p.volume_total) + ' L' : '-']
        ].forEach(([r0, r1, l1, v1, l2, v2, l3, v3]) => {
            hLine(r1 as number);
            vLine(c1, r0 as number, r1 as number); vLine(c2, r0 as number, r1 as number);
            [[X0, l1, v1], [c1, l2, v2], [c2, l3, v3]].forEach(([cx, lb, vl]) => {
                lbl(lb as string, (cx as number) + 1, (r0 as number) + 1.8);
                valu(vl as string, (cx as number) + 1, (r0 as number) + 4.5, 7.5);
            });
        });

        // L6
        hLine(r[6]); vLine(c1, r[5], r[6]); vLine(c2, r[5], r[6]);
        const ps = val(p.pressure_high_low).split('/');
        [[X0, 'P. ALTA', ps[0]?.trim() || '-'], [c1, 'P. BAIXA', ps[1]?.trim() || '-'], [c2, 'CAPAC. CONG.', val(p.freezing_capacity)]].forEach(([cx, lb, vl]) => {
            lbl(lb as string, (cx as number) + 1, r[5] + 1.8);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(0);
            doc.text(vl as string, (cx as number) + 1, r[5] + 4.5);
        });

        // L7
        vLine(c1, r[6], r[7]); vLine(c2, r[6], r[7]);
        lbl('Corrente', X0 + 1, r[6] + 1.8); valu(val(p.electric_current) !== '-' ? val(p.electric_current) + ' A' : '-', X0 + 1, r[6] + 4.5, 7.5);
        lbl('Pot. Degelo', c1 + 1, r[6] + 1.8); valu(val(p.defrost_power) !== '-' ? val(p.defrost_power) + ' W' : '-', c1 + 1, r[6] + 4.5, 7.5);
        lbl('Tamanho', c2 + 1, r[6] + 1.8);

        const sz = p.size;
        const ds = sz === 'Pequeno' ? 'P' : sz === 'Médio' ? 'M' : sz === 'Grande' ? 'G' : (sz || '-');
        valu(ds, c2 + (X1 - c2) / 2, r[6] + 5, 10, 'center');
    }

    return doc;
};

export const pdfToBase64 = (doc: jsPDF): string =>
    doc.output('datauristring').split(',')[1];

/** Baixar etiqueta como PDF (apenas local, sem impressão via bridge) */
export const printLabels = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    doc.save(`etiquetas_ambicom_${Date.now()}.pdf`);
};

/** Abrir diálogo de impressão nativo do browser (para testes locais) */
export const printLabelsNative = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) return;
    w.addEventListener('load', () => w.print(), { once: true });
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
