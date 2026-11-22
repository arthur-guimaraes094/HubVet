import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/database/server';
import {
  COMMON_COAT_COLORS,
  FALLBACK_DOG_BREEDS_PT,
  FALLBACK_CAT_BREEDS_PT,
  BREED_TRANSLATIONS_EN_TO_PT,
} from '@/core/utils/pet-attributes';

interface ExternalBreed {
  name: string;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Não autenticado.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { searchParams } = new URL(request.url);
  const species = searchParams.get('species') || 'Canine';

  try {
    let externalBreeds: string[] = [];

    if (species === 'Canine') {
      const res = await fetch('https://api.thedogapi.com/v1/breeds', {
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 86400 },
      });
      if (res.ok) {
        const data = (await res.json()) as unknown;
        if (Array.isArray(data)) {
          externalBreeds = (data as ExternalBreed[])
            .filter((b) => typeof b?.name === 'string' && b.name.length > 0)
            .map((b) => BREED_TRANSLATIONS_EN_TO_PT[b.name] || b.name);
        }
      }
    } else if (species === 'Feline') {
      const res = await fetch('https://api.thecatapi.com/v1/breeds', {
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 86400 },
      });
      if (res.ok) {
        const data = (await res.json()) as unknown;
        if (Array.isArray(data)) {
          externalBreeds = (data as ExternalBreed[])
            .filter((b) => typeof b?.name === 'string' && b.name.length > 0)
            .map((b) => BREED_TRANSLATIONS_EN_TO_PT[b.name] || b.name);
        }
      }
    }

    const baseBreeds =
      species === 'Feline'
        ? FALLBACK_CAT_BREEDS_PT
        : species === 'Canine'
        ? FALLBACK_DOG_BREEDS_PT
        : [...FALLBACK_DOG_BREEDS_PT, ...FALLBACK_CAT_BREEDS_PT];

    // Unir sem duplicatas mantendo SRD no topo
    const mergedSet = new Set<string>(['SRD (Sem Raça Definida)', ...baseBreeds, ...externalBreeds]);
    const [srd, ...rest] = Array.from(mergedSet);
    const sortedBreeds = [srd, ...rest.sort((a, b) => a.localeCompare(b, 'pt-BR'))];

    return NextResponse.json(
      {
        breeds: sortedBreeds,
        colors: COMMON_COAT_COLORS,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=3600',
        },
      }
    );
  } catch {
    const fallback =
      species === 'Feline' ? FALLBACK_CAT_BREEDS_PT : FALLBACK_DOG_BREEDS_PT;
    return NextResponse.json(
      {
        breeds: fallback,
        colors: COMMON_COAT_COLORS,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
