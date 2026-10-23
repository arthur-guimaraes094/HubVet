# Plano de Implementação — HubVet (Novas Features & Melhorias)

Este documento detalha o plano arquitetural e técnico para implementar o pacote de melhorias do **HubVet**, dividido em **5 fases modulares** para garantir entregas seguras, testáveis e sem quebrar os fluxos existentes.

---

## 1. Alterações no Banco de Dados (Supabase Migrations)

Criaremos uma migration SQL consolidada para adicionar os novos campos mantendo total retrocompatibilidade com os dados já cadastrados:

### 1.1. Tabela `profiles` (Configurações da Veterinária)
- `base_cep` (`text`, opcional): CEP de partida da médica veterinária.
- `base_address` (`text`, opcional): Endereço base formatado.
- `base_lat` (`double precision`, opcional) & `base_lng` (`double precision`, opcional): Coordenadas em cache do endereço base para cálculo instantâneo de distância.
- `km_rate` (`numeric(10,2)`, default `2.50`): Valor cobrado por km rodado (R$/km) para sugerir o deslocamento.

### 1.2. Tabela `tutors` (Endereço Completo)
- `cep` (`text`, opcional)
- `street` (`text`, opcional)
- `number` (`text`, opcional)
- `complement` (`text`, opcional)
- `neighborhood` (`text`, opcional)
- `city` (`text`, opcional)
- `state` (`text`, opcional)
- `lat` (`double precision`, opcional) & `lng` (`double precision`, opcional)
- *Nota:* A coluna existente `address` continuará sendo preenchida automaticamente com a string formatada (`"Rua X, 123 - Comp - Bairro, Cidade/UF - CEP"`) para que todas as telas atuais funcionem sem interrupção.

### 1.3. Tabela `patients` (Foto, Idade, Fertilidade e Observações)
- `photo_url` (`text`, opcional): URL pública da foto do pet no Supabase Storage (bucket `patients`).
- `is_birth_date_estimated` (`boolean`, default `false`): Indica se `birth_date` foi calculada a partir de uma idade aproximada (anos/meses).
- `fertility_status` (`text`, opcional): `'Neutered'` (Castrado), `'Intact'` (Inteiro/Não castrado) ou `'Breeding'` (Reprodutor/Gestante).
- `fertility_notes` (`text`, opcional): Observações livres sobre fertilidade/cio/castração.
- `clinical_observations` (`text`, opcional): Alergias, doenças crônicas, restrições medicamentosas e comportamento.

### 1.4. Tabela `consultations` (Deslocamento e Receituário Estruturado)
- `travel_distance_km` (`numeric(10,2)`, opcional): Distância calculada (ida e volta).
- `travel_fee` (`numeric(10,2)`, default `0`): Taxa de deslocamento aplicada na consulta.
- `prescriptions` (`jsonb`, default `'[]'`): Lista estruturada de medicamentos prescritos para a receita:
  - `medicationName`, `concentration`, `dosage` (ex: `"1 comprimido"`), `route` (ex: `"Uso Oral"`), `frequency` (ex: `"A cada 12 horas"`), `duration` (ex: `"Durante 7 dias"`), `instructions`.

### 1.5. Nova Tabela `patient_vaccinations` (Protocolos Vacinais)
- `id` (`uuid`, PK)
- `profile_id` (`uuid`, FK `profiles.id`)
- `patient_id` (`uuid`, FK `patients.id`, `ON DELETE CASCADE`)
- `consultation_id` (`uuid`, FK `consultations.id`, opcional)
- `protocol_code` (`text`): `'V10_VANGUARD'`, `'ANTIRRABICA'`, `'V5_FELINA'`, `'GRIPE_ORAL'`, `'CUSTOM'`
- `vaccine_name` (`text`): Nome de exibição (ex: `"V10 Vanguard"`)
- `dose_number` (`integer`): `1`, `2`, `3` (para protocolos iniciais)
- `total_initial_doses` (`integer`): `3` (para V10 e V5) ou `1` (para Antirrábica e Gripe Oral)
- `is_annual_booster` (`boolean`, default `false`): `true` quando já está no ciclo anual
- `applied_date` (`date`, not null): Data em que a dose foi aplicada
- `next_due_date` (`date`, not null): Data programada da próxima dose (calculada automaticamente pela regra do protocolo)
- `next_dose_label` (`text`): Ex: `"2ª Dose (21 dias)"`, `"3ª Dose (21 dias)"` ou `"Reforço Anual"`
- `batch_number` (`text`, opcional): Lote/fabricante da vacina
- `notified_at` (`timestamptz`, opcional): Controle de envio de aviso
- `completed_by_vaccination_id` (`uuid`, opcional): Preenchido quando a dose seguinte é aplicada, marcando o ciclo anterior como concluído.

---

## 2. Detalhamento por Fase e Arquivos Impactados

### Fase 1: Cadastro Completo de Tutores e Pacientes + API de Raças e Cores
1. **API Externa de Raças e Cores (`src/app/api/breeds/route.ts` + `src/core/utils/pet-attributes.ts`)**:
   - Busca raças em `TheDogAPI` e `TheCatAPI` com cache no Next.js e dicionário/fallback completo em **Português (PT-BR)** (incluindo `"SRD (Sem Raça Definida)"` no topo).
   - Catálogo padronizado de pelagens/cores (Branco, Preto, Caramelo, Chocolate, Cinza/Azul, Dourado, Tigrado, Frajola, Tricolor/Calico, Escaminha, Siamês, Bicolor, Merle, etc.) com componente `AutocompleteInput` que permite selecionar da lista ou digitar livremente.
2. **Foto do Pet**:
   - Upload para bucket `patients` no Supabase Storage.
   - Exibição da miniatura redonda do pet nos cards de `PatientSearchList.tsx` (com fallback para `🐶`/`🐱`) e no cabeçalho de `src/app/pacientes/[id]/page.tsx`.
3. **Idade / Data de Nascimento (`src/core/utils/age.ts`)**:
   - Alternador no cadastro/edição: **"Data de Nascimento"** (input `date`) ou **"Idade Aproximada"** (inputs `Anos` e `Meses`, que convertem para `birth_date` estimada).
   - Função utilitária `formatPatientAge(birthDate)` que exibe ex: `"2 anos e 4 meses"` ou `"5 meses"` nos cards, prontuário e PDF.
4. **Fertilidade e Observações Clínicas (Alergias)**:
   - Seletor de fertilidade (`Castrado(a)`, `Inteiro(a)`, `Reprodutor/Gestante`) + campo de observação reprodutiva.
   - Campo de **Alergias e Observações Importantes** no pet. Quando preenchido, exibe um banner de alerta de destaque no topo do prontuário (`ConsultationForm.tsx`) e no perfil do paciente (`src/app/pacientes/[id]/page.tsx`).
5. **Endereço Completo do Tutor com Busca por CEP**:
   - Nos componentes `NewPatientForm.tsx` e `TutorList.tsx`, adicionar campo **CEP** com busca automática via `https://viacep.com.br/ws/{cep}/json/`, preenchendo Rua, Bairro, Cidade/UF e focando no campo **Número** e **Complemento**.

### Fase 2: Mapa na Consulta Domiciliar e Cálculo Recomendado de Deslocamento
1. **Botão de Redirecionamento para o Mapa (`AgendaClient.tsx`)**:
   - Em consultas do tipo `'Home'` (Domicílio) que possuam endereço da consulta ou do tutor, exibir botão **"📍 Abrir no Mapa"** diretamente no card da agenda (abrindo `https://www.google.com/maps/dir/?api=1&destination=...`).
2. **Cálculo Recomendado de Deslocamento (`src/app/api/travel-cost/route.ts`)**:
   - Adicionar em `ProfileForm.tsx` os campos: **CEP/Endereço Base de Partida** (padrão: `Rua das Embarcações, 171, Nova Parnamirim`) e **Valor por Km (R$/km)**.
   - Endpoint `/api/travel-cost` que obtém as coordenadas via **ViaCEP / Nominatim (OpenStreetMap)** e calcula a distância real de carro via **OSRM API** (`router.project-osrm.org`), sem custo de API.
   - Fórmula: `Custo Recomendado = (Distância de Ida em km × 2) × Taxa R$/km`.
   - Exibir sugestão em `ScheduleConsultationForm.tsx` e `ConsultationForm.tsx` com botão **"Adicionar Deslocamento (R$ XX,XX • XX km ida/volta)"**.

### Fase 3: Protocolos Vacinais e Avisos Programados
1. **Motor de Protocolos Vacinais (`src/core/use-cases/vaccine-protocols.ts`)**:
   - **V10 Vanguard (Canino)**: 3 doses iniciais com intervalo de 21 dias cada; finalizando as 3, reforço de 1 dose por ano (365 dias).
   - **Vacina Antirrábica (Canino/Felino)**: Dose única, reforço anual (365 dias).
   - **V5 Viral Felina (Felino)**: 3 doses iniciais com intervalo de 21 dias entre elas; em seguida, 1 dose anual (365 dias).
   - **Vacina Gripe Oral (Canino)**: Dose única, reforço de 1 dose anual (365 dias).
2. **Carteira de Vacinação e Aplicação (`src/components/features/VaccinationSection.tsx`)**:
   - Registro rápido na ficha do paciente e durante o atendimento no prontuário, calculando automaticamente a próxima dose e data.
3. **Avisos Programados e Lembrete WhatsApp**:
   - Atualização do Cron diário `src/app/api/cron/notify-upcoming/route.ts` para enviar **Notificação Push** à veterinária quando houver vacinas vencendo em até 7 dias ou hoje.
   - Card `VaccineAlertsCard.tsx` na Home/Agenda com botão de **1 clique para chamar o tutor no WhatsApp** com mensagem pronta sobre o retorno da vacina.

### Fase 4: Novo Design do Relatório de Atendimento e Módulo de Receitas (Papel Timbrado Oficial Dra. Gabriela Soares)
1. **Incorporação do Papel Timbrado Oficial (`public/templates/papel-timbrado-gabriela.png`)**:
   - Extrairemos em alta resolução a página do PDF enviado (`Gabriela Soares - Médica Veterinária`) para `public/templates/papel-timbrado-gabriela.png`, preservando fielmente toda a arte (barras em bordô `#731F28`, logo central com a patinha, caixas arredondadas de cabeçalho, marca d'água `"G"` ao fundo e rodapé com `Rua das embarcações, 171, Nova Parnamirim`, `vetgabrielasoares@gmail.com` e `(84) 98636-5455`).
   - O gerador em `src/core/use-cases/generate-pdf.ts` aplicará essa imagem como fundo A4 (`210mm x 297mm`) e preencherá os dados nas coordenadas exatas das caixas do modelo:
     - **`Paciente:`** → Nome do pet alinhado dentro da 1ª caixa.
     - **`Espécie Can ( ) Fel ( )`** → Marcação automática (`●` ou `X` em bordô) dentro do círculo de **Can** (para Cães) ou **Fel** (para Gatos).
     - **`Raça:`** → Raça do paciente alinhada na caixa direita da 2ª linha.
     - **`Peso:`** → Peso em `kg` na caixa esquerda da 3ª linha.
     - **`Idade:`** → Idade calculada (ex: `2 anos e 3 meses`) na caixa direita da 3ª linha.
     - **`Tutor:`** → Nome do tutor na 4ª caixa.
2. **Módulo de Receitas no Prontuário (`ConsultationForm.tsx`)**:
   - Seção dedicada **"Receituário / Prescrição Domiciliar"** separada dos itens cobrados na consulta, com campos de **Medicamento & Concentração**, **Dose**, **Via**, **Frequência**, **Duração** e **Instruções**.
3. **Dois Documentos Gerados sobre o Modelo Oficial (`src/core/use-cases/generate-pdf.ts`)**:
   - **PDF 1 — Relatório de Atendimento (`gerarPDFRelatorioAtendimento`)**: Resumo clínico, sinais vitais/observações, insumos e vacinas aplicados na consulta + datas de retorno vacinal + assinatura com CRMV.
   - **PDF 2 — Receituário Veterinário (`gerarPDFReceituario`)**: Prescrições agrupadas por via de administração (`USO ORAL`, `USO TÓPICO`, etc.) com posologia detalhada + assinatura com CRMV.

### Fase 5: Catálogo / API de Vacinas e Insumos Veterinários
- Como o MAPA/Sipeagro não disponibiliza uma API REST pública em tempo real para bulário/insumos veterinários no Brasil, criaremos uma **Base Veterinária Curada (`src/core/data/vet-supplies-catalog.ts` + `/api/vet-catalog`)** com autocomplete inteligente contendo as principais vacinas (V10 Vanguard, V8, V5 Felina, V4, Antirrábica, Gripe Oral, Giárdia, Leishmaniose) e medicamentos veterinários com suas concentrações padrão, agilizando o cadastro tanto na Maleta quanto no Receituário.
