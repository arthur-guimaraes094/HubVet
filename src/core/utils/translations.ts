export function translateSpecies(species: string | null): string {
  if (!species) return 'Não informado';
  
  const translations: Record<string, string> = {
    'Canine': 'Cão',
    'Feline': 'Gato',
    'Equine': 'Cavalo',
    'Bovine': 'Bovino',
    'Bird': 'Ave',
    'Other': 'Outro'
  };

  return translations[species] || species;
}
