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

// ─── TSPL Generator — Elgin L42 Pro (SINTAXE RIGOROSA 80x55) ──────────────────
export function generateLabelsTSPL(products: any[]): string {
    const sv = (v: any) => String(v ?? '').trim().replace(/"/g, "'").replace(/\r?\n/g, ' ') || '-';

    const clean = (val: string, unit: string) => {
        if (!val || val === '-') return '-';
        const cleanVal = val.replace(new RegExp(`\\s*${unit}$`, 'i'), '').trim();
        return `${cleanVal} ${unit}`;
    };

    // Mapeamento manual 90° CW para bobina deitada (80x55)
    // Design Portrait 55x80 -> Físico Landscape 80x55
    const mapX = (py: number) => 620 - py; // Subtração para inverter eixo Y design p/ X físico
    const mapY = (px: number) => px + 10;   // Margem de segurança no avanço

    const lines: string[] = [
        'SIZE 80 mm,55 mm',
        'GAP 3 mm,0 mm',
        'DIRECTION 1',
        'OFFSET 0 mm',
        'CLS',
        'CODEPAGE UTF-8',
    ];

    for (const p of products) {
        // Coordenadas Design (Retrato)
        const X0 = 10, X1 = 420;
        const GY = 110;
        const r = [GY, GY + 55, GY + 160, GY + 215, GY + 270, GY + 325, GY + 380, GY + 490];
        const cMod = 220, cSer = 100, c1 = 145, c2 = 285;

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

        // Cabeçalho
        lines.push(`TEXT ${mapX(10)},${mapY(X0)},"3",90,1,1,"AMBICOM"`);
        lines.push(`TEXT ${mapX(40)},${mapY(X0)},"1",90,1,1,"R. Wenceslau Marek, 10 - SJP/PR"`);
        lines.push(`TEXT ${mapX(70)},${mapY(X0)},"2",90,1,1,"SAC: 041-3382-5410"`);

        // Grade (BOX x,y,x,y,t) - Garantindo x1 < x2
        const xA = mapX(r[7]), xB = mapX(GY);
        lines.push(`BOX ${xA},${mapY(X0)},${xB},${mapY(X1)},2`);

        // Linhas de Divisão (Design horizontal -> Físico Vertical)
        [r[1], r[2], r[3], r[4], r[5], r[6]].forEach(y => {
            const tx = mapX(y);
            lines.push(`LINE ${tx},${mapY(X0)},${tx},${mapY(X1)},2`);
        });

        // Divisores de Coluna (Design vertical -> Físico Horizontal)
        lines.push(`LINE ${mapX(GY)},${mapY(cMod)},${mapX(r[1])},${mapY(cMod)},2`);
        lines.push(`LINE ${mapX(r[1])},${mapY(cSer)},${mapX(r[2])},${mapY(cSer)},2`);
        lines.push(`LINE ${mapX(r[3])},${mapY(c1)},${mapX(r[7])},${mapY(c1)},2`);
        lines.push(`LINE ${mapX(r[3])},${mapY(c2)},${mapX(r[7])},${mapY(c2)},2`);

        // Textos da Grade
        lines.push(`TEXT ${mapX(GY + 5)},${mapY(X0 + 5)},"1",90,1,1,"MODELO"`);
        lines.push(`TEXT ${mapX(GY + 25)},${mapY(X0 + 5)},"3",90,1,1,"${model}"`);
        lines.push(`TEXT ${mapX(GY + 5)},${mapY(cMod + 5)},"1",90,1,1,"VOLTAGEM"`);
        lines.push(`TEXT ${mapX(GY + 25)},${mapY(cMod + 5)},"3",90,1,1,"${voltage}"`);

        lines.push(`TEXT ${mapX(r[1] + 5)},${mapY(cSer + 5)},"1",90,1,1,"SERIE:"`);
        lines.push(`TEXT ${mapX(r[1] + 25)},${mapY(cSer + 5)},"2",90,1,1,"${serial}"`);
        if (serial !== '-') {
            // QRCODE X,Y,ECC,CellWidth,Mode,Rotation,"data"
            lines.push(`QRCODE ${mapX(r[1] + 140)},${mapY(X0 + 5)},L,4,A,90,"${serial}"`);
        }

        lines.push(`TEXT ${mapX(r[2] + 5)},${mapY(X0 + 5)},"1",90,1,1,"PNC/ML"`);
        lines.push(`TEXT ${mapX(r[2] + 25)},${mapY(X0 + 5)},"2",90,1,1,"${pncMl}"`);

        // L4 Gas
        lines.push(`TEXT ${mapX(r[3] + 4)},${mapY(X0 + 4)},"1",90,1,1,"GAS"`); lines.push(`TEXT ${mapX(r[3] + 20)},${mapY(X0 + 4)},"2",90,1,1,"${gas}"`);
        lines.push(`TEXT ${mapX(r[3] + 4)},${mapY(c1 + 4)},"1",90,1,1,"CARGA"`); lines.push(`TEXT ${mapX(r[3] + 20)},${mapY(c1 + 4)},"2",90,1,1,"${gasChg}"`);
        lines.push(`TEXT ${mapX(r[3] + 4)},${mapY(c2 + 4)},"1",90,1,1,"COMP."`); lines.push(`TEXT ${mapX(r[3] + 20)},${mapY(c2 + 4)},"2",90,1,1,"${comp}"`);

        // L5 Vols
        lines.push(`TEXT ${mapX(r[4] + 4)},${mapY(X0 + 4)},"1",90,1,1,"FREEZ"`); lines.push(`TEXT ${mapX(r[4] + 20)},${mapY(X0 + 4)},"2",90,1,1,"${volFrz}"`);
        lines.push(`TEXT ${mapX(r[4] + 4)},${mapY(c1 + 4)},"1",90,1,1,"REFRIG"`); lines.push(`TEXT ${mapX(r[4] + 20)},${mapY(c1 + 4)},"2",90,1,1,"${volRef}"`);
        lines.push(`TEXT ${mapX(r[4] + 4)},${mapY(c2 + 4)},"1",90,1,1,"TOTAL"`); lines.push(`TEXT ${mapX(r[4] + 20)},${mapY(c2 + 4)},"2",90,1,1,"${volTot}"`);

        // L7 Base
        lines.push(`TEXT ${mapX(r[6] + 4)},${mapY(X0 + 4)},"1",90,1,1,"CORRENTE"`); lines.push(`TEXT ${mapX(r[6] + 20)},${mapY(X0 + 4)},"3",90,1,1,"${current}"`);
        lines.push(`TEXT ${mapX(r[6] + 4)},${mapY(c1 + 4)},"1",90,1,1,"POTENCIA"`); lines.push(`TEXT ${mapX(r[6] + 20)},${mapY(c1 + 4)},"3",90,1,1,"${defrost}"`);
        lines.push(`TEXT ${mapX(r[6] + 4)},${mapY(c2 + 4)},"1",90,1,1,"TAM."`);
        lines.push(`TEXT ${mapX(r[6] + 50)},${mapY(c2 + 45)},"5",90,1,1,"${dispSize}"`);

        lines.push('PRINT 1,1');
    }
    return lines.join('\r\n');
}

// ─── PDF (Fiel à Visualização Retrato 55x80) ─────────────────────────────────
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [55, 80], compress: true });

    const cleanStr = (val: string, unit: string) => {
        const s = String(val ?? '').trim();
        if (!s || s === '-') return '-';
        const cleanVal = s.replace(new RegExp(`\\s*${unit}$`, 'i'), '').trim();
        return `${cleanVal} ${unit}`;
    };

    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        if (idx > 0) doc.addPage([55, 80], 'p');
        const val = (v: any) => String(v ?? '').trim() || '-';

        const X0 = 2, X1 = 53, CW = X1 - X0;
        const GY = 14;
        const r = [GY, GY + 7, GY + 20, GY + 27, GY + 34, GY + 41, GY + 48, GY + 62];
        const c1 = X0 + (CW / 3), c2 = X0 + (CW * 2 / 3), cMod = X0 + (CW * 0.5), cSer = X0 + 10;

        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("AMBICOM", X0, 6);
        doc.setFontSize(4); doc.setFont("helvetica", "normal");
        doc.text("R. Wenceslau Marek, 10 - SJP/PR", X0, 9);
        doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
        doc.text("SAC: 041-3382-5410", X0, 12.5);

        doc.rect(X0, r[0], CW, r[7] - r[0]);
        // L1
        doc.line(X0, r[1], X1, r[1]); doc.line(cMod, r[0], cMod, r[1]);
        doc.setFontSize(3.5); doc.setFont("helvetica", "normal"); doc.text("MODELO", X0 + 1, r[0] + 2.5);
        doc.setFontSize(3.5); doc.text("VOLTAGEM", cMod + 1, r[0] + 2.5);
        doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text(val(p.model || p.modelo), X0 + 1, r[0] + 6.5);
        doc.text(cleanStr(val(p.voltage || p.tensao), 'V'), cMod + 1, r[0] + 6.5);

        // L2
        doc.line(X0, r[2], X1, r[2]); doc.line(cSer, r[1], cSer, r[2]);
        if (val(p.internal_serial) !== '-') {
            try { const qr = await QRCode.toDataURL(val(p.internal_serial), { margin: 0 }); doc.addImage(qr, 'PNG', X0 + 0.5, r[1] + 0.5, 9, 9); } catch { }
        }
        doc.setFontSize(3.5); doc.setFont("helvetica", "normal"); doc.text("SERIE:", cSer + 1, r[1] + 3);
        doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.text(val(p.internal_serial), cSer + 1, r[1] + 7);

        // L3-L6
        [r[3], r[4], r[5], r[6]].forEach(y => doc.line(X0, y, X1, y));
        [c1, c2].forEach(x => doc.line(x, r[2], x, r[7]));

        doc.setFontSize(3.5); doc.setFont("helvetica", "normal");
        doc.text("PNC/ML", X0 + 1, r[2] + 2.5); doc.text("GAS", X0 + 1, r[3] + 2.5); doc.text("CARGA", c1 + 1, r[3] + 2.5); doc.text("COMP.", c2 + 1, r[3] + 2.5);
        doc.text("FREEZ", X0 + 1, r[4] + 2.5); doc.text("REFRIG", c1 + 1, r[4] + 2.5); doc.text("TOTAL", c2 + 1, r[4] + 2.5);
        doc.text("CORRENTE", X0 + 1, r[6] + 2.5); doc.text("POTENCIA", c1 + 1, r[6] + 2.5); doc.text("TAM.", c2 + 1, r[6] + 2.5);

        doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
        doc.text(val(p.pnc_ml), X0 + 1, r[2] + 6);
        doc.text(val(p.refrigerant_gas), X0 + 1, r[3] + 6); doc.text(cleanStr(val(p.gas_charge), 'g'), c1 + 1, r[3] + 6); doc.text(val(p.compressor), c2 + 1, r[3] + 6);
        doc.text(cleanStr(val(p.volume_freezer), 'L'), X0 + 1, r[4] + 6); doc.text(cleanStr(val(p.volume_refrigerator), 'L'), c1 + 1, r[4] + 6); doc.text(cleanStr(val(p.volume_total), 'L'), c2 + 1, r[4] + 6);
        doc.text(cleanStr(val(p.electric_current), 'A'), X0 + 1, r[6] + 6); doc.text(cleanStr(val(p.defrost_power), 'W'), c1 + 1, r[6] + 6);

        doc.setFontSize(22); doc.text(dispSize, c2 + (X1 - c2) / 2, r[7] - 2, { align: 'center' });
    }
    return doc;
};

export const pdfToBase64 = (doc: jsPDF): string => doc.output('datauristring').split(',')[1];
export const printLabels = async (products: any[]) => { const doc = await generateLabelsPDF(products); doc.save(`etiquetas_ambicom_${Date.now()}.pdf`); };
export const printLabelsNative = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) { w.addEventListener('load', () => w.print(), { once: true }); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
};
