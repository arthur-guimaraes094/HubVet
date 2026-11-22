"use client";

import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import type { PrescriptionItem } from '@/core/use-cases/generate-pdf';
import { VET_SUPPLIES_CATALOG } from '@/core/data/vet-supplies-catalog';
import {
  DEFAULT_PRESCRIPTION_TEMPLATES,
  type PrescriptionTemplate,
} from '@/core/data/prescription-templates';

interface ConsultationPrescriptionSectionProps {
  prescriptionText: string;
  onPrescriptionTextChange: React.Dispatch<React.SetStateAction<string>>;
  prescriptions: PrescriptionItem[];
  onPrescriptionsChange: React.Dispatch<React.SetStateAction<PrescriptionItem[]>>;
  catalogNames: string[];
  onNotifySuccess: (message: string) => void;
  onNotifyError: (message: string) => void;
}

export function ConsultationPrescriptionSection({
  prescriptionText,
  onPrescriptionTextChange,
  prescriptions,
  onPrescriptionsChange,
  catalogNames,
  onNotifySuccess,
  onNotifyError,
}: ConsultationPrescriptionSectionProps) {
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const [showRxForm, setShowRxForm] = useState(false);
  const [rxMedication, setRxMedication] = useState('');
  const [rxConcentration, setRxConcentration] = useState('');
  const [rxRoute, setRxRoute] = useState('Uso Oral');
  const [rxDosage, setRxDosage] = useState('');
  const [rxFrequency, setRxFrequency] = useState('');
  const [rxDuration, setRxDuration] = useState('');
  const [rxInstructions, setRxInstructions] = useState('');

  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [pendingReplaceTemplate, setPendingReplaceTemplate] =
    useState<PrescriptionTemplate | null>(null);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateTitleInput, setTemplateTitleInput] = useState('');

  const [customTemplates, setCustomTemplates] = useState<PrescriptionTemplate[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('hubvet_custom_prescription_templates');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.warn(e);
      }
    }
    return [];
  });

  const allTemplates = useMemo(
    () => [...customTemplates, ...DEFAULT_PRESCRIPTION_TEMPLATES],
    [customTemplates]
  );

  const filteredCatalog = useMemo(() => {
    const q = catalogSearchTerm.toLowerCase().trim();
    if (!q) return VET_SUPPLIES_CATALOG.slice(0, 10);
    return VET_SUPPLIES_CATALOG.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.concentration && c.concentration.toLowerCase().includes(q)) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.defaultRoute && c.defaultRoute.toLowerCase().includes(q))
    ).slice(0, 14);
  }, [catalogSearchTerm]);

  const applyReplaceTemplate = (template: PrescriptionTemplate) => {
    onPrescriptionTextChange(template.content);
    setPendingReplaceTemplate(null);
    setShowTemplatesModal(false);
    onNotifySuccess(`Modelo "${template.title}" aplicado!`);
  };

  const handleApplyTemplate = (
    template: PrescriptionTemplate,
    mode: 'append' | 'replace'
  ) => {
    if (mode === 'replace' && prescriptionText.trim()) {
      setPendingReplaceTemplate(template);
      return;
    }

    if (mode === 'replace') {
      applyReplaceTemplate(template);
    } else {
      onPrescriptionTextChange((prev) =>
        prev.trim() ? `${prev.trim()}\n\n${template.content}` : template.content
      );
      setShowTemplatesModal(false);
      onNotifySuccess(`Modelo "${template.title}" aplicado!`);
    }
  };

  const handleOpenSaveTemplateModal = () => {
    if (!prescriptionText.trim()) {
      onNotifyError('Escreva o texto da receita antes de salvar como modelo.');
      return;
    }
    setTemplateTitleInput('');
    setShowSaveTemplateModal(true);
  };

  const handleConfirmSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const title = templateTitleInput.trim();
    if (!title) {
      onNotifyError('Informe um nome para o modelo.');
      return;
    }

    const newTemplate: PrescriptionTemplate = {
      id: `custom-${Date.now()}`,
      title,
      category: 'Preventivo',
      description: 'Modelo salvo pela veterinária',
      content: prescriptionText.trim(),
    };

    const updated = [newTemplate, ...customTemplates];
    setCustomTemplates(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hubvet_custom_prescription_templates', JSON.stringify(updated));
    }
    setShowSaveTemplateModal(false);
    setTemplateTitleInput('');
    onNotifySuccess(`Modelo "${title}" salvo com sucesso!`);
  };

  const handleDeleteCustomTemplate = (id: string) => {
    const updated = customTemplates.filter((t) => t.id !== id);
    setCustomTemplates(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hubvet_custom_prescription_templates', JSON.stringify(updated));
    }
    onNotifySuccess('Modelo removido.');
  };

  const handleAppendCatalogItemToText = (
    valOrItem: string | (typeof VET_SUPPLIES_CATALOG)[0]
  ) => {
    const match =
      typeof valOrItem === 'string'
        ? VET_SUPPLIES_CATALOG.find((c) => c.name.toLowerCase() === valOrItem.toLowerCase())
        : valOrItem;

    if (!match) return;

    const parts = [
      `• ${match.name}${match.concentration ? ` (${match.concentration})` : ''}`,
      match.defaultRoute ? `  Via: ${match.defaultRoute}` : '',
      match.defaultFrequency ? `  Posologia: ${match.defaultFrequency}` : '',
      match.defaultDuration ? `  Duração: ${match.defaultDuration}` : '',
    ].filter(Boolean);

    const snippet = parts.join('\n');
    onPrescriptionTextChange((prev) =>
      prev.trim() ? `${prev.trim()}\n\n${snippet}\n` : `${snippet}\n`
    );
    onNotifySuccess(`${match.name} inserido no receituário!`);
  };

  const handleAppendTag = (tag: string) => {
    onPrescriptionTextChange((prev) =>
      prev.trim() ? `${prev.trim()}\n\n${tag}\n` : `${tag}\n`
    );
  };

  const handleSelectRxCatalogItem = (val: string) => {
    setRxMedication(val);
    const match = VET_SUPPLIES_CATALOG.find(
      (c) => c.name.toLowerCase() === val.toLowerCase()
    );
    if (match) {
      if (match.concentration) setRxConcentration(match.concentration);
      if (match.defaultRoute) setRxRoute(match.defaultRoute);
      if (match.defaultFrequency) setRxFrequency(match.defaultFrequency);
      if (match.defaultDuration) setRxDuration(match.defaultDuration);
    }
  };

  const handleAddPrescription = () => {
    if (!rxMedication.trim()) {
      onNotifyError('Informe o nome do medicamento para a receita.');
      return;
    }
    if (!rxDosage.trim() && !rxFrequency.trim()) {
      onNotifyError('Informe ao menos a dose ou frequência de administração.');
      return;
    }

    const newRx: PrescriptionItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      medicationName: rxMedication.trim(),
      concentration: rxConcentration.trim() || undefined,
      route: rxRoute.trim() || 'Uso Oral',
      dosage: rxDosage.trim(),
      frequency: rxFrequency.trim(),
      duration: rxDuration.trim(),
      instructions: rxInstructions.trim() || undefined,
    };

    onPrescriptionsChange((prev) => [...prev, newRx]);
    setRxMedication('');
    setRxConcentration('');
    setRxDosage('');
    setRxFrequency('');
    setRxDuration('');
    setRxInstructions('');
    setShowRxForm(false);
    onNotifySuccess('Medicamento adicionado ao receituário!');
  };

  const handleRemovePrescription = (id: string) => {
    onPrescriptionsChange((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <>
      <div className="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl bg-foreground/[0.02] border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-extrabold text-foreground text-base flex items-center gap-2">
              💊 Receituário Veterinário (Texto Livre)
              {prescriptionText.trim().length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-black">
                  Preenchido
                </span>
              )}
            </h4>
            <p className="text-xs text-foreground/50 font-medium mt-0.5">
              Digite livremente os medicamentos, doses e orientações. Sai formatado no papel timbrado oficial.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowTemplatesModal((prev) => !prev)}
              className="text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl hover:bg-amber-500/25 transition-colors shrink-0 flex items-center gap-1.5"
            >
              📋 {showTemplatesModal ? 'Fechar Modelos' : 'Modelos Prontos'}
            </button>
            <button
              type="button"
              onClick={() => setShowCatalogPicker((prev) => !prev)}
              className="text-xs font-black text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl hover:bg-primary/20 transition-colors shrink-0 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {showCatalogPicker ? 'Fechar Catálogo' : '+ Inserir do Catálogo'}
            </button>
            <button
              type="button"
              onClick={() => setShowRxForm((prev) => !prev)}
              className="text-xs font-bold text-foreground/60 hover:text-foreground bg-foreground/5 px-2.5 py-1.5 rounded-xl transition-colors shrink-0"
              title="Alternar para formulário estruturado detalhado"
            >
              {showRxForm ? 'Ocultar Estruturado' : 'Formulário Estruturado'}
            </button>
          </div>
        </div>

        {/* Painel de Modelos Clínicos de Prescrição */}
        {showTemplatesModal && (
          <div className="p-4 rounded-2xl bg-card border border-amber-500/30 shadow-sm flex flex-col gap-3 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2.5">
              <div>
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  📋 Modelos Clínicos de Prescrição ({allTemplates.length})
                </span>
                <p className="text-[11px] text-foreground/50">
                  Clique para inserir no receituário ou salve o texto atual como modelo
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenSaveTemplateModal}
                className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl hover:bg-primary/20 transition-all shrink-0 flex items-center gap-1"
              >
                ⭐ Salvar Receita Atual como Modelo
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {allTemplates.map((template) => {
                const isCustom = template.id.startsWith('custom-');
                return (
                  <div
                    key={template.id}
                    className="p-3 rounded-xl bg-foreground/[0.02] hover:bg-foreground/[0.04] border border-border flex flex-col justify-between gap-2 transition-all"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {template.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-foreground/10 text-foreground/70">
                            {template.category}
                          </span>
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomTemplate(template.id)}
                              className="text-[10px] text-error hover:text-error/80 px-1 font-bold"
                              title="Excluir este modelo personalizado"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-foreground/50 line-clamp-1">
                        {template.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(template, 'append')}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary/90 transition-all text-center"
                      >
                        + Inserir no Fim
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(template, 'replace')}
                        className="py-1.5 px-2 rounded-lg bg-card border border-border text-foreground/70 hover:text-foreground text-[11px] font-semibold transition-all"
                        title="Substituir todo o texto da receita por este modelo"
                      >
                        Substituir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Seletor rápido do catálogo de medicamentos */}
        {showCatalogPicker && (
          <div className="p-3.5 rounded-2xl bg-card border border-primary/25 shadow-sm flex flex-col gap-2.5 animate-in fade-in">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-primary uppercase tracking-wider">
                Catálogo Rápido de Medicamentos e Insumos
              </span>
              <span className="text-[11px] text-foreground/50">
                Clique para inserir no texto da receita
              </span>
            </div>
            <input
              type="text"
              value={catalogSearchTerm}
              onChange={(e) => setCatalogSearchTerm(e.target.value)}
              placeholder="Buscar medicamento (Ex: Dipirona, Meloxicam, Agemoxi, Prednisolona...)"
              className="w-full bg-foreground/5 border border-border rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pt-1">
              {filteredCatalog.map((item, idx) => (
                <button
                  key={`${item.name}-${item.concentration || ''}-${idx}`}
                  type="button"
                  onClick={() => handleAppendCatalogItemToText(item)}
                  className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-foreground/5 hover:bg-primary hover:text-white border border-border hover:border-primary transition-all text-left"
                >
                  <span className="text-xs font-black text-foreground group-hover:text-white">
                    {item.name}
                  </span>
                  {item.concentration && (
                    <span className="text-[10px] font-bold text-foreground/60 group-hover:text-white/80">
                      ({item.concentration})
                    </span>
                  )}
                  {item.defaultRoute && (
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-foreground/10 group-hover:bg-white/20 text-foreground/70 group-hover:text-white">
                      {item.defaultRoute}
                    </span>
                  )}
                </button>
              ))}
              {filteredCatalog.length === 0 && (
                <p className="text-xs text-foreground/40 italic py-2">
                  Nenhum medicamento encontrado para &quot;{catalogSearchTerm}&quot;.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Atalhos rápidos para organizar a receita */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[10px] font-extrabold text-foreground/50 uppercase tracking-wider mr-0.5">
            Atalhos:
          </span>
          {[
            'USO ORAL:',
            'USO TÓPICO:',
            'USO OTOLÓGICO:',
            'USO OFTÁLMICO:',
            'USO INJETÁVEL:',
            'RECOMENDAÇÕES GERAIS:',
          ].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleAppendTag(tag)}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-card border border-border hover:border-primary hover:text-primary transition-all text-foreground/75 active:scale-95"
            >
              + {tag.replace(':', '')}
            </button>
          ))}
        </div>

        {/* Campo de Texto Livre para o Receituário */}
        <div className="relative">
          <textarea
            value={prescriptionText}
            onChange={(e) => onPrescriptionTextChange(e.target.value)}
            rows={8}
            className="w-full bg-foreground/5 border border-border rounded-xl p-4 shadow-inner min-h-[180px] focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground resize-y text-sm font-sans leading-relaxed"
            placeholder={`Escreva a receita livremente. Exemplo:\n\nUSO ORAL:\n1. Dipirona gotas (500mg/ml) ----------------- 1 frasco\n   Dar 12 gotas por via oral a cada 8 horas por 3 dias, se dor ou febre.\n\n2. Gaviz V 10mg (Omeprazol) ------------------ 1 caixa\n   Dar 1 comprimido pela manhã em jejum por 10 dias.\n\nRECOMENDAÇÕES GERAIS:\n- Manter água fresca e ração úmida à disposição.\n- Retorno em 7 dias para reavaliação.`}
          />
          {prescriptionText && (
            <button
              type="button"
              onClick={() => onPrescriptionTextChange('')}
              className="absolute right-3 bottom-3 text-[10px] font-bold text-foreground/40 hover:text-error transition-colors px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm border border-border"
            >
              Limpar Texto
            </button>
          )}
        </div>

        {/* Modo estruturado opcional */}
        {showRxForm && (
          <div className="p-4 rounded-2xl bg-card border border-primary/20 flex flex-col gap-3 mt-1 animate-in fade-in">
            <span className="text-xs font-black text-primary uppercase tracking-wider">
              Adicionar Item Estruturado à Lista
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <AutocompleteInput
                  label="Medicamento *"
                  value={rxMedication}
                  onChange={handleSelectRxCatalogItem}
                  options={catalogNames}
                  placeholder="Digite ou busque (Ex: Dipirona, Agemoxi, Maxicam...)"
                />
              </div>
              <Input
                label="Concentração"
                value={rxConcentration}
                onChange={(e) => setRxConcentration(e.target.value)}
                placeholder="Ex: 50mg, 500mg/ml"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground/85">
                  Via de Administração
                </label>
                <select
                  value={rxRoute}
                  onChange={(e) => setRxRoute(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="Uso Oral">Uso Oral</option>
                  <option value="Uso Tópico">Uso Tópico</option>
                  <option value="Uso Otológico">Uso Otológico</option>
                  <option value="Uso Oftálmico">Uso Oftálmico</option>
                  <option value="Uso Subcutâneo">Uso Subcutâneo</option>
                  <option value="Uso Intranasal / Inalatório">Uso Intranasal / Inalatório</option>
                </select>
              </div>
              <Input
                label="Dose *"
                value={rxDosage}
                onChange={(e) => setRxDosage(e.target.value)}
                placeholder="Ex: 1 comprimido, 12 gotas"
              />
              <Input
                label="Frequência *"
                value={rxFrequency}
                onChange={(e) => setRxFrequency(e.target.value)}
                placeholder="Ex: A cada 12 horas (BID)"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Período / Duração"
                value={rxDuration}
                onChange={(e) => setRxDuration(e.target.value)}
                placeholder="Ex: Durante 7 dias"
              />
              <Input
                label="Observações (Opcional)"
                value={rxInstructions}
                onChange={(e) => setRxInstructions(e.target.value)}
                placeholder="Ex: Administrar após alimentação"
              />
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={handleAddPrescription}
              className="w-full py-2.5 text-xs font-black"
            >
              Adicionar à Lista Estruturada
            </Button>
          </div>
        )}

        {prescriptions.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            <span className="text-[11px] font-bold text-foreground/50 uppercase tracking-wider">
              Itens Estruturados Adicionados ({prescriptions.length})
            </span>
            {prescriptions.map((rx, idx) => (
              <div
                key={rx.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-primary">
                      {idx + 1}. {rx.medicationName}
                    </span>
                    {rx.concentration && (
                      <span className="text-[11px] font-bold text-foreground/60">
                        ({rx.concentration})
                      </span>
                    )}
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                      {rx.route}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/75 font-medium">
                    {[rx.dosage && `Dose: ${rx.dosage}`, rx.frequency, rx.duration]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                  {rx.instructions && (
                    <p className="text-[11px] text-foreground/50 italic">
                      Obs: {rx.instructions}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePrescription(rx.id)}
                  className="text-xs font-bold text-error hover:underline px-2 py-1 shrink-0"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de confirmação para substituir texto da receita */}
      <Modal
        isOpen={!!pendingReplaceTemplate}
        onClose={() => setPendingReplaceTemplate(null)}
        title="Substituir texto da receita?"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-foreground/75 leading-relaxed">
            Deseja substituir o texto atual da receita pelo modelo{' '}
            <strong className="text-foreground">
              &quot;{pendingReplaceTemplate?.title}&quot;
            </strong>
            ?
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPendingReplaceTemplate(null)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() =>
                pendingReplaceTemplate && applyReplaceTemplate(pendingReplaceTemplate)
              }
              className="flex-1"
            >
              Substituir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal para salvar receita atual como modelo personalizado */}
      <Modal
        isOpen={showSaveTemplateModal}
        onClose={() => setShowSaveTemplateModal(false)}
        title="Salvar Modelo de Receita"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmSaveTemplate} className="flex flex-col gap-5">
          <Input
            label="Nome do modelo *"
            value={templateTitleInput}
            onChange={(e) => setTemplateTitleInput(e.target.value)}
            placeholder="Ex: Minha Otite Padrão"
            required
            autoFocus
          />
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowSaveTemplateModal(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              Salvar Modelo
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
