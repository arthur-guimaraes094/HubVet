'use client'

import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/Button';

type PdfData = {
  patientName: string;
  species: string;
  breed?: string;
  tutorName: string;
  procedureType?: string;
};

export function ConsentPdfGenerator({ patientName, species, breed, tutorName, procedureType = 'Procedimento Veterinário' }: PdfData) {
  
  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Termo de Consentimento Livre e Esclarecido', 105, 20, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    
    const textLines = [
      `Eu, ${tutorName}, responsável legal pelo animal de nome ${patientName}, `,
      `da espécie ${species}${breed ? ` e raça ${breed}` : ''}, autorizo a realização do `,
      `procedimento de ${procedureType} nas dependências do HubVet.`,
      '',
      'Declaro ter sido devidamente informado(a) sobre os riscos, benefícios e ',
      'alternativas terapêuticas, compreendendo as possíveis complicações ',
      'anestésicas ou cirúrgicas inerentes a qualquer procedimento clínico.',
      '',
      'Autorizo também a equipe médico-veterinária a realizar os procedimentos ',
      'adicionais ou de emergência que se façam necessários para garantir o ',
      'bem-estar do paciente.',
      '',
      'Ao assinar este documento, assumo total responsabilidade financeira e ',
      'afirmo estar ciente de todos os termos acima descritos.'
    ];

    doc.text(textLines, 20, 40);

    // Signature section
    doc.text('_________________________________________________', 105, 150, { align: 'center' });
    doc.text('Assinatura do Responsável', 105, 160, { align: 'center' });
    
    const date = new Date().toLocaleDateString('pt-BR');
    doc.text(`Data: ${date}`, 105, 175, { align: 'center' });

    doc.save(`Termo_Consentimento_${patientName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <Button 
      variant="secondary" 
      onClick={generatePDF}
      className="text-sm !px-4 !py-2"
    >
      Gerar Termo (PDF)
    </Button>
  );
}
