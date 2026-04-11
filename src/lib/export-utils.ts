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

// ─── PDF (Rotacionado 90º Paisagem 80x55 baseado no Layout Antigo) ─────────────────────────────────
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    // Gerar em paisagem (Landscape) para coincidir com a impressora física de etiquetas (80x55)
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: [80, 55], compress: true });

    // Helpers para rotação 90º Clockwise
    // Mapeia coordenadas do layout retrato original (55x80) para paisagem (80x55)
    // O layout original tinha proporções para 100x135, faremos um downscale de aprox 0.55x
    const rotX = (x: number, y: number) => 80 - y;
    const rotY = (x: number, y: number) => x;

    const drawText = (text: string, x: number, y: number, options?: any) => {
        const str = String(text);
        let finalX = x;
        const finalY = y;
        
        // jsPDF's native align breaks when combined with our manual 90-degree coordinate rotation.
        // We calculate the alignment offset manually in the original portrait coordinate space.
        if (options?.align === 'center') {
            const w = doc.getTextWidth(str);
            finalX = x - w / 2;
        } else if (options?.align === 'right') {
            const w = doc.getTextWidth(str);
            finalX = x - w;
        }
        
        const jsPdfOptions = { ...options };
        delete jsPdfOptions.align;
        jsPdfOptions.angle = -90;
        
        doc.text(str, rotX(finalX, finalY), rotY(finalX, finalY), jsPdfOptions);
    };
    
    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
        doc.line(rotX(x1, y1), rotY(x1, y1), rotX(x2, y2), rotY(x2, y2));
    };

    for (let idx = 0; idx < products.length; idx++) {
        const p = products[idx];
        if (idx > 0) doc.addPage([80, 55], 'l');
        const val = (v: any) => String(v ?? '').trim() || '';

        // Fator de escala de 100x135 para 55x80 (aprox 0.55 na largura e 0.59 na altura)
        // Usaremos 0.55 para X e 0.55 para Y para manter a proporção consistente
        const scale = 0.55;
        const sX = (x: number) => x * scale;
        const sY = (y: number) => y * 0.59; // Ajuste fino para caber em 80mm de altura
        
        // --- Header Section ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12); // scaled from 22
        drawText("Ambicom", sX(8), sY(12));

        // Subtitle (Right aligned block)
        doc.setFontSize(4); // scaled from 7
        doc.setFont("helvetica", "bold");
        const subtitleX = sX(68);
        drawText("PRODUTO", subtitleX + sX(5), sY(10));
        drawText("REMANUFATURADO", subtitleX, sY(13));
        drawText("GARANTIA", subtitleX + sX(4), sY(16));
        drawText("AMBICOM", subtitleX + sX(4.5), sY(19));

        // Address & SAC
        doc.setFont("helvetica", "normal");
        doc.setFontSize(3.5); // scaled from 6.5
        drawText("R. Wenceslau Marek, 10 - Águas Belas,", sX(8), sY(17));
        drawText("São José dos Pinhais - PR, 83010-520", sX(8), sY(20));

        doc.setFontSize(8); // scaled from 14
        doc.setFont("helvetica", "bold");
        drawText(`SAC : 041 - 3382-5410`, sX(8), sY(26));

        // --- Grid Section ---
        let currentY = 28;
        doc.setLineWidth(0.2); // scaled from 0.4

        // Row 1: MODELO | VOLTAGEM
        drawLine(sX(8), sY(currentY), sX(92), sY(currentY)); // Horizontal Top
        drawLine(sX(45), sY(currentY), sX(45), sY(currentY + 12)); // Vertical Divider

        doc.setFontSize(3.5); // scaled from 6.5
        drawText("MODELO", sX(26), sY(currentY + 4), { align: 'center' });
        doc.setFontSize(10); // scaled from 18
        drawText(val(p.model || p.modelo), sX(26), sY(currentY + 10), { align: 'center' });

        doc.setFontSize(3.5);
        drawText("VOLTAGEM", sX(68.5), sY(currentY + 4), { align: 'center' });
        doc.setFontSize(10);
        drawText(val(p.voltage || p.tensao), sX(68.5), sY(currentY + 10), { align: 'center' });

        currentY += 12;
        drawLine(sX(8), sY(currentY), sX(92), sY(currentY)); // Divider

        // Row 2: NÚMERO DE SÉRIE AMBICOM (With QR code on the left)
        const qrData = val(p.internal_serial).trim();
        if (qrData && qrData !== '-') {
            try {
                const qrImgData = await QRCode.toDataURL(qrData, {
                    margin: 0,
                    width: 100,
                    color: { dark: "#000000", light: "#ffffff" }
                });
                const imgSize = sX(15);
                // A posição no PDF rotacionado: x=rotX, y=rotY. Lembre-se que width e height invertem.
                const imgX = sX(10);
                const imgY = sY(currentY + 1);
                doc.addImage(qrImgData, 'PNG', rotX(imgX, imgY + imgSize), rotY(imgX, imgY + imgSize), imgSize, imgSize);
            } catch (err) { }
        }

        doc.setFontSize(3.5);
        drawText("NÚMERO DE SÉRIE AMBICOM:", sX(59), sY(currentY + 3), { align: 'center' });
        doc.setFontSize(10);
        drawText(val(p.internal_serial), sX(59), sY(currentY + 9), { align: 'center' });
        doc.setFontSize(9); // scaled from 16
        drawText(val(p.commercial_code), sX(59), sY(currentY + 15), { align: 'center' });

        currentY += 17;
        drawLine(sX(8), sY(currentY), sX(92), sY(currentY)); // Divider

        // Row 3: PNC/ML | Frequência
        drawLine(sX(60), sY(currentY), sX(60), sY(currentY + 10)); // Vertical
        doc.setFontSize(3.5);
        drawText("PNC/ML", sX(34), sY(currentY + 2.5), { align: 'center' });
        doc.setFontSize(10);
        drawText(val(p.pnc_ml), sX(34), sY(currentY + 8.5), { align: 'center' });

        doc.setFontSize(9);
        drawText(val(p.frequency) || "60 Hz", sX(76), sY(currentY + 7.5), { align: 'center' });

        currentY += 10;
        drawLine(sX(8), sY(currentY), sX(92), sY(currentY)); // Divider

        // Row 4: GÁS FRIGOR. | CARGA GÁS | COMPRESSOR
        drawLine(sX(34), sY(currentY), sX(34), sY(currentY + 12));
        drawLine(sX(60), sY(currentY), sX(60), sY(currentY + 12));

        doc.setFontSize(3.5);
        drawText("GÁS FRIGOR.", sX(21), sY(currentY + 2.5), { align: 'center' });
        doc.setFontSize(6.5); // scaled from 12
        drawText(val(p.refrigerant_gas), sX(21), sY(currentY + 8), { align: 'center' });

        doc.setFontSize(3.5);
        drawText("CARGA GÁS", sX(47), sY(currentY + 2.5), { align: 'center' });
        doc.setFontSize(9);
        drawText(val(p.gas_charge), sX(47), sY(currentY + 8), { align: 'center' });

        doc.setFontSize(3.5);
        drawText("COMPRESSOR", sX(76), sY(currentY + 2.5), { align: 'center' });
        doc.setFontSize(5.5); // scaled from 10
        drawText(val(p.compressor), sX(76), sY(currentY + 8), { align: 'center' });

        currentY += 12;
        drawLine(sX(8), sY(currentY), sX(92), sY(currentY));

        // Row 5: VOL. FREEZER | VOL. REFRIG. | VOLUME TOTAL
        drawLine(sX(34), sY(currentY), sX(34), sY(currentY + 12));
        drawLine(sX(60), sY(currentY), sX(60), sY(currentY + 12));

        doc.setFontSize(3.5);
        drawText("VOL. FREEZER", sX(21), sY(currentY + 2.5), { align: 'center' });
        doc.setFontSize(6.5);
        drawText(val(p.volume_freezer), sX(21), sY(currentY + 8), { align: 'center' });

        doc.setFontSize(3.5);
        drawText("VOL. REFRIG.", sX(47), sY(currentY + 2.5), { align: 'center' });
        doc.setFontSize(6.5);
        drawText(val(p.volume_refrigerator), sX(47), sY(currentY + 8), { align: 'center' });

        doc.setFontSize(3.5);
        drawText("VOLUME TOTAL", sX(76), sY(currentY + 2.5), { align: 'center' });
        doc.setFontSize(6.5);
        drawText(val(p.volume_total), sX(76), sY(currentY + 8), { align: 'center' });

        currentY += 12;
        drawLine(sX(8), sY(currentY), sX(92), sY(currentY));

        // Row 6: PRESSÃO ALTA | PRESSÃO BAIXA | CAPAC. CONG.
        drawLine(sX(34), sY(currentY), sX(34), sY(currentY + 12));
        drawLine(sX(60), sY(currentY), sX(60), sY(currentY + 12));

        doc.setFontSize(3.5);
        drawText("PRESSÃO ALTA", sX(21), sY(currentY + 2.5), { align: 'center' });
        doc.setFontSize(5); // scaled from 9
        
        const pressures = String(p.pressure_high_low || "").split('/');
        drawText(val(pressures[0]), sX(21), sY(currentY + 8), { align: 'center' });

        doc.setFontSize(3.5);
        drawText("PRESSÃO BAIXA", sX(47), sY(currentY + 2.5), { align: 'center' });
        doc.setFontSize(5);
        drawText(val(pressures[1]), sX(47), sY(currentY + 8), { align: 'center' });

        doc.setFontSize(3.5);
        drawText("CAPAC. CONG.", sX(76), sY(currentY + 2.5), { align: 'center' });
        doc.setFontSize(5.5);
        drawText(val(p.freezing_capacity), sX(76), sY(currentY + 8), { align: 'center' });

        currentY += 12;
        drawLine(sX(8), sY(currentY), sX(92), sY(currentY));

        // Row 7: CORRENTE | POT. DEGELO | GRADE
        drawLine(sX(34), sY(currentY), sX(34), sY(currentY + 12));
        drawLine(sX(60), sY(currentY), sX(60), sY(currentY + 12));

        doc.setFontSize(3.5);
        drawText("CORRENTE", sX(21), sY(currentY + 2.5), { align: 'center' });
        doc.setFontSize(6.5);
        drawText(val(p.electric_current), sX(21), sY(currentY + 8), { align: 'center' });

        doc.setFontSize(3.5);
        drawText("POT. DEGELO", sX(47), sY(currentY + 2.5), { align: 'center' });
        doc.setFontSize(6.5);
        drawText(val(p.defrost_power), sX(47), sY(currentY + 8), { align: 'center' });

        doc.setFontSize(3.5);
        drawText("TAMANHO", sX(76), sY(currentY + 2.5), { align: 'center' });
        doc.setFontSize(8); // scaled from 14

        // Map size to initial
        const fullSize = p.size || '';
        const displaySize = fullSize === 'Pequeno' ? 'P' : fullSize === 'Médio' ? 'M' : fullSize === 'Grande' ? 'G' : fullSize;

        drawText(displaySize, sX(76), sY(currentY + 9), { align: 'center' });

        currentY += 12;

        // Vertical Border edges
        drawLine(sX(8), sY(28), sX(8), sY(currentY));
        drawLine(sX(92), sY(28), sX(92), sY(currentY));
        drawLine(sX(8), sY(currentY), sX(92), sY(currentY)); // Bottom border line
    }
    return doc;
};

export const pdfToBase64 = (doc: jsPDF): string => doc.output('datauristring').split(',')[1];
export const printLabels = async (products: any[]) => { const doc = await generateLabelsPDF(products); doc.save(`etiquetas_ambicom_${Date.now()}.pdf`); };

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
