/**
 * Utilitários para busca de CEP via ViaCEP e formatação padronizada de endereço completo.
 */

export interface StructuredAddress {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatFullAddress(addr: StructuredAddress): string {
  const parts: string[] = [];

  if (addr.street?.trim()) {
    const streetWithNumber = addr.number?.trim()
      ? `${addr.street.trim()}, ${addr.number.trim()}`
      : addr.street.trim();
    parts.push(streetWithNumber);
  }

  if (addr.complement?.trim()) {
    parts.push(addr.complement.trim());
  }

  if (addr.neighborhood?.trim()) {
    parts.push(addr.neighborhood.trim());
  }

  if (addr.city?.trim() || addr.state?.trim()) {
    const cityState = [addr.city?.trim(), addr.state?.trim()].filter(Boolean).join('/');
    if (cityState) parts.push(cityState);
  }

  if (addr.cep?.trim()) {
    parts.push(`CEP: ${formatCep(addr.cep)}`);
  }

  return parts.join(' - ');
}

export async function fetchAddressByCep(rawCep: string): Promise<{
  street: string;
  neighborhood: string;
  city: string;
  state: string;
} | null> {
  const digits = rawCep.replace(/\D/g, '');
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;

    return {
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
    };
  } catch {
    return null;
  }
}

export function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`;
}
