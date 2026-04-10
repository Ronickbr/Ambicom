import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import * as QRCode from 'qrcode';
import { calculateProductSize } from './product-utils';

/**
 * Exporta dados de tabela para PDF (Relatório A4)
 */
export const exportToPDF = (
    title: string,
    headers: string[],
    data: (string | number | boolean | null)[][],
    fileName: string,
) => {
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

    doc.save(`${fileName}_${Date.now()}.pdf`);
};

/**
 * Exporta dados para Excel
 */
export const exportToExcel = (data: Record<string, unknown>[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
    XLSX.writeFile(workbook, `${fileName}_${Date.now()}.xlsx`);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sanitiza valor: remove unidades embutidas, retorna '-' se vazio */
function s(v: any): string {
    return String(v ?? '').trim() || '-';
}

// ─── Builder HTML da Etiqueta ─────────────────────────────────────────────────

/**
 * Retorna o HTML completo de uma etiqueta Ambicom.
 *
 * Layout espelha o modelo físico:
 *   @page { size: 80mm 130mm portrait; margin: 0 }
 *
 * Pode ser usado via:
 * - jsPDF.html()         → PDF para bridge remoto
 * - window.open().print() → impressão direta pelo browser
 */
export async function buildLabelHTML(p: any): Promise<string> {
    const model = s(p.model ?? p.modelo);
    const voltage = s(p.voltage ?? p.tensao);
    const serial = s(p.internal_serial);
    const commCode = s(p.commercial_code);
    const pncMl = s(p.pnc_ml);
    const gas = s(p.refrigerant_gas);
    const gasChg = s(p.gas_charge);
    const compressor = s(p.compressor);
    const volFreezer = s(p.volume_freezer);
    const volRefrig = s(p.volume_refrigerator);
    const volTotal = s(p.volume_total);
    const pressure = s(p.pressure_high_low);   // ex: "(788/52) kpa / (100/7,09) psig"
    const freezCap = s(p.freezing_capacity);   // ex: "9 kg/24h"
    const current = s(p.electric_current);    // ex: "2,3 A"
    const defrost = s(p.defrost_power);       // ex: "316 W"
    const sizeFull = p.size ?? await calculateProductSize(p.volume_total);
    const dispSize = sizeFull === 'Pequeno' ? 'P'
        : sizeFull === 'Médio' ? 'M'
            : sizeFull === 'Grande' ? 'G'
                : (sizeFull || '-');

    // QR Code como Data URL PNG (embutido no HTML)
    let qrImgTag = '';
    if (serial !== '-') {
        try {
            const url = await QRCode.toDataURL(serial, {
                margin: 0, width: 200, errorCorrectionLevel: 'M',
            });
            qrImgTag = `<img src="${url}" alt="QR" />`;
        } catch { /* qr opcional */ }
    }

    // ─── Monta linhas condicionais ─────────────────────────────────────────────
    // Linha Pressão (só exibe se houver dados)
    const pressureRow = (pressure !== '-' || freezCap !== '-') ? `
    <!-- Linha 6: P. ALTA / P. BAIXA | CAPAC. CONG. -->
    <div class="row row-2col bl">
      <div class="cell">
        <span class="lbl">P. de Alta / P. de Baixa</span>
        <span class="val val-sm">${pressure}</span>
      </div>
      <div class="cell bl">
        <span class="lbl">Capac. Cong.</span>
        <span class="val">${freezCap}</span>
      </div>
    </div>` : '';

    // Linha Corrente / Degelo / Tamanho (sempre visível se houver tamanho)
    const currentRow = `
    <!-- Linha 7: CORRENTE | POT. DEGELO | TAMANHO -->
    <div class="row row-3col bl">
      <div class="cell">
        <span class="lbl">Corrente</span>
        <span class="val">${current !== '-' ? current + ' A' : '-'}</span>
      </div>
      <div class="cell bl">
        <span class="lbl">Pot. Degelo</span>
        <span class="val">${defrost !== '-' ? defrost + ' W' : '-'}</span>
      </div>
      <div class="cell bl size-cell">
        <span class="lbl">Tamanho</span>
        <span class="val val-xl">${dispSize}</span>
      </div>
    </div>`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  /* ─── Página ─── */
  @page {
    size: 80mm 130mm portrait;
    margin: 0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 80mm;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7pt;
    color: #000;
    background: #fff;
  }

  /* ─── Wrapper central ─── */
  .label {
    width: 78mm;
    margin: 1mm;
    border: 0.5pt solid #000;
  }

  /* ─── Cabeçalho ─── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1.5mm 2mm 1mm 2mm;
    border-bottom: 0.5pt solid #000;
  }
  .brand-name {
    font-size: 22pt;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.5pt;
  }
  .brand-sub {
    font-size: 5pt;
    line-height: 1.5;
    margin-top: 1pt;
  }
  .brand-sac {
    font-size: 9pt;
    font-weight: 900;
    margin-top: 2pt;
    white-space: nowrap;
  }
  .stamp {
    text-align: center;
    font-size: 6pt;
    font-weight: 900;
    line-height: 1.6;
    border: 0.5pt solid #000;
    padding: 1mm 1.5mm;
    white-space: nowrap;
    align-self: center;
  }

  /* ─── Linhas de dados ─── */
  .row {
    display: flex;
    width: 100%;
  }
  /* divisor superior de cada linha */
  .bt { border-top: 0.5pt solid #000; }
  /* divisor lateral */
  .bl { border-left: 0.5pt solid #000; }

  /* Distribuições de colunas */
  .row-2col > .cell:first-child { flex: 3; }
  .row-2col > .cell:last-child  { flex: 2; }

  .row-3col > .cell { flex: 1; }

  /* ─── Célula ─── */
  .cell {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0.8mm 1.5mm;
    overflow: hidden;
    min-height: 9mm;
  }

  /* ─── Labels e Valores ─── */
  .lbl {
    font-size: 5pt;
    font-weight: normal;
    text-transform: uppercase;
    color: #333;
    line-height: 1;
    white-space: nowrap;
  }
  .val     { font-size: 11pt; font-weight: 900; line-height: 1.1; }
  .val-sm  { font-size: 7pt;  font-weight: bold; line-height: 1.3; }
  .val-xl  { font-size: 22pt; font-weight: 900; line-height: 1; align-self: center; }

  /* ─── Linha 1: MODELO | VOLTAGEM ─── */
  .row-modelo { border-top: 0.5pt solid #000; }
  .row-modelo .cell-modelo { flex: 3; min-height: 10mm; }
  .row-modelo .cell-volt   { flex: 2; min-height: 10mm; border-left: 0.5pt solid #000; }

  /* ─── Linha 2: QR + SERIAL ─── */
  .row-serial { border-top: 0.5pt solid #000; min-height: 20mm; }
  .qr-wrap {
    width: 22mm;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1mm;
    border-right: 0.5pt solid #000;
    flex-shrink: 0;
  }
  .qr-wrap img { width: 20mm; height: 20mm; display: block; }
  .serial-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 1.5mm 2mm;
    gap: 1pt;
  }
  .serial-lbl  { font-size: 5pt; text-transform: uppercase; color: #333; }
  .serial-val  { font-size: 16pt; font-weight: 900; line-height: 1.05; }
  .serial-code { font-size: 9pt; font-weight: 900; }

  /* ─── Linha 3: PNC/ML | 60 Hz ─── */
  .row-pnc { border-top: 0.5pt solid #000; }
  .cell-pnc  {
    flex: 3;
    display: flex;
    flex-direction: column;
    padding: 0.8mm 1.5mm;
    justify-content: space-between;
    min-height: 10mm;
  }
  .cell-hz {
    flex: 1;
    border-left: 0.5pt solid #000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    padding: 0.8mm 1mm;
    min-height: 10mm;
    text-align: center;
  }
  .pnc-val { font-size: 14pt; font-weight: 900; }
  .hz-val  { font-size: 14pt; font-weight: 900; }

  /* Tamanho na célula final */
  .size-cell { align-items: center; justify-content: center; text-align: center; }
</style>
</head>
<body>
<div class="label">

  <!-- ═══ CABEÇALHO ═══ -->
  <div class="header">
    <div>
      <div class="brand-name">Ambicom</div>
      <div class="brand-sub">
        R. Wenceslau Marek, 10 – Águas Belas,<br/>
        São José dos Pinhais – PR, 83010-520
      </div>
      <div class="brand-sac">SAC : 041 - 3382-5410</div>
    </div>
    <div class="stamp">PRODUTO<br/>REMANUFATURADO<br/>GARANTIA<br/>AMBICOM</div>
  </div>

  <!-- ═══ LINHA 1: MODELO | VOLTAGEM ═══ -->
  <div class="row row-modelo">
    <div class="cell cell-modelo">
      <span class="lbl">Modelo</span>
      <span class="val" style="font-size:16pt;">${model}</span>
    </div>
    <div class="cell cell-volt">
      <span class="lbl">Voltagem</span>
      <span class="val" style="font-size:16pt;">${voltage} V</span>
    </div>
  </div>

  <!-- ═══ LINHA 2: QR CODE + NÚMERO DE SÉRIE ═══ -->
  <div class="row row-serial" style="border-top:0.5pt solid #000;">
    <div class="qr-wrap">${qrImgTag}</div>
    <div class="serial-wrap">
      <span class="serial-lbl">Número de Série Ambicom:</span>
      <span class="serial-val">${serial}</span>
      ${commCode !== '-' ? `<span class="serial-code">${commCode}</span>` : ''}
    </div>
  </div>

  <!-- ═══ LINHA 3: PNC/ML | 60 Hz ═══ -->
  <div class="row row-pnc">
    <div class="cell-pnc">
      <span class="lbl">PNC/ML</span>
      <span class="pnc-val">${pncMl}</span>
    </div>
    <div class="cell-hz">
      <span class="lbl" style="text-align:center;">Frequência</span>
      <span class="hz-val">60 Hz</span>
    </div>
  </div>

  <!-- ═══ LINHA 4: GÁS FRIGOR. | CARGA GÁS | COMPRESSOR ═══ -->
  <div class="row row-3col" style="border-top:0.5pt solid #000;">
    <div class="cell">
      <span class="lbl">Gás Frigor.</span>
      <span class="val">${gas}</span>
    </div>
    <div class="cell" style="border-left:0.5pt solid #000;">
      <span class="lbl">Carga Gás</span>
      <span class="val">${gasChg !== '-' ? gasChg + ' g' : '-'}</span>
    </div>
    <div class="cell" style="border-left:0.5pt solid #000;">
      <span class="lbl">Compressor</span>
      <span class="val val-sm">${compressor}</span>
    </div>
  </div>

  <!-- ═══ LINHA 5: VOL. FREEZER | VOL. REFRIG. | VOLUME TOTAL ═══ -->
  <div class="row row-3col" style="border-top:0.5pt solid #000;">
    <div class="cell">
      <span class="lbl">Vol. Freezer</span>
      <span class="val">${volFreezer !== '-' ? volFreezer + ' L' : '-'}</span>
    </div>
    <div class="cell" style="border-left:0.5pt solid #000;">
      <span class="lbl">Vol. Refrig.</span>
      <span class="val">${volRefrig !== '-' ? volRefrig + ' L' : '-'}</span>
    </div>
    <div class="cell" style="border-left:0.5pt solid #000;">
      <span class="lbl">Volume Total</span>
      <span class="val">${volTotal !== '-' ? volTotal + 'L' : '-'}</span>
    </div>
  </div>

  ${pressureRow}

  ${currentRow}

</div><!-- /label -->
</body>
</html>`;
}

// ─── Geração de PDF ───────────────────────────────────────────────────────────

// Largura do label em mm (80mm = largura do rolo)
const LABEL_W_MM = 80;
// Largura do iframe em pixels: 80mm @ 96dpi ≈ 302px
const LABEL_W_PX = 302;
// Altura máxima de segurança para o iframe (suficiente para qualquer label)
const IFRAME_MAX_H_PX = 900;

/**
 * Gera as etiquetas em formato PDF Industrial.
 * A altura do PDF é medida dinamicamente a partir do HTML renderizado,
 * evitando qualquer clipping do conteúdo.
 */
export const generateLabelsPDF = async (products: any[]): Promise<jsPDF> => {
    // jsPDF será criado após medir a primeira etiqueta.
    // Usamos 'any' temporário e recriamos com as dimensões corretas.
    let doc: jsPDF | null = null;
    let labelH = 0; // altura em mm, medida na 1ª iteração

    for (let i = 0; i < products.length; i++) {
        const html = await buildLabelHTML(products[i]);

        const result = await new Promise<{ pageH: number }>(async (resolve, reject) => {
            // ── Iframe oculto com altura generosa para não truncar o DOM
            const iframe = document.createElement('iframe');
            iframe.style.cssText = [
                'position:fixed',
                'left:-9999px',
                'top:-9999px',
                `width:${LABEL_W_PX}px`,
                `height:${IFRAME_MAX_H_PX}px`,
                'border:none',
                'visibility:hidden',
                'overflow:visible',
            ].join(';');
            document.body.appendChild(iframe);

            iframe.onload = async () => {
                try {
                    const iDoc = iframe.contentDocument!;
                    iDoc.open();
                    iDoc.write(html);
                    iDoc.close();

                    // Aguarda QR Code (data URL) e fontes carregarem
                    await new Promise(r => setTimeout(r, 500));

                    // ── Mede a altura REAL do conteúdo renderizado ──
                    const labelEl = iDoc.querySelector('.label') as HTMLElement;
                    const renderedPx = labelEl
                        ? labelEl.getBoundingClientRect().height + 8 // +8px da margem de 1mm×2
                        : iDoc.documentElement.scrollHeight;

                    // Converte px → mm  (96dpi: 1px = 25.4/96 mm)
                    const pageH = Math.ceil(renderedPx * 25.4 / 96) + 2; // +2mm de folga

                    // ── Inicializa o jsPDF com as dimensões corretas ──
                    if (!doc) {
                        labelH = pageH;
                        doc = new jsPDF({
                            orientation: 'portrait',
                            unit: 'mm',
                            format: [LABEL_W_MM, pageH],
                            putOnlyUsedFonts: true,
                            compress: true,
                        });
                    } else if (i > 0) {
                        doc.addPage([LABEL_W_MM, labelH], 'portrait');
                    }

                    await (doc as any).html(iDoc.body, {
                        x: 0,
                        y: 0,
                        width: LABEL_W_MM,
                        windowWidth: LABEL_W_PX,
                        html2canvas: {
                            // scale padrão = 1: mapeamento 1:1 entre px e pontos PDF.
                            // scale > 1 causa zoom proporcional ao valor → NÃO usar!
                            useCORS: true,
                            backgroundColor: '#ffffff',
                            logging: false,
                            // scrollY / scrollX zero garante captura do topo
                            scrollY: 0,
                            scrollX: 0,
                        },
                        autoPaging: false,
                    });

                    resolve({ pageH });
                } catch (err) {
                    reject(err);
                } finally {
                    document.body.removeChild(iframe);
                }
            };

            iframe.src = 'about:blank';
        });

        void result; // `pageH` foi usado durante a promição, não precisa aqui
    }

    if (!doc) throw new Error('Nenhum produto pôde ser processado.');
    return doc;
};

// ─── Utilitários de exportação ────────────────────────────────────────────────

/** Converte jsPDF para Base64 sem prefixo data URI */
export const pdfToBase64 = (doc: jsPDF): string =>
    doc.output('datauristring').split(',')[1];

/** Baixa as etiquetas como arquivo PDF */
export const printLabels = async (products: any[]) => {
    const doc = await generateLabelsPDF(products);
    doc.save(`etiquetas_ambicom_${Date.now()}.pdf`);
};

/**
 * Impressão nativa pelo diálogo do sistema operacional.
 * Útil quando não há bridge remoto disponível.
 */
export const printLabelsNative = async (products: any[]) => {
    const pages = await Promise.all(products.map(p => buildLabelHTML(p)));

    const combined = pages
        .map((html, idx) => {
            const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            const body = m ? m[1] : html;
            const pb = idx < pages.length - 1 ? 'always' : 'avoid';
            return `<div style="page-break-after:${pb}">${body}</div>`;
        })
        .join('');

    const doc = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<style>
  @page { size: 80mm 130mm portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 80mm; font-family: Arial, Helvetica, sans-serif; background: #fff; }
</style>
</head>
<body>${combined}</body>
</html>`;

    const w = window.open('', '_blank', 'width=420,height=500');
    if (!w) return;
    w.document.write(doc);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 600);
};
