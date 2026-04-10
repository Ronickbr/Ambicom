import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';
import { calculateProductSize } from './product-utils';

/**
 * Exporta dados de tabela para PDF (Relatório A4)
 */
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

/**
 * Exporta dados para Excel
 */
export const exportToExcel = (data: Record<string, unknown>[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
    XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
};

// ─── Helpers internos ─────────────────────────────────────────────────────────

function sanitize(v: any): string {
    return String(v || '').replace(/[VLgWAsig()]/g, '').trim() || '-';
}

// ─── Builder HTML da Etiqueta ─────────────────────────────────────────────────

/**
 * Retorna o HTML completo de uma etiqueta Ambicom (80x55mm landscape).
 *
 * Pode ser usado:
 * 1. Via jsPDF.html() → PDF para envio ao bridge (impressão remota)
 * 2. Via window.open() + window.print() → impressão nativa do browser
 */
export async function buildLabelHTML(p: any): Promise<string> {
    const model = sanitize(p.model || p.modelo);
    const voltage = sanitize(p.voltage || p.tensao);
    const serial = sanitize(p.internal_serial);
    const commCode = sanitize(p.commercial_code);
    const pncMl = sanitize(p.pnc_ml);
    const gas = sanitize(p.refrigerant_gas);
    const gasCharge = sanitize(p.gas_charge);
    const gasDesc = gas !== '-' ? `${gas} ${gasCharge}g` : '-';
    const volFreezer = sanitize(p.volume_freezer);
    const volRefrig = sanitize(p.volume_refrigerator);
    const volTotal = sanitize(p.volume_total);
    const sizeFull = p.size || await calculateProductSize(p.volume_total);
    const dispSize = sizeFull === 'Pequeno' ? 'P'
        : sizeFull === 'Médio' ? 'M'
            : sizeFull === 'Grande' ? 'G'
                : (sizeFull || '-');

    let qrImgTag = '';
    if (serial && serial !== '-') {
        try {
            const qrDataUrl = await QRCode.toDataURL(serial, {
                margin: 0,
                width: 120,
                errorCorrectionLevel: 'M',
            });
            qrImgTag = `<img src="${qrDataUrl}" alt="QR" style="width:18mm;height:18mm;display:block;" />`;
        } catch { /* QR opcional */ }
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  @page {
    size: 80mm 55mm landscape;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 80mm;
    height: 55mm;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 6pt;
    color: #000;
    background: #fff;
    overflow: hidden;
  }

  /* ── Layout raiz ── */
  .label {
    width: 78mm;
    height: 53mm;
    margin: 1mm;
    display: grid;
    grid-template-rows: auto 1fr;
    border: 0.4pt solid #000;
  }

  /* ── Cabeçalho ── */
  .header {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    padding: 1mm 2mm 0.5mm 2mm;
    border-bottom: 0.4pt solid #000;
  }
  .brand-name    { font-size: 16pt; font-weight: 900; line-height: 1; letter-spacing: -0.5pt; }
  .brand-address { font-size: 5pt;  line-height: 1.3; margin-top: 1pt; }
  .brand-sac     { font-size: 7pt;  font-weight: bold; margin-top: 2pt; }
  .brand-right {
    text-align: center;
    font-size: 5.5pt;
    font-weight: bold;
    line-height: 1.4;
    border: 0.4pt solid #000;
    padding: 1mm;
    white-space: nowrap;
  }

  /* ── Grade de campos ── */
  .data-grid { display: grid; width: 100%; height: 100%; }

  .row-1 { display: grid; grid-template-columns: 3fr 1fr; border-bottom: 0.4pt solid #000; }
  .row-2 { display: grid; grid-template-columns: 20mm 1fr; border-bottom: 0.4pt solid #000; }
  .row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; border-bottom: 0.4pt solid #000; }
  .row-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; }

  /* Célula genérica */
  .cell {
    padding: 0.5mm 1.5mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
  }
  .cell + .cell { border-left: 0.4pt solid #000; }

  .lbl {
    font-size: 4.5pt;
    font-weight: normal;
    text-transform: uppercase;
    color: #333;
    line-height: 1;
    white-space: nowrap;
  }
  .val    { font-size: 10pt; font-weight: 900;  line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .val-lg { font-size: 13pt; font-weight: 900;  line-height: 1; }
  .val-sm { font-size: 8pt;  font-weight: bold; }

  /* Célula do QR */
  .qr-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    border-right: 0.4pt solid #000;
    padding: 1mm;
  }
  .serial-cell {
    padding: 1mm 2mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1pt;
  }
</style>
</head>
<body>
<div class="label">

  <!-- CABEÇALHO -->
  <div class="header">
    <div>
      <div class="brand-name">Ambicom</div>
      <div class="brand-address">
        R. Wenceslau Marek, 10 – Águas Belas,<br/>
        São José dos Pinhais – PR, 83010-520
      </div>
      <div class="brand-sac">SAC: 041 - 3382-5410</div>
    </div>
    <div class="brand-right">
      PRODUTO<br/>REMANUFATURADO<br/>GARANTIA<br/>AMBICOM
    </div>
  </div>

  <!-- GRADE -->
  <div class="data-grid">

    <!-- Linha 1: MODELO │ VOLTAGEM -->
    <div class="row-1">
      <div class="cell">
        <span class="lbl">Modelo</span>
        <span class="val-lg">${model}</span>
      </div>
      <div class="cell">
        <span class="lbl">Voltagem</span>
        <span class="val-lg">${voltage} V</span>
      </div>
    </div>

    <!-- Linha 2: QR CODE │ SERIAL + CÓD. COMERCIAL -->
    <div class="row-2">
      <div class="qr-cell">
        ${qrImgTag}
      </div>
      <div class="serial-cell">
        <span class="lbl">Número de Série Ambicom</span>
        <span class="val-lg" style="font-size:12pt;">${serial}</span>
        ${commCode !== '-' ? `<span style="font-size:6pt;color:#555;">${commCode}</span>` : ''}
      </div>
    </div>

    <!-- Linha 3: PNC/ML │ GÁS FRIGOR. │ FREQUÊNCIA -->
    <div class="row-3">
      <div class="cell">
        <span class="lbl">PNC / ML</span>
        <span class="val">${pncMl}</span>
      </div>
      <div class="cell">
        <span class="lbl">Gás Frigor.</span>
        <span class="val-sm">${gasDesc}</span>
      </div>
      <div class="cell">
        <span class="lbl">Frequência</span>
        <span class="val">60 Hz</span>
      </div>
    </div>

    <!-- Linha 4: VOL. FREEZER │ VOL. REFRIG. │ VOL. TOTAL │ TAMANHO -->
    <div class="row-4">
      <div class="cell">
        <span class="lbl">Vol. Freezer</span>
        <span class="val-sm">${volFreezer} L</span>
      </div>
      <div class="cell">
        <span class="lbl">Vol. Refrig.</span>
        <span class="val-sm">${volRefrig} L</span>
      </div>
      <div class="cell">
        <span class="lbl">Vol. Total</span>
        <span class="val-sm">${volTotal} L</span>
      </div>
      <div class="cell" style="align-items:center;justify-content:center;text-align:center;">
        <span class="lbl">Tamanho</span>
        <span style="font-size:18pt;font-weight:900;line-height:1;">${dispSize}</span>
      </div>
    </div>

  </div><!-- /data-grid -->
</div><!-- /label -->
</body>
</html>`;
}

// ─── Geração de PDF ───────────────────────────────────────────────────────────

/**
 * Gera as etiquetas em formato PDF Industrial (80×55mm landscape)
 * usando HTML+CSS renderizado via iframe oculto → jsPDF.html()
 */
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    const W = 80, H = 55;

    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [W, H],
        putOnlyUsedFonts: true,
        compress: true,
    });

    for (let i = 0; i < products.length; i++) {
        if (i > 0) doc.addPage([W, H], 'landscape');

        const html = await buildLabelHTML(products[i]);

        await new Promise<void>((resolve, reject) => {
            // Iframe oculto para isolamento de CSS
            const iframe = document.createElement('iframe');
            iframe.style.cssText = [
                'position:fixed',
                'left:-9999px',
                'top:-9999px',
                // 80mm @ 96 dpi ≈ 302px | 55mm @ 96 dpi ≈ 208px
                'width:302px',
                'height:208px',
                'border:none',
                'visibility:hidden',
            ].join(';');
            document.body.appendChild(iframe);

            iframe.onload = async () => {
                try {
                    const iDoc = iframe.contentDocument!;
                    iDoc.open();
                    iDoc.write(html);
                    iDoc.close();

                    // Aguarda imagens (QR Code data URL) carregarem
                    await new Promise(r => setTimeout(r, 400));

                    await (doc as any).html(iDoc.body, {
                        x: 0,
                        y: 0,
                        width: W,
                        windowWidth: 302,
                        html2canvas: {
                            scale: 3.78, // 96 dpi → 360 dpi (~300dpi industrial)
                            useCORS: true,
                            backgroundColor: '#ffffff',
                            logging: false,
                        },
                        autoPaging: false,
                    });

                    resolve();
                } catch (err) {
                    reject(err);
                } finally {
                    document.body.removeChild(iframe);
                }
            };

            iframe.src = 'about:blank';
        });
    }

    return doc;
};

// ─── Exports utilitários ──────────────────────────────────────────────────────

/**
 * Converte um Documento jsPDF para String Base64 (sem prefixo data:)
 */
export const pdfToBase64 = (doc: jsPDF): string => {
    return doc.output('datauristring').split(',')[1];
};

/**
 * Baixa as etiquetas como arquivo PDF.
 */
export const printLabels = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    doc.save(`etiquetas_ambicom_${Date.now()}.pdf`);
};

/**
 * Abre uma janela de impressão nativa do browser com CSS @page correto.
 * Útil quando não há bridge remoto disponível – imprime direto pelo SO.
 */
export const printLabelsNative = async (products: any[]) => {
    const pages = await Promise.all(products.map(p => buildLabelHTML(p)));

    // Extrai o <body> de cada etiqueta e separa por page-break
    const combined = pages.map((html, idx) => {
        const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const body = m ? m[1] : html;
        const pb = idx < pages.length - 1 ? 'always' : 'avoid';
        return `<div style="page-break-after:${pb}">${body}</div>`;
    }).join('');

    const doc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  @page { size: 80mm 55mm landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 80mm; font-family: Arial, Helvetica, sans-serif; background: #fff; }
</style>
</head>
<body>${combined}</body>
</html>`;

    const w = window.open('', '_blank', 'width=420,height=350');
    if (!w) return;
    w.document.write(doc);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 600);
};
