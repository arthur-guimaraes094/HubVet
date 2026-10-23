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
  date: string;
  items?: { name: string; quantity: number }[];
  prescriptions?: PrescriptionItem[];
  vetName?: string;
  vetCrmv?: string;
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
  doc.setFontSize(10.5);
  doc.setTextColor(55, 35, 38);

  // 1. Paciente (caixa: x0=53.4..156.6, y0=49.5..58.9, label termina em x=73.3)
  const patientText = (data.patientName || 'Não informado').slice(0, 42);
  doc.text(patientText, 75.5, 55.4);

  // 2. Espécie: Can (cx=87.5, cy=66.8) | Fel (cx=104.6, cy=66.8)
  const rawSpecies = (data.species || '').toLowerCase();
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
  const breedText = (data.breed || 'SRD').slice(0, 16);
  doc.setFontSize(9.5);
  doc.text(breedText, 128.5, 68.0);

  // 4. Peso (caixa: x0=53.4..100.1, y0=74.7..84.0, label termina em x=67.5)
  const cleanWeight = data.weight
    ? data.weight.toString().toLowerCase().includes('kg')
      ? data.weight
      : `${data.weight} kg`
    : '—';
  doc.setFontSize(10);
  doc.text(cleanWeight, 69.5, 80.5);

  // 5. Idade (caixa: x0=104.6..156.6, y0=74.7..84.0, label termina em x=120.8)
  const computedAge =
    data.age?.trim() || (data.birthDate ? formatPatientAge(data.birthDate) : '') || '—';
  doc.setFontSize(9.5);
  doc.text(computedAge.slice(0, 18), 122.5, 80.5);

  // 6. Tutor (caixa: x0=53.4..156.6, y0=86.1..95.4, label termina em x=66.9)
  doc.setFontSize(10.5);
  const tutorText = (data.tutorName || 'Não informado').slice(0, 45);
  doc.text(tutorText, 69.0, 92.0);
}

function renderSignatureAndDateFooter(doc: jsPDF, data: VetDocumentData) {
  const formattedDate = new Date(data.date || new Date().toISOString()).toLocaleDateString(
    'pt-BR'
  );
  const vetName = data.vetName?.trim() || 'Dra. Gabriela Soares';
  const vetCrmv = data.vetCrmv?.trim() || '';

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
  doc.setFontSize(12);
  doc.setTextColor(115, 31, 40);
  doc.text(vetName, 150, 251, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 70, 72);
  doc.text(
    vetCrmv ? `Médica Veterinária • ${vetCrmv}` : 'Médica Veterinária',
    150,
    259,
    { align: 'center' }
  );
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

  const hasPrescriptions = data.prescriptions && data.prescriptions.length > 0;

  if (hasPrescriptions) {
    // Agrupar prescrições por via de administração (Ex: USO ORAL, USO TÓPICO)
    const grouped = data.prescriptions!.reduce((acc, item) => {
      const routeKey = (item.route || 'USO GERAL').toUpperCase();
      if (!acc[routeKey]) acc[routeKey] = [];
      acc[routeKey].push(item);
      return acc;
    }, {} as Record<string, PrescriptionItem[]>);

    let itemIndex = 1;

    for (const [routeTitle, routeItems] of Object.entries(grouped)) {
      if (currentY > 230) {
        addNewStationeryPage();
        currentY = 105;
      }

      // Cabeçalho da Via
      doc.setFillColor(245, 216, 216); // Rosa claro do rodapé
      doc.roundedRect(25, currentY - 4, 160, 6.5, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(115, 31, 40);
      doc.text(routeTitle, 29, currentY + 0.5);
      currentY += 8;

      for (const rx of routeItems) {
        if (currentY > 232) {
          addNewStationeryPage();
          currentY = 105;
        }

        // Linha 1: Número + Nome do Medicamento + Concentração
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(40, 25, 28);
        const titleLine = `${itemIndex}. ${rx.medicationName}${
          rx.concentration ? ` (${rx.concentration})` : ''
        }`;
        doc.text(titleLine, 27, currentY);
        currentY += 5.5;

        // Linha 2: Posologia (Dose + Frequência + Duração)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(65, 50, 52);
        const posologyParts = [
          rx.dosage ? `Dose: ${rx.dosage}` : '',
          rx.frequency ? `Frequência: ${rx.frequency}` : '',
          rx.duration ? `Período: ${rx.duration}` : '',
        ].filter(Boolean);

        const posologyText = posologyParts.join('  •  ');
        if (posologyText) {
          const splitPosology = doc.splitTextToSize(posologyText, 152);
          doc.text(splitPosology, 32, currentY);
          currentY += splitPosology.length * 5;
        }

        // Linha 3: Instruções / Recomendações
        if (rx.instructions?.trim()) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9.5);
          doc.setTextColor(95, 75, 78);
          const splitInst = doc.splitTextToSize(`Obs: ${rx.instructions.trim()}`, 150);
          doc.text(splitInst, 32, currentY);
          currentY += splitInst.length * 4.8;
        }

        currentY += 4;
        itemIndex++;
      }

      currentY += 2;
    }
  }

  // Orientações gerais / Notas da receita
  if (data.notes?.trim()) {
    if (currentY > 220) {
      addNewStationeryPage();
      currentY = 105;
    }

    if (hasPrescriptions) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(115, 31, 40);
      doc.text('ORIENTAÇÕES E RECOMENDAÇÕES CLÍNICAS:', 25, currentY);
      currentY += 6;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(50, 35, 38);
    const splitNotes = doc.splitTextToSize(data.notes.trim(), 160);
    doc.text(splitNotes, 25, currentY);
    currentY += splitNotes.length * 5.5 + 4;
  }

  // Caso não haja prescrições estruturadas nem notas, mas haja itens aplicados
  if (!hasPrescriptions && (!data.notes || !data.notes.trim()) && data.items && data.items.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(115, 31, 40);
    doc.text('MEDICAMENTOS E INSUMOS:', 25, currentY);
    currentY += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50, 35, 38);
    data.items.forEach((item) => {
      doc.text(`• ${item.quantity}x ${item.name}`, 28, currentY);
      currentY += 5.5;
    });
  }

  const safeName = (data.patientName || 'Paciente').replace(/\s+/g, '_');
  doc.save(`Receituario_${safeName}_${new Date().getTime()}.pdf`);
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

  // Metadados adicionais do Paciente (Pelagem, Fertilidade, Alergias)
  const extraMeta: string[] = [];
  if (data.color) extraMeta.push(`Pelagem: ${data.color}`);
  if (data.fertilityStatus) {
    const fertLabel = formatFertilityStatus(data.fertilityStatus);
    if (fertLabel) extraMeta.push(`Fertilidade: ${fertLabel}`);
  }
  if (data.fertilityNotes) extraMeta.push(`Obs. Reprodutiva: ${data.fertilityNotes}`);

  if (extraMeta.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(100, 65, 70);
    doc.text(extraMeta.join('   |   '), 105, currentY, { align: 'center' });
    currentY += 6;
  }

  if (data.clinicalObservations?.trim()) {
    doc.setFillColor(253, 232, 232);
    doc.roundedRect(25, currentY - 3.5, 160, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(160, 25, 35);
    const allergyLine = `ALERTA / OBSERVAÇÕES DO PACIENTE: ${data.clinicalObservations.trim()}`.slice(
      0,
      90
    );
    doc.text(allergyLine, 29, currentY + 1.5);
    currentY += 10;
  }

  // 1. Anamnese e Evolução Clínica
  doc.setFillColor(245, 216, 216);
  doc.roundedRect(25, currentY - 4, 160, 6.5, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(115, 31, 40);
  doc.text('ANAMNESE, EXAME FÍSICO E EVOLUÇÃO CLÍNICA', 29, currentY + 0.5);
  currentY += 7.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(45, 30, 32);
  const splitNotes = doc.splitTextToSize(
    data.notes?.trim() || 'Atendimento clínico realizado sem intercorrências adicionais.',
    158
  );

  for (const line of splitNotes) {
    if (currentY > 235) {
      addNewStationeryPage();
      currentY = 105;
    }
    doc.text(line, 26, currentY);
    currentY += 5.3;
  }

  currentY += 5;

  // 2. Procedimentos, Vacinas e Medicamentos Realizados em Consulta
  if (data.items && data.items.length > 0) {
    if (currentY > 225) {
      addNewStationeryPage();
      currentY = 105;
    }

    doc.setFillColor(245, 216, 216);
    doc.roundedRect(25, currentY - 4, 160, 6.5, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(115, 31, 40);
    doc.text('PROCEDIMENTOS, VACINAS E INSUMOS APLICADOS', 29, currentY + 0.5);
    currentY += 7.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(45, 30, 32);

    for (const item of data.items) {
      if (currentY > 238) {
        addNewStationeryPage();
        currentY = 105;
      }
      doc.text(`• ${item.quantity}x ${item.name}`, 28, currentY);
      currentY += 5.5;
    }
    currentY += 4;
  }

  // 3. Resumo de Prescrições Domiciliares (se houver)
  if (data.prescriptions && data.prescriptions.length > 0) {
    if (currentY > 220) {
      addNewStationeryPage();
      currentY = 105;
    }

    doc.setFillColor(245, 216, 216);
    doc.roundedRect(25, currentY - 4, 160, 6.5, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(115, 31, 40);
    doc.text('RESUMO DE PRESCRIÇÃO DOMICILIAR', 29, currentY + 0.5);
    currentY += 7.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(45, 30, 32);

    for (const rx of data.prescriptions) {
      if (currentY > 238) {
        addNewStationeryPage();
        currentY = 105;
      }
      const rxSummary = `• ${rx.medicationName}${
        rx.concentration ? ` (${rx.concentration})` : ''
      } — ${[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(', ')}`;
      const lines = doc.splitTextToSize(rxSummary, 155);
      doc.text(lines, 28, currentY);
      currentY += lines.length * 5;
    }
  }

  const safeName = (data.patientName || 'Paciente').replace(/\s+/g, '_');
  doc.save(`Relatorio_Atendimento_${safeName}_${new Date().getTime()}.pdf`);
}
