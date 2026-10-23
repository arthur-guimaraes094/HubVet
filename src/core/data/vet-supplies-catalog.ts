/**
 * Base curada de Vacinas, Medicamentos e Insumos Veterinários para Autocomplete
 * na Maleta (Catálogo) e no Módulo de Receitas.
 */

export interface VetCatalogSuggestion {
  name: string;
  category: 'Vaccine' | 'Medication' | 'Supply' | 'Consultation';
  concentration?: string;
  defaultRoute?: string;
  defaultFrequency?: string;
  defaultDuration?: string;
  protocolCode?: 'V10_VANGUARD' | 'ANTIRRABICA' | 'V5_FELINA' | 'GRIPE_ORAL';
}

export const VET_SUPPLIES_CATALOG: VetCatalogSuggestion[] = [
  // Protocolos Vacinais Principais
  {
    name: 'Vacina V10 Vanguard (Polivalente Canina)',
    category: 'Vaccine',
    concentration: 'Dose 1ml',
    defaultRoute: 'Uso Subcutâneo',
    protocolCode: 'V10_VANGUARD',
  },
  {
    name: 'Vacina Antirrábica',
    category: 'Vaccine',
    concentration: 'Dose 1ml',
    defaultRoute: 'Uso Subcutâneo',
    protocolCode: 'ANTIRRABICA',
  },
  {
    name: 'Vacina V5 Viral Felina (Quíntupla Felina)',
    category: 'Vaccine',
    concentration: 'Dose 1ml',
    defaultRoute: 'Uso Subcutâneo',
    protocolCode: 'V5_FELINA',
  },
  {
    name: 'Vacina Gripe Canina Oral (BronchiGuard / Nobivac KC)',
    category: 'Vaccine',
    concentration: 'Dose Única Oral',
    defaultRoute: 'Uso Oral / Intranasal',
    protocolCode: 'GRIPE_ORAL',
  },
  // Outras Vacinas Comuns
  {
    name: 'Vacina V8 Canina',
    category: 'Vaccine',
    concentration: 'Dose 1ml',
    defaultRoute: 'Uso Subcutâneo',
  },
  {
    name: 'Vacina V4 Felina (Quádrupla Felina)',
    category: 'Vaccine',
    concentration: 'Dose 1ml',
    defaultRoute: 'Uso Subcutâneo',
  },
  {
    name: 'Vacina Giárdia Canina',
    category: 'Vaccine',
    concentration: 'Dose 1ml',
    defaultRoute: 'Uso Subcutâneo',
  },
  {
    name: 'Vacina Leishmaniose (Leish-Tec)',
    category: 'Vaccine',
    concentration: 'Dose 1ml',
    defaultRoute: 'Uso Subcutâneo',
  },

  // Consultas e Procedimentos
  {
    name: 'Consulta Clínica Domiciliar',
    category: 'Consultation',
  },
  {
    name: 'Taxa de Deslocamento Domiciliar',
    category: 'Consultation',
  },
  {
    name: 'Coleta de Exames Laboratoriais (Hemograma / Bioquímico)',
    category: 'Supply',
  },
  {
    name: 'Teste Rápido FIV / FeLV',
    category: 'Supply',
  },
  {
    name: 'Teste Rápido Cinomose / Parvovirose',
    category: 'Supply',
  },
  {
    name: 'Teste Rápido Erliquiose / Doença do Carrapato (4Dx)',
    category: 'Supply',
  },
  {
    name: 'Limpeza Otológica / Curativo',
    category: 'Supply',
  },
  {
    name: 'Fluidoterapia Subcutânea / Endovenosa (Ringer c/ Lactato)',
    category: 'Supply',
    concentration: '500ml',
  },

  // Medicamentos Comuns (Injetáveis e Uso Oral/Domiciliar)
  {
    name: 'Dipirona Sódica Gotas / Solução',
    category: 'Medication',
    concentration: '500mg/ml',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 8 horas (TID) ou 12 horas (BID)',
    defaultDuration: 'Durante 3 a 5 dias',
  },
  {
    name: 'Meloxicam (Maxicam)',
    category: 'Medication',
    concentration: '0.5mg',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 24 horas (SID)',
    defaultDuration: 'Durante 3 a 5 dias',
  },
  {
    name: 'Meloxicam (Maxicam)',
    category: 'Medication',
    concentration: '2.0mg',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 24 horas (SID)',
    defaultDuration: 'Durante 3 a 5 dias',
  },
  {
    name: 'Meloxicam Injetável 0,2%',
    category: 'Medication',
    concentration: '2mg/ml',
    defaultRoute: 'Uso Subcutâneo',
  },
  {
    name: 'Cerenia (Citrato de Maropitant)',
    category: 'Medication',
    concentration: '10mg/ml',
    defaultRoute: 'Uso Subcutâneo',
    defaultFrequency: 'A cada 24 horas (SID)',
  },
  {
    name: 'Ondansetrona (Vonau Vet)',
    category: 'Medication',
    concentration: '5mg/ml',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 8 ou 12 horas',
    defaultDuration: 'Durante 5 dias',
  },
  {
    name: 'Amoxicilina + Clavulanato de Potássio (Agemoxi CL)',
    category: 'Medication',
    concentration: '50mg',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 12 horas (BID)',
    defaultDuration: 'Durante 7 a 10 dias',
  },
  {
    name: 'Amoxicilina + Clavulanato de Potássio (Agemoxi CL)',
    category: 'Medication',
    concentration: '250mg',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 12 horas (BID)',
    defaultDuration: 'Durante 7 a 10 dias',
  },
  {
    name: 'Doxiciclina (Doxifin)',
    category: 'Medication',
    concentration: '100mg',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 12 horas (BID) ou 24 horas (SID)',
    defaultDuration: 'Durante 21 a 28 dias',
  },
  {
    name: 'Cefalexina (Rilexine / Keflex)',
    category: 'Medication',
    concentration: '300mg',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 12 horas (BID)',
    defaultDuration: 'Durante 7 a 14 dias',
  },
  {
    name: 'Enrofloxacino (Baytril / Zelotril)',
    category: 'Medication',
    concentration: '50mg',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 24 horas (SID)',
    defaultDuration: 'Durante 7 dias',
  },
  {
    name: 'Prednisolona (Prediderm)',
    category: 'Medication',
    concentration: '5mg',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 24 horas (SID)',
    defaultDuration: 'Durante 5 dias',
  },
  {
    name: 'Prednisolona (Prediderm)',
    category: 'Medication',
    concentration: '20mg',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 24 horas (SID)',
    defaultDuration: 'Durante 5 dias',
  },
  {
    name: 'Dexametasona Injetável',
    category: 'Medication',
    concentration: '2mg/ml',
    defaultRoute: 'Uso Subcutâneo / IM',
  },
  {
    name: 'Tramadol (Cloridrato de Tramadol / Cronidor)',
    category: 'Medication',
    concentration: '50mg/ml',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 8 ou 12 horas',
    defaultDuration: 'Durante 5 dias',
  },
  {
    name: 'Gabapentina',
    category: 'Medication',
    concentration: '100mg',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 8 ou 12 horas',
    defaultDuration: 'Uso contínuo ou conforme orientação',
  },
  {
    name: 'Omeprazol (Gaviz V)',
    category: 'Medication',
    concentration: '10mg',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 24 horas (SID) em jejum',
    defaultDuration: 'Durante 7 a 14 dias',
  },
  {
    name: 'Probiótico Pet (Organew / Probiótico Vetnil)',
    category: 'Medication',
    concentration: '14g',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'A cada 24 horas (SID)',
    defaultDuration: 'Durante 5 dias',
  },
  {
    name: 'Simparic (Sarolaner)',
    category: 'Medication',
    concentration: 'Comprimido Mastigável',
    defaultRoute: 'Uso Oral',
    defaultFrequency: 'Dose única mensal',
    defaultDuration: 'Repetir a cada 35 dias',
  },
  {
    name: 'Bravecto (Fluralaner)',
    category: 'Medication',
    concentration: 'Comprimido / Transdérmico',
    defaultRoute: 'Uso Oral / Tópico',
    defaultFrequency: 'Dose única trimestral',
    defaultDuration: 'Repetir a cada 12 semanas',
  },
  {
    name: 'Revolution 6% (Selamectina)',
    category: 'Medication',
    concentration: 'Pipeta Spot-On',
    defaultRoute: 'Uso Tópico (Nuca)',
    defaultFrequency: 'Dose única mensal',
    defaultDuration: 'Repetir a cada 30 dias',
  },
  {
    name: 'Natalene / Auritop / Osurnia',
    category: 'Medication',
    concentration: 'Frasco Otológico',
    defaultRoute: 'Uso Otológico',
    defaultFrequency: 'A cada 12 horas (BID)',
    defaultDuration: 'Durante 7 a 10 dias',
  },
  {
    name: 'Tobramicina Colírio (Tobrex)',
    category: 'Medication',
    concentration: '3mg/ml',
    defaultRoute: 'Uso Oftálmico',
    defaultFrequency: '1 gota a cada 6 ou 8 horas',
    defaultDuration: 'Durante 7 dias',
  },
];
