import { jsPDF } from 'jspdf';
import { formatPatientAge, formatFertilityStatus } from '@/core/utils/age';

export interface PrescriptionItem {
  id: string;
  medicationName: string;
  concentration?: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface VetDocumentData {
  tutorName: string;
  patientName: string;
  species?: string;
  breed?: string;
  color?: string;
  weight?: string;
  age?: string;
  birthDate?: string | null;
  fertilityStatus?: string | null;
  fertilityNotes?: string | null;
  clinicalObservations?: string | null;
  notes: string;
  prescriptionText?: string | null;
  date: string;
  items?: { name: string; quantity: number }[];
  prescriptions?: PrescriptionItem[];
  vetName?: string;
  vetCrmv?: string;
}

const PDF_TIMEZONE = 'America/Fortaleza';
const WIN1252_EXTRA_GLYPHS = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/**
 * Sanitiza texto clínico/UI para o conjunto WinAnsi (Windows-1252) suportado pelas
 * fontes padrão do jsPDF (Helvetica/Times), evitando corrupção UTF-16BE mojibake.
 */
export function sanitizePdfText(text: string): string {
  if (!text) return '';

  const normalized = text
    .replace(/\r\n?/g, '\n')
    .normalize('NFC')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2194/g, '<->')
    .replace(/\u2265/g, '>=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2260/g, '!=')
    .replace(/\u2248/g, '~')
    .replace(/[\u2713\u2714\u2705]/g, '[OK]')
    .replace(/[\u2717\u2715\u274C]/g, '[X]')
    .replace(/[\u25AA\u25B8\u2023]/g, '•')
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F]/g, ' ')
    .replace(/\u2212/g, '-')
    .replace(/\u2044/g, '/')
    .replace(/\u03BC/g, 'µ');

  let sanitized = '';
  for (const ch of normalized) {
    if (ch === '\n' || ch === '\t') {
      sanitized += ch;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (
      ch.length === 1 &&
      ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff))
    ) {
      sanitized += ch;
      continue;
    }
    if (WIN1252_EXTRA_GLYPHS.has(ch)) {
      sanitized += ch;
    }
  }

  return sanitized;
}

/**
 * Sanitiza uma parte de nome de arquivo removendo acentos e caracteres inválidos.
 */
export function sanitizeFilenamePart(name: string): string {
  if (!name) return 'paciente';
  const cleaned = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'paciente';
}

function formatPdfDatePtBr(rawDateInput?: string): string {
  const raw = (rawDateInput || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-');
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const utcCheck = new Date(Date.UTC(y, m - 1, d));
    if (
      utcCheck.getUTCFullYear() === y &&
      utcCheck.getUTCMonth() === m - 1 &&
      utcCheck.getUTCDate() === d
    ) {
      return `${day}/${month}/${year}`;
    }
  }

  const parsed = raw ? new Date(raw) : new Date();
  const effectiveDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: PDF_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(effectiveDate);
}

let cachedTemplateDataUrl: string | null = null;

async function loadStationeryTemplate(): Promise<string | null> {
  if (cachedTemplateDataUrl) return cachedTemplateDataUrl;
  if (typeof window === 'undefined') return null;

  try {
    const res = await fetch('/templates/papel-timbrado-gabriela.jpg');
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          cachedTemplateDataUrl = reader.result;
          resolve(reader.result);
        } else {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fitSingleLineText(
  doc: jsPDF,
  rawText: string,
  maxWidthMm: number,
  initialFontSize: number,
  minFontSize: number
): { text: string; fontSize: number } {
  const cleanText = sanitizePdfText(rawText).trim();
  let fontSize = initialFontSize;
  doc.setFontSize(fontSize);

  while (fontSize > minFontSize && doc.getTextWidth(cleanText) > maxWidthMm) {
    fontSize = Math.max(minFontSize, Number((fontSize - 0.5).toFixed(1)));
    doc.setFontSize(fontSize);
  }

  let fitted = cleanText;
  if (doc.getTextWidth(fitted) > maxWidthMm) {
    while (fitted.length > 1 && doc.getTextWidth(`${fitted}…`) > maxWidthMm) {
      fitted = fitted.slice(0, -1);
    }
    fitted = `${fitted.trimEnd()}…`;
  }

  return { text: fitted, fontSize };
}

interface TextRenderStyle {
  fontName: 'helvetica' | 'times';
  fontStyle: 'normal' | 'bold' | 'italic';
  fontSize: number;
  color: [number, number, number];
  align?: 'left' | 'center' | 'right';
}

function applyTextStyle(doc: jsPDF, style: TextRenderStyle) {
  doc.setFont(style.fontName, style.fontStyle);
  doc.setFontSize(style.fontSize);
  doc.setTextColor(style.color[0], style.color[1], style.color[2]);
}

function renderWrappedLines(
  doc: jsPDF,
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number,
  style: TextRenderStyle,
  onNewPage: () => void
): number {
  let currentY = startY;
  applyTextStyle(doc, style);

  for (const line of lines) {
    if (currentY > 235) {
      onNewPage();
      currentY = 105;
      applyTextStyle(doc, style);
    }
    if (style.align) {
      doc.text(line, x, currentY, { align: style.align });
    } else {
      doc.text(line, x, currentY);
    }
    currentY += lineHeight;
  }

  return currentY;
}

function renderSectionBanner(
  doc: jsPDF,
  title: string,
  currentY: number
) {
  doc.setFillColor(245, 216, 216);
  doc.roundedRect(25, currentY - 4, 160, 6.5, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  const fitted = fitSingleLineText(doc, sanitizePdfText(title), 152, 9.5, 7.5);
  doc.setFontSize(fitted.fontSize);
  doc.setTextColor(115, 31, 40);
  doc.text(fitted.text, 29, currentY + 0.5);
}

/**
 * Desenha o papel timbrado oficial da Dra. Gabriela Soares e preenche
 * nas coordenadas milimétricas exatas as caixas do cabeçalho:
 * - Paciente (x=75.5, y=55.4)
 * - Espécie Can (cx=87.5, cy=66.8) / Fel (cx=104.6, cy=66.8)
 * - Raça (x=128.5, y=68.0)
 * - Peso (x=69.5, y=80.5)
 * - Idade (x=122.5, y=80.5)
 * - Tutor (x=69.0, y=92.0)
 */
function renderOfficialStationeryHeader(
  doc: jsPDF,
  templateDataUrl: string | null,
  data: VetDocumentData
) {
  if (templateDataUrl) {
    doc.addImage(templateDataUrl, 'JPEG', 0, 0, 210, 297);
  } else {
    // Fallback vetorial caso a imagem não esteja disponível offline
    doc.setFillColor(115, 31, 40); // Bordô #731F28
    doc.rect(0, 0, 210, 8, 'F');
    doc.rect(0, 290, 210, 7, 'F');
    doc.setFont('times', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(115, 31, 40);
    doc.text('Gabriela Soares', 105, 28, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('M É D I C A   V E T E R I N Á R I A', 105, 34, { align: 'center' });
  }

  // Cor de preenchimento dos dados nas caixas do cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(55, 35, 38);

  // 1. Paciente (caixa: x0=53.4..156.6, y0=49.5..58.9, label termina em x=73.3)
  const patientText = sanitizePdfText(data.patientName || '').trim() || 'Não informado';
  const fittedPatient = fitSingleLineText(doc, patientText, 79, 10.5, 7.5);
  doc.setFontSize(fittedPatient.fontSize);
  doc.text(fittedPatient.text, 75.5, 55.4);

  // 2. Espécie: Can (cx=87.5, cy=66.8) | Fel (cx=104.6, cy=66.8)
  const rawSpecies = sanitizePdfText(data.species || '').toLowerCase();
  const isCanine =
    rawSpecies.includes('can') || rawSpecies.includes('cão') || rawSpecies.includes('cao');
  const isFeline = rawSpecies.includes('fel') || rawSpecies.includes('gat');

  doc.setFillColor(115, 31, 40); // Bordô oficial
  if (isCanine) {
    doc.circle(87.5, 66.8, 1.8, 'F');
  } else if (isFeline) {
    doc.circle(104.6, 66.8, 1.8, 'F');
  }

  // 3. Raça (caixa: x0=113.9..156.6, y0=62.1..71.5, label termina em x=126.8)
  const breedText = sanitizePdfText(data.breed || '').trim() || 'SRD';
  const fittedBreed = fitSingleLineText(doc, breedText, 26.5, 9.5, 7);
  doc.setFontSize(fittedBreed.fontSize);
  doc.text(fittedBreed.text, 128.5, 68.0);

  // 4. Peso (caixa: x0=53.4..100.1, y0=74.7..84.0, label termina em x=67.5)
  const rawWeight = sanitizePdfText(data.weight != null ? String(data.weight) : '').trim();
  const cleanWeight = rawWeight
    ? rawWeight.toLowerCase().includes('kg')
      ? rawWeight
      : `${rawWeight} kg`
    : '—';
  const fittedWeight = fitSingleLineText(doc, cleanWeight, 29, 10, 7.5);
  doc.setFontSize(fittedWeight.fontSize);
  doc.text(fittedWeight.text, 69.5, 80.5);

  // 5. Idade (caixa: x0=104.6..156.6, y0=74.7..84.0, label termina em x=120.8)
  const ageSource =
    data.age?.trim() || (data.birthDate ? formatPatientAge(data.birthDate) : '') || '';
  const computedAge = sanitizePdfText(ageSource).trim() || '—';
  const fittedAge = fitSingleLineText(doc, computedAge, 32, 9.5, 7.5);
  doc.setFontSize(fittedAge.fontSize);
  doc.text(fittedAge.text, 122.5, 80.5);

  // 6. Tutor (caixa: x0=53.4..156.6, y0=86.1..95.4, label termina em x=66.9)
  const tutorText = sanitizePdfText(data.tutorName || '').trim() || 'Não informado';
  const fittedTutor = fitSingleLineText(doc, tutorText, 85, 10.5, 7.5);
  doc.setFontSize(fittedTutor.fontSize);
  doc.text(fittedTutor.text, 69.0, 92.0);
}

function renderSignatureAndDateFooter(doc: jsPDF, data: VetDocumentData) {
  const formattedDate = sanitizePdfText(formatPdfDatePtBr(data.date));
  const vetName = sanitizePdfText(data.vetName || '').trim() || 'Dra. Gabriela Soares';
  const vetCrmv = sanitizePdfText(data.vetCrmv || '').trim();

  // Data à esquerda
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(90, 70, 72);
  doc.text(`Data do atendimento: ${formattedDate}`, 25, 258);

  // Linha de assinatura à direita
  doc.setDrawColor(115, 31, 40);
  doc.setLineWidth(0.4);
  doc.line(115, 254, 185, 254);

  doc.setFont('times', 'italic');
  const fittedVetName = fitSingleLineText(doc, vetName, 75, 12, 8.5);
  doc.setFontSize(fittedVetName.fontSize);
  doc.setTextColor(115, 31, 40);
  doc.text(fittedVetName.text, 150, 251, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  const crmvLabel = vetCrmv ? `Médica Veterinária • ${vetCrmv}` : 'Médica Veterinária';
  const fittedCrmv = fitSingleLineText(doc, crmvLabel, 75, 8.5, 7);
  doc.setFontSize(fittedCrmv.fontSize);
  doc.setTextColor(90, 70, 72);
  doc.text(fittedCrmv.text, 150, 259, { align: 'center' });
}

/**
 * Gera o RECEITUÁRIO VETERINÁRIO sobre o papel timbrado oficial da Dra. Gabriela Soares.
 */
export async function gerarPDFReceituario(data: VetDocumentData) {
  const templateDataUrl = await loadStationeryTemplate();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const addNewStationeryPage = () => {
    doc.addPage();
    renderOfficialStationeryHeader(doc, templateDataUrl, data);
    renderSignatureAndDateFooter(doc, data);
  };

  renderOfficialStationeryHeader(doc, templateDataUrl, data);
  renderSignatureAndDateFooter(doc, data);

  let currentY = 105;

  // Título Central
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(115, 31, 40); // Bordô #731F28
  doc.text('RECEITUÁRIO VETERINÁRIO', 105, currentY, { align: 'center' });

  doc.setDrawColor(115, 31, 40);
  doc.setLineWidth(0.3);
  doc.line(65, currentY + 2, 145, currentY + 2);
  currentY += 10;

  const sanitizedFreeText = sanitizePdfText(data.prescriptionText || '');
  const hasFreeText = sanitizedFreeText.trim().length > 0;
  const structuredItems = data.prescriptions ?? [];
  const hasStructured = structuredItems.length > 0;
  const hasPrescriptions = hasFreeText || hasStructured;

  if (hasFreeText) {
    const rawLines = sanitizedFreeText.split('\n');

    for (const rawLine of rawLines) {
      const line = rawLine.trim();
      if (!line) {
        currentY += 3.5;
        continue;
      }

      if (currentY > 235) {
        addNewStationeryPage();
        currentY = 105;
      }

      // Se for cabeçalho de seção (ex: "USO ORAL:", "USO TÓPICO:", "RECOMENDAÇÕES GERAIS:")
      const isSectionHeader =
        /^(uso\s+[a-zà-ú/\s]+|recomendações(\s+gerais)?|orientações(\s+gerais)?)\s*:?\s*$/i.test(
          line
        );
      const isAllCapsHeading =
        line === line.toUpperCase() &&
        line.length >= 4 &&
        line.length <= 45 &&
        !/^\d/.test(line) &&
        /[A-ZÀ-Ú]/.test(line) &&
        !/:.+/.test(line);
      const isHeader = isSectionHeader || isAllCapsHeading;

      if (isHeader) {
        currentY += 2;
        if (currentY > 225) {
          addNewStationeryPage();
          currentY = 105;
        }
        renderSectionBanner(doc, line.replace(/:$/, '').trim(), currentY);
        currentY += 8;
        continue;
      }

      // Se for item numerado ou com marcador (ex: "1. Dipirona..." ou "• Maxicam...")
      const isNumberedItem = /^\s*(\d+[\.\)]|•|-|\*)\s+/.test(line);

      if (isNumberedItem) {
        const style: TextRenderStyle = {
          fontName: 'helvetica',
          fontStyle: 'bold',
          fontSize: 10.5,
          color: [40, 25, 28],
        };
        applyTextStyle(doc, style);
        const splitLine: string[] = doc.splitTextToSize(line, 155);
        currentY = renderWrappedLines(
          doc,
          splitLine,
          27,
          currentY,
          5.2,
          style,
          addNewStationeryPage
        );
        currentY += 1;
      } else {
        const style: TextRenderStyle = {
          fontName: 'helvetica',
          fontStyle: 'normal',
          fontSize: 10,
          color: [60, 45, 48],
        };
        applyTextStyle(doc, style);
        const splitLine: string[] = doc.splitTextToSize(line, 152);
        currentY = renderWrappedLines(
          doc,
          splitLine,
          32,
          currentY,
          4.9,
          style,
          addNewStationeryPage
        );
      }
    }
    currentY += 3;
  }

  if (hasStructured) {
    if (hasFreeText) {
      currentY += 4;
    }

    // Agrupar prescrições por via de administração (Ex: USO ORAL, USO TÓPICO)
    const grouped = structuredItems.reduce((acc, item) => {
      const routeKey =
        sanitizePdfText(item.route || '').trim().toUpperCase() || 'USO GERAL';
      if (!acc[routeKey]) acc[routeKey] = [];
      acc[routeKey].push(item);
      return acc;
    }, {} as Record<string, PrescriptionItem[]>);

    let itemIndex = 1;

    for (const [routeTitle, routeItems] of Object.entries(grouped)) {
      if (currentY > 225) {
        addNewStationeryPage();
        currentY = 105;
      }

      renderSectionBanner(doc, routeTitle, currentY);
      currentY += 8;

      for (const rx of routeItems) {
        if (currentY > 235) {
          addNewStationeryPage();
          currentY = 105;
        }

        // Linha 1: Número + Nome do Medicamento + Concentração
        const medName = sanitizePdfText(rx.medicationName || '').trim() || 'Medicamento';
        const conc = sanitizePdfText(rx.concentration || '').trim();
        const titleLine = `${itemIndex}. ${medName}${conc ? ` (${conc})` : ''}`;

        const titleStyle: TextRenderStyle = {
          fontName: 'helvetica',
          fontStyle: 'bold',
          fontSize: 11,
          color: [40, 25, 28],
        };
        applyTextStyle(doc, titleStyle);
        const splitTitle: string[] = doc.splitTextToSize(titleLine, 155);
        currentY = renderWrappedLines(
          doc,
          splitTitle,
          27,
          currentY,
          5.5,
          titleStyle,
          addNewStationeryPage
        );

        // Linha 2: Posologia (Dose + Frequência + Duração)
        const dosage = sanitizePdfText(rx.dosage || '').trim();
        const frequency = sanitizePdfText(rx.frequency || '').trim();
        const duration = sanitizePdfText(rx.duration || '').trim();
        const posologyParts = [
          dosage ? `Dose: ${dosage}` : '',
          frequency ? `Frequência: ${frequency}` : '',
          duration ? `Período: ${duration}` : '',
        ].filter(Boolean);

        const posologyText = posologyParts.join('  •  ');
        if (posologyText) {
          const posologyStyle: TextRenderStyle = {
            fontName: 'helvetica',
            fontStyle: 'normal',
            fontSize: 10,
            color: [65, 50, 52],
          };
          applyTextStyle(doc, posologyStyle);
          const splitPosology: string[] = doc.splitTextToSize(posologyText, 152);
          currentY = renderWrappedLines(
            doc,
            splitPosology,
            32,
            currentY,
            5,
            posologyStyle,
            addNewStationeryPage
          );
        }

        // Linha 3: Instruções / Recomendações
        const instructions = sanitizePdfText(rx.instructions || '').trim();
        if (instructions) {
          const instStyle: TextRenderStyle = {
            fontName: 'helvetica',
            fontStyle: 'italic',
            fontSize: 9.5,
            color: [95, 75, 78],
          };
          applyTextStyle(doc, instStyle);
          const splitInst: string[] = doc.splitTextToSize(`Obs: ${instructions}`, 150);
          currentY = renderWrappedLines(
            doc,
            splitInst,
            32,
            currentY,
            4.8,
            instStyle,
            addNewStationeryPage
          );
        }

        currentY += 4;
        itemIndex++;
      }

      currentY += 2;
    }
  }

  // Caso não haja prescrições estruturadas nem texto livre, mas haja itens aplicados
  if (!hasPrescriptions && data.items && data.items.length > 0) {
    if (currentY > 230) {
      addNewStationeryPage();
      currentY = 105;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(115, 31, 40);
    doc.text('MEDICAMENTOS E INSUMOS:', 25, currentY);
    currentY += 6;

    const itemStyle: TextRenderStyle = {
      fontName: 'helvetica',
      fontStyle: 'normal',
      fontSize: 10,
      color: [50, 35, 38],
    };
    for (const item of data.items) {
      const itemName = sanitizePdfText(item.name || '').trim() || 'Item';
      const itemLine = `• ${item.quantity}x ${itemName}`;
      applyTextStyle(doc, itemStyle);
      const splitItem: string[] = doc.splitTextToSize(itemLine, 155);
      currentY = renderWrappedLines(
        doc,
        splitItem,
        28,
        currentY,
        5.5,
        itemStyle,
        addNewStationeryPage
      );
    }
  }

  const safeName = sanitizeFilenamePart(data.patientName || '');
  const safeDate = formatPdfDatePtBr(data.date).replace(/\//g, '-');
  doc.save(`Receita_${safeName}_${safeDate}.pdf`);
}

/**
 * Gera o RELATÓRIO DE ATENDIMENTO CLÍNICO sobre o papel timbrado oficial da Dra. Gabriela Soares.
 */
export async function gerarPDFRelatorioAtendimento(data: VetDocumentData) {
  const templateDataUrl = await loadStationeryTemplate();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const addNewStationeryPage = () => {
    doc.addPage();
    renderOfficialStationeryHeader(doc, templateDataUrl, data);
    renderSignatureAndDateFooter(doc, data);
  };

  renderOfficialStationeryHeader(doc, templateDataUrl, data);
  renderSignatureAndDateFooter(doc, data);

  let currentY = 105;

  // Título Central
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(115, 31, 40); // Bordô #731F28
  doc.text('RELATÓRIO DE ATENDIMENTO CLÍNICO', 105, currentY, { align: 'center' });

  doc.setDrawColor(115, 31, 40);
  doc.setLineWidth(0.3);
  doc.line(58, currentY + 2, 152, currentY + 2);
  currentY += 8;

  // Metadados adicionais do Paciente (Pelagem, Fertilidade, Obs. Reprodutiva)
  const extraMeta: string[] = [];
  const cleanColor = sanitizePdfText(data.color || '').trim();
  if (cleanColor) extraMeta.push(`Pelagem: ${cleanColor}`);
  if (data.fertilityStatus) {
    const fertLabel = sanitizePdfText(formatFertilityStatus(data.fertilityStatus)).trim();
    if (fertLabel) extraMeta.push(`Fertilidade: ${fertLabel}`);
  }
  const cleanFertNotes = sanitizePdfText(data.fertilityNotes || '').trim();
  if (cleanFertNotes) extraMeta.push(`Obs. Reprodutiva: ${cleanFertNotes}`);

  if (extraMeta.length > 0) {
    const metaStyle: TextRenderStyle = {
      fontName: 'helvetica',
      fontStyle: 'bold',
      fontSize: 9,
      color: [100, 65, 70],
      align: 'center',
    };
    applyTextStyle(doc, metaStyle);
    const metaText = sanitizePdfText(extraMeta.join('   |   '));
    const splitMeta: string[] = doc.splitTextToSize(metaText, 156);
    currentY = renderWrappedLines(
      doc,
      splitMeta,
      105,
      currentY,
      4.5,
      metaStyle,
      addNewStationeryPage
    );
    currentY += 2;
  }

  const obs = sanitizePdfText(data.clinicalObservations || '').trim();
  if (obs) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const allObsLines: string[] = doc.splitTextToSize(
      `ALERTA / OBSERVAÇÕES DO PACIENTE: ${obs}`,
      152
    );

    // Chunk apenas se exceder a altura útil de uma página inteira (~26 linhas)
    const maxLinesPerBox = 26;
    for (let i = 0; i < allObsLines.length; i += maxLinesPerBox) {
      const chunkLines = allObsLines.slice(i, i + maxLinesPerBox);
      const boxHeight = chunkLines.length * 4.5 + 5;
      if (currentY + boxHeight > 235) {
        addNewStationeryPage();
        currentY = 105;
      }

      doc.setFillColor(253, 232, 232);
      doc.roundedRect(25, currentY - 3.5, 160, boxHeight, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(160, 25, 35);
      chunkLines.forEach((obsLine, idx) => {
        doc.text(obsLine, 29, currentY + 1.5 + idx * 4.5);
      });
      currentY += boxHeight + 2;
    }
  }

  // 1. Anamnese e Evolução Clínica
  if (currentY > 225) {
    addNewStationeryPage();
    currentY = 105;
  }
  renderSectionBanner(doc, 'ANAMNESE, EXAME FÍSICO E EVOLUÇÃO CLÍNICA', currentY);
  currentY += 7.5;

  const notesStyle: TextRenderStyle = {
    fontName: 'helvetica',
    fontStyle: 'normal',
    fontSize: 10.5,
    color: [45, 30, 32],
  };
  applyTextStyle(doc, notesStyle);
  const cleanNotes =
    sanitizePdfText(data.notes || '').trim() ||
    'Atendimento clínico realizado sem intercorrências adicionais.';
  const splitNotes: string[] = doc.splitTextToSize(cleanNotes, 158);
  currentY = renderWrappedLines(
    doc,
    splitNotes,
    26,
    currentY,
    5.3,
    notesStyle,
    addNewStationeryPage
  );
  currentY += 5;

  // 2. Procedimentos, Vacinas e Medicamentos Realizados em Consulta
  if (data.items && data.items.length > 0) {
    if (currentY > 225) {
      addNewStationeryPage();
      currentY = 105;
    }

    renderSectionBanner(doc, 'PROCEDIMENTOS, VACINAS E INSUMOS APLICADOS', currentY);
    currentY += 7.5;

    const itemStyle: TextRenderStyle = {
      fontName: 'helvetica',
      fontStyle: 'normal',
      fontSize: 10,
      color: [45, 30, 32],
    };

    for (const item of data.items) {
      const itemName = sanitizePdfText(item.name || '').trim() || 'Item';
      const itemLine = `• ${item.quantity}x ${itemName}`;
      applyTextStyle(doc, itemStyle);
      const splitItem: string[] = doc.splitTextToSize(itemLine, 155);
      currentY = renderWrappedLines(
        doc,
        splitItem,
        28,
        currentY,
        5.5,
        itemStyle,
        addNewStationeryPage
      );
    }
    currentY += 4;
  }

  // 3. Resumo de Prescrições Domiciliares (se houver)
  const sanitizedFreeText = sanitizePdfText(data.prescriptionText || '');
  const hasFreeText = sanitizedFreeText.trim().length > 0;
  const structuredItems = data.prescriptions ?? [];
  const hasStructured = structuredItems.length > 0;

  if (hasFreeText || hasStructured) {
    if (currentY > 220) {
      addNewStationeryPage();
      currentY = 105;
    }

    renderSectionBanner(doc, 'RESUMO DE PRESCRIÇÃO DOMICILIAR', currentY);
    currentY += 7.5;

    const rxStyle: TextRenderStyle = {
      fontName: 'helvetica',
      fontStyle: 'normal',
      fontSize: 9.5,
      color: [45, 30, 32],
    };

    if (hasFreeText) {
      const rxLines = sanitizedFreeText.split('\n');
      for (const rawL of rxLines) {
        const l = rawL.trim();
        if (!l) continue;
        applyTextStyle(doc, rxStyle);
        const splitL: string[] = doc.splitTextToSize(l, 155);
        currentY = renderWrappedLines(
          doc,
          splitL,
          28,
          currentY,
          4.8,
          rxStyle,
          addNewStationeryPage
        );
      }
    }

    if (hasFreeText && hasStructured) {
      currentY += 4;
    }

    if (hasStructured) {
      for (const rx of structuredItems) {
        const medName = sanitizePdfText(rx.medicationName || '').trim() || 'Medicamento';
        const conc = sanitizePdfText(rx.concentration || '').trim();
        const route = sanitizePdfText(rx.route || '').trim();
        const dosage = sanitizePdfText(rx.dosage || '').trim();
        const frequency = sanitizePdfText(rx.frequency || '').trim();
        const duration = sanitizePdfText(rx.duration || '').trim();
        const instructions = sanitizePdfText(rx.instructions || '').trim();

        const details = [route, dosage, frequency, duration].filter(Boolean);
        const rxSummary = `• ${medName}${conc ? ` (${conc})` : ''}${
          details.length > 0 ? ` — ${details.join(', ')}` : ''
        }${instructions ? ` (${instructions})` : ''}`;

        applyTextStyle(doc, rxStyle);
        const lines: string[] = doc.splitTextToSize(rxSummary, 155);
        currentY = renderWrappedLines(
          doc,
          lines,
          28,
          currentY,
          5,
          rxStyle,
          addNewStationeryPage
        );
      }
    }
  }

  const safeName = sanitizeFilenamePart(data.patientName || '');
  const safeDate = formatPdfDatePtBr(data.date).replace(/\//g, '-');
  doc.save(`Relatorio_${safeName}_${safeDate}.pdf`);
}
