export interface PrescriptionTemplate {
  id: string;
  title: string;
  category: 'Gastro' | 'Dermatologia' | 'Otologia' | 'Ortopedia / Dor' | 'Oftalmologia' | 'Preventivo';
  description: string;
  content: string;
}

export const DEFAULT_PRESCRIPTION_TEMPLATES: PrescriptionTemplate[] = [
  {
    id: 'gastro-inicial',
    title: 'Gastroenterite Aguda (Vômito / Diarreia)',
    category: 'Gastro',
    description: 'Protetor gástrico, antiemético, probiótico e dieta branda',
    content: `USO ORAL:
1. Gaviz V (Omeprazol 10mg) -------------------- 1 caixa
   Dar 1 comprimido por via oral, em jejum, 1x ao dia (pela manhã) durante 10 dias.

2. Vonau Flash 4mg (Ondansetrona) ------------- 1 caixa
   Dar 1 comprimido por via oral a cada 8 ou 12 horas, se houver náusea ou vômito, por até 3 dias.

3. Probiótico Veterinário (Pasta / Sachê) ------ 1 unidade
   Administrar por via oral conforme peso corporal, 1x ao dia durante 7 dias.

RECOMENDAÇÕES GERAIS:
- Dieta branda: peito de frango cozido desfiado com arroz branco (sem sal, sem alho e sem cebola) em pequenas porções várias vezes ao dia.
- Manter hidratação oral (água fresca ou soro caseiro/gatorade diluído).
- Retorno em caso de piora do quadro ou presença de sangue nas fezes.`,
  },
  {
    id: 'otite-mista',
    title: 'Otite Externa Mista (Bactéria / Fungo)',
    category: 'Otologia',
    description: 'Limpeza de conduto auditivo e gotas otológicas combinadas',
    content: `USO OTOLÓGICO:
1. Solução de Limpeza Auricular (Epiotic / Auritop Limp) -- 1 frasco
   Pingar no conduto auditivo, massagear a base da orelha por 30 segundos e remover o excesso delicadamente com gaze ou algodão seco. Fazer 15 minutos antes da medicação, 1x ao dia.

2. Suspensão Otológica (Auritop / Otomax / Posatex) -------- 1 frasco
   Pingar 4 gotas no conduto auditivo afetado a cada 12 horas (BID) durante 10 a 14 dias.

RECOMENDAÇÕES GERAIS:
- Não utilizar hastes flexíveis (cotonetes) no fundo do ouvido.
- Evitar entrada de água durante banhos (proteger os ouvidos com algodão parafinado).
- Retorno para reavaliação otoscópica em 10 dias.`,
  },
  {
    id: 'dermatite-alergica',
    title: 'Dermatite Alérgica & Prurido Intenso',
    category: 'Dermatologia',
    description: 'Controle de coceira, anti-inflamatório e shampoo terapêutico',
    content: `USO ORAL:
1. Prednisolona (Comprimidos ou Gotas) -------------------- 1 caixa
   Administrar por via oral a cada 24 horas durante 5 dias (dose de ataque), depois a cada 48 horas por mais 4 dias (desmame).

USO TÓPICO:
2. Shampoo Clorexiderm (Clorexidina 2% ou 3%) ------------ 1 frasco
   Banhar o animal 2 vezes por semana com água morna. Deixar a espuma agir em contato com a pele por 10 a 15 minutos antes de enxaguar bem.

RECOMENDAÇÕES GERAIS:
- Secar muito bem os pelos com secador na temperatura morna/fria.
- Manter o controle rigoroso de pulgas e carrapatos em dia.
- Retorno para avaliação dermatológica em 14 dias.`,
  },
  {
    id: 'dor-antiinflamatorio',
    title: 'Dor Aguda & Anti-inflamatório (Trauma / Coluna / Pata)',
    category: 'Ortopedia / Dor',
    description: 'Meloxicam + analgésico de suporte (Dipirona)',
    content: `USO ORAL:
1. Maxicam (Meloxicam comprimidos ou suspensão) ------------ 1 caixa
   Administrar por via oral 1 vez ao dia (a cada 24h), logo após refeição, durante 4 a 5 dias.

2. Dipirona Gotas (500mg/ml) ------------------------------ 1 frasco
   Administrar por via oral (1 gota por kg de peso corporal) a cada 8 horas se houver sinais de dor ou desconforto, por até 4 dias.

RECOMENDAÇÕES GERAIS:
- Manter o paciente em repouso estrito (evitar escadas, pulos em sofás/camas e corridas).
- Compressas mornas no local afetado por 10 minutos, 2x ao dia.
- Se persistir a claudicação (mancar), programar exame de imagem (Raio-X).`,
  },
  {
    id: 'conjuntivite-oftalmo',
    title: 'Conjuntivite & Afecções Oculares',
    category: 'Oftalmologia',
    description: 'Colírio antibiótico e lubrificante ocular',
    content: `USO OFTÁLMICO:
1. Colírio Antibiótico (Tobrex / Ciprofloxacino Ophthalmos) - 1 frasco
   Pingar 1 gota no olho afetado a cada 8 horas durante 7 dias.

2. Colírio Lubrificante (Lacrifilm / Hyabak) --------------- 1 frasco
   Pingar 1 gota no olho afetado a cada 6 a 8 horas (aguardar 10 minutos após o colírio antibiótico).

RECOMENDAÇÕES GERAIS:
- Fazer a limpeza da secreção ao redor do olho com gaze embebida em soro fisiológico estéril antes da aplicação dos colírios.
- Caso o animal tente coçar o olho, utilizar Colar Elizabetano imediatamente para prevenir lesão na córnea.`,
  },
  {
    id: 'vermifugacao-preventivo',
    title: 'Protocolo de Vermifugação Amplo Espectro',
    category: 'Preventivo',
    description: 'Desparasitação canina ou felina com reforço em 15 dias',
    content: `USO ORAL:
1. Vermífugo de Amplo Espectro (Drontal Plus / Endogard) --- 1 caixa
   Administrar dose de acordo com o peso corporal por via oral, em dose única.

RECOMENDAÇÕES GERAIS:
- REFORÇO OBRIGATÓRIO: Repetir a mesma dosagem daqui a exatos 15 dias para quebrar o ciclo biológico de ovos e larvas dos parasitas.
- Manter o ambiente limpo e recolher as fezes imediatamente.
- Realizar vermifugação preventiva a cada 3 a 6 meses.`,
  },
];
