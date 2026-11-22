import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/database/server';

const DEFAULT_ORIGIN_ADDRESS = 'Rua das Embarcações, 171, Nova Parnamirim, Parnamirim - RN';
const DEFAULT_ORIGIN_COORDS = { lat: -5.8914, lng: -35.2064 }; // Nova Parnamirim, RN
const DEFAULT_KM_RATE = 2.5;

// Limite máximo de raio para atendimento domiciliar (evita homônimos em outros estados)
const MAX_STRAIGHT_RADIUS_KM = 85;
const MAX_DRIVING_ONE_WAY_KM = 110;
const MAX_RECOMMENDED_FEE_BRL = 500;
const EXTERNAL_FETCH_TIMEOUT_MS = 5000;
const MAX_NOMINATIM_CALLS_PER_REQUEST = 4;

interface Coords {
  lat: number;
  lng: number;
}

interface NominatimBudget {
  remaining: number;
}

function extractCepDigits(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(/\b(\d{5})-?(\d{3})\b/);
  if (match) return `${match[1]}${match[2]}`;
  const digits = text.replace(/\D/g, '');
  if (digits.length === 8) return digits;
  return null;
}

function haversineStraightKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinDLng * sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

function haversineRoadDistanceKm(a: Coords, b: Coords): number {
  return haversineStraightKm(a, b) * 1.3; // Fator de correção viária urbana
}

function isWithinCoverageRadius(origin: Coords, candidate: Coords): boolean {
  if (!Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) {
    return false;
  }
  const distKm = haversineStraightKm(origin, candidate);
  return distKm <= MAX_STRAIGHT_RADIUS_KM;
}

async function queryNominatimBounded(
  query: string,
  center: Coords,
  budget: NominatimBudget
): Promise<Coords | null> {
  if (budget.remaining <= 0) {
    return null;
  }
  budget.remaining -= 1;

  // Bounding box de ~70km ao redor da base da veterinária (ex: Grande Natal / RN)
  const delta = 0.65;
  const viewbox = `${center.lng - delta},${center.lat + delta},${center.lng + delta},${center.lat - delta}`;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=br&viewbox=${viewbox}&bounded=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'HubVet-App/1.0 (vetgabrielasoares@gmail.com)' },
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
      next: { revalidate: 86400 },
    });
    if (res.ok) {
      const results = await res.json();
      if (Array.isArray(results)) {
        for (const item of results) {
          if (item.lat && item.lon) {
            const candidate = {
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            };
            if (isWithinCoverageRadius(center, candidate)) {
              return candidate;
            }
          }
        }
      }
    }
  } catch {
    // fallback silencioso
  }
  return null;
}

async function geocodeAddress(
  address: string | null | undefined,
  cep: string | null | undefined,
  referenceOrigin: Coords,
  nominatimBudget: NominatimBudget
): Promise<Coords | null> {
  const cepDigits = extractCepDigits(cep) || extractCepDigits(address);

  // 1. Tentar AwesomeAPI CEP (retorna lat/lng direto para CEPs brasileiros)
  if (cepDigits) {
    try {
      const cepRes = await fetch(`https://cep.awesomeapi.com.br/json/${cepDigits}`, {
        signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
        next: { revalidate: 86400 },
      });
      if (cepRes.ok) {
        const cepData = await cepRes.json();
        if (cepData.lat && cepData.lng) {
          const candidate = {
            lat: parseFloat(cepData.lat),
            lng: parseFloat(cepData.lng),
          };
          if (isWithinCoverageRadius(referenceOrigin, candidate)) {
            return candidate;
          }
        }
      }
    } catch {
      // continua para ViaCEP + Nominatim
    }

    // 1b. Buscar endereço oficial no ViaCEP pelo CEP e geocodificar no Nominatim local
    try {
      const viaRes = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
        signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
        next: { revalidate: 86400 },
      });
      if (viaRes.ok) {
        const viaData = await viaRes.json();
        if (!viaData.erro && viaData.localidade) {
          const viaQueries = [
            [viaData.logradouro, viaData.bairro, viaData.localidade, viaData.uf, 'Brasil']
              .filter(Boolean)
              .join(', '),
            [viaData.bairro, viaData.localidade, viaData.uf, 'Brasil']
              .filter(Boolean)
              .join(', '),
            [viaData.localidade, viaData.uf, 'Brasil'].filter(Boolean).join(', '),
          ];
          for (const vq of viaQueries) {
            if (nominatimBudget.remaining <= 0) break;
            const coords = await queryNominatimBounded(vq, referenceOrigin, nominatimBudget);
            if (coords) return coords;
          }
        }
      }
    } catch {
      // continua
    }
  }

  // 2. Tentar Nominatim (OpenStreetMap) restrito à região de cobertura (bounded=1)
  if (address && address.trim() && nominatimBudget.remaining > 0) {
    const cleanQuery = address
      .replace(/CEP:\s*\d{5}-?\d{3}/gi, '')
      .replace(/\b\d{5}-?\d{3}\b/g, '')
      .replace(/\s+-\s+/g, ', ')
      .replace(/,\s*,+/g, ',')
      .trim();

    // Versão sem número de imóvel/complemento caso o número exato não conste no OpenStreetMap
    const streetOnlyQuery = cleanQuery
      .replace(/,\s*\d+[A-Za-z]?\b/g, '')
      .replace(/\b(apto|ap|bloco|bl|casa|condominio|cond|lote|lt)\b[^,]*/gi, '')
      .replace(/,\s*,+/g, ',')
      .trim();

    const hasStateOrCity = /natal|parnamirim|maca[ií]ba|s[aã]o gon[cç]alo|extremoz|\brn\b|rio grande do norte/i.test(
      cleanQuery
    );

    const candidateQueries = [
      hasStateOrCity ? cleanQuery : `${cleanQuery}, Rio Grande do Norte, Brasil`,
      hasStateOrCity ? streetOnlyQuery : `${streetOnlyQuery}, Natal, RN, Brasil`,
      `${streetOnlyQuery}, Parnamirim, RN, Brasil`,
      cleanQuery,
      streetOnlyQuery,
    ];

    const uniqueQueries = Array.from(new Set(candidateQueries.filter((q) => q.length >= 3)));

    for (const q of uniqueQueries) {
      if (nominatimBudget.remaining <= 0) break;
      const coords = await queryNominatimBounded(q, referenceOrigin, nominatimBudget);
      if (coords) return coords;
    }
  }

  return null;
}

async function calculateDrivingDistanceKm(origin: Coords, dest: Coords): Promise<number> {
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
    const res = await fetch(osrmUrl, {
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const data = await res.json();
      if (
        data.routes &&
        data.routes.length > 0 &&
        typeof data.routes[0].distance === 'number' &&
        Number.isFinite(data.routes[0].distance)
      ) {
        const osrmKm = data.routes[0].distance / 1000;
        if (osrmKm <= MAX_DRIVING_ONE_WAY_KM) {
          return osrmKm;
        }
      }
    }
  } catch {
    // Fallback Haversine
  }
  return haversineRoadDistanceKm(origin, dest);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      const parsed = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    }

    const rawAddress = body.destinationAddress;
    const rawCep = body.destinationCep;

    if (
      (rawAddress !== undefined && rawAddress !== null && typeof rawAddress !== 'string') ||
      (rawCep !== undefined && rawCep !== null && typeof rawCep !== 'string')
    ) {
      return NextResponse.json(
        { error: 'Formato inválido para endereço ou CEP de destino.' },
        { status: 400 }
      );
    }

    const destinationAddress = typeof rawAddress === 'string' ? rawAddress.trim() : undefined;
    const destinationCep = typeof rawCep === 'string' ? rawCep.trim() : undefined;

    if (
      (destinationAddress && destinationAddress.length > 300) ||
      (destinationCep && destinationCep.length > 20)
    ) {
      return NextResponse.json(
        { error: 'Endereço ou CEP excede o limite de caracteres permitido.' },
        { status: 400 }
      );
    }

    if (!destinationAddress && !destinationCep) {
      return NextResponse.json(
        { error: 'Informe o endereço ou CEP de destino para calcular o deslocamento.' },
        { status: 400 }
      );
    }

    let originAddress = DEFAULT_ORIGIN_ADDRESS;
    let originCep: string | null = '59152-250';
    let kmRate = DEFAULT_KM_RATE;
    let cachedOriginCoords: Coords | null = null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('base_address, base_cep, km_rate, base_lat, base_lng')
      .eq('id', user.id)
      .single();

    if (profile) {
      if (typeof profile.base_address === 'string' && profile.base_address.trim()) {
        originAddress = profile.base_address;
      }
      if (typeof profile.base_cep === 'string' && profile.base_cep.trim()) {
        originCep = profile.base_cep;
      }
      if (
        typeof profile.km_rate === 'number' &&
        Number.isFinite(profile.km_rate) &&
        profile.km_rate > 0 &&
        profile.km_rate <= 50
      ) {
        kmRate = profile.km_rate;
      }
      if (
        typeof profile.base_lat === 'number' &&
        Number.isFinite(profile.base_lat) &&
        typeof profile.base_lng === 'number' &&
        Number.isFinite(profile.base_lng)
      ) {
        cachedOriginCoords = { lat: profile.base_lat, lng: profile.base_lng };
      }
    }

    const nominatimBudget: NominatimBudget = {
      remaining: MAX_NOMINATIM_CALLS_PER_REQUEST,
    };

    const originCoords =
      cachedOriginCoords ||
      (await geocodeAddress(originAddress, originCep, DEFAULT_ORIGIN_COORDS, nominatimBudget)) ||
      DEFAULT_ORIGIN_COORDS;

    const destCoords = await geocodeAddress(
      destinationAddress,
      destinationCep,
      originCoords,
      nominatimBudget
    );

    if (!destCoords) {
      return NextResponse.json(
        {
          error:
            'Não foi possível localizar este endereço na região de atendimento (Grande Natal/RN). Informe o CEP ou Rua + Bairro + Cidade.',
        },
        { status: 422 }
      );
    }

    const oneWayKmRaw = await calculateDrivingDistanceKm(originCoords, destCoords);

    if (oneWayKmRaw > MAX_DRIVING_ONE_WAY_KM) {
      return NextResponse.json(
        {
          error: `A distância calculada (${oneWayKmRaw.toFixed(
            1
          )} km) excede o limite de atendimento domiciliar (${MAX_DRIVING_ONE_WAY_KM} km). Confira o CEP ou Bairro/Cidade do endereço.`,
        },
        { status: 422 }
      );
    }

    const oneWayKm = Math.max(0.5, Number(oneWayKmRaw.toFixed(1)));
    const roundTripKm = Number((oneWayKm * 2).toFixed(1));
    const recommendedFee = Math.min(
      MAX_RECOMMENDED_FEE_BRL,
      Number((roundTripKm * kmRate).toFixed(2))
    );

    return NextResponse.json({
      originAddress,
      oneWayKm,
      roundTripKm,
      kmRate,
      recommendedFee,
    });
  } catch (err) {
    console.error(
      'Error calculating travel cost:',
      err instanceof Error ? err.message : 'Unknown error'
    );
    return NextResponse.json(
      { error: 'Erro ao calcular o custo de deslocamento.' },
      { status: 500 }
    );
  }
}
