import { jsPDF } from 'jspdf';

export function gerarPDFReceituario(data: {
  tutorName: string;
  patientName: string;
  species?: string;
  breed?: string;
  color?: string;
  weight?: string;
  notes: string;
  date: string;
  items?: { name: string; quantity: number }[];
}) {
  const doc = new jsPDF();
  
  // Cabeçalho
  doc.setFontSize(22);
  doc.setTextColor(59, 130, 246); // Primary Color
  doc.text('HubVet - Atendimento Veterinário', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('CRMV-XX 12345 | Atendimento Domiciliar', 105, 26, { align: 'center' });
  doc.line(20, 30, 190, 30);

  // Informações do Paciente e Tutor
  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO PACIENTE:', 20, 42);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`Tutor: ${data.tutorName}`, 20, 50);
  doc.text(`Paciente: ${data.patientName}`, 20, 57);
  doc.text(`Data: ${new Date(data.date).toLocaleDateString('pt-BR')}`, 140, 50);

  // Segunda coluna de dados do paciente
  const patientDetails = [];
  if (data.species) patientDetails.push(`Espécie: ${data.species}`);
  if (data.breed) patientDetails.push(`Raça: ${data.breed}`);
  if (data.color) patientDetails.push(`Cor: ${data.color}`);
  if (data.weight) patientDetails.push(`Peso: ${data.weight} kg`);

  let detailsY = 57;
  if (patientDetails.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(patientDetails.join(' | '), 20, 64);
    detailsY = 64;
  }
  
  doc.line(20, detailsY + 4, 190, detailsY + 4);

  // Corpo (Laudo/Receita)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESCRIÇÃO E LAUDO CLÍNICO', 105, detailsY + 15, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  // O notes pode ser grande, dividimos em linhas
  const splitText = doc.splitTextToSize(data.notes || 'Sem observações clínicas.', 170);
  doc.text(splitText, 20, detailsY + 25);

  // Insumos Utilizados
  let currentY = detailsY + 25 + (splitText.length * 7);
  
  if (data.items && data.items.length > 0) {
    currentY += 10;
    doc.setFont('helvetica', 'bold');
    doc.text('INSUMOS E MEDICAMENTOS APLICADOS:', 20, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 7;
    
    data.items.forEach(item => {
      doc.text(`- ${item.quantity}x ${item.name}`, 25, currentY);
      currentY += 6;
    });
  }

  // Assinatura (Simulada para o MVP)
  doc.line(105, 250, 190, 250);
  doc.setFontSize(14);
  doc.setFont('times', 'italic');
  doc.setTextColor(0, 0, 100);
  doc.text('Assinado Eletronicamente', 147.5, 248, { align: 'center' }); // Simulando assinatura
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text('Médica Veterinária Responsável', 147.5, 255, { align: 'center' });

  // Salvar o arquivo
  doc.save(`Receita_${data.patientName.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
}
