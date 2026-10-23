import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/database/server';

const DEFAULT_ORIGIN_ADDRESS = 'Rua das Embarcações, 171, Nova Parnamirim, Parnamirim - RN';
const DEFAULT_ORIGIN_COORDS = { lat: -5.8914, lng: -35.2064 }; // Nova Parnamirim, RN
const DEFAULT_KM_RATE = 2.5;

// Limite máximo de raio para atendimento domiciliar (evita homônimos em outros estados)
const MAX_STRAIGHT_RADIUS_KM = 85;
const MAX_DRIVING_ONE_WAY_KM = 110;
const MAX_RECOMMENDED_FEE_BRL = 500;

interface Coords {
  lat: number;
  lng: number;
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
  const distKm = haversineStraightKm(origin, candidate);
  return distKm <= MAX_STRAIGHT_RADIUS_KM;
}

async function queryNominatimBounded(query: string, center: Coords): Promise<Coords | null> {
  // Bounding box de ~70km ao redor da base da veterinária (ex: Grande Natal / RN)
  const delta = 0.65;
  const viewbox = `${center.lng - delta},${center.lat + delta},${center.lng + delta},${center.lat - delta}`;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=br&viewbox=${viewbox}&bounded=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'HubVet-App/1.0 (vetgabrielasoares@gmail.com)' },
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
  address?: string | null,
  cep?: string | null,
  referenceOrigin: Coords = DEFAULT_ORIGIN_COORDS
): Promise<Coords | null> {
  const cepDigits = extractCepDigits(cep) || extractCepDigits(address);

  // 1. Tentar AwesomeAPI CEP (retorna lat/lng direto para CEPs brasileiros)
  if (cepDigits) {
    try {
      const cepRes = await fetch(`https://cep.awesomeapi.com.br/json/${cepDigits}`, {
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
            const coords = await queryNominatimBounded(vq, referenceOrigin);
            if (coords) return coords;
          }
        }
      }
    } catch {
      // continua
    }
  }

  // 2. Tentar Nominatim (OpenStreetMap) restrito à região de cobertura (bounded=1)
  if (address && address.trim()) {
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
      const coords = await queryNominatimBounded(q, referenceOrigin);
      if (coords) return coords;
    }
  }

  return null;
}

async function calculateDrivingDistanceKm(origin: Coords, dest: Coords): Promise<number> {
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
    const res = await fetch(osrmUrl, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0 && typeof data.routes[0].distance === 'number') {
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
    const body = await request.json();
    const destinationAddress: string | undefined = body.destinationAddress;
    const destinationCep: string | undefined = body.destinationCep;

    if (!destinationAddress && !destinationCep) {
      return NextResponse.json(
        { error: 'Informe o endereço ou CEP de destino para calcular o deslocamento.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let originAddress = DEFAULT_ORIGIN_ADDRESS;
    let originCep: string | null = '59152-250';
    let kmRate = DEFAULT_KM_RATE;
    let cachedOriginCoords: Coords | null = null;

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const p = profile as Record<string, unknown> | null;
      if (p) {
        if (typeof p.base_address === 'string' && p.base_address.trim()) {
          originAddress = p.base_address;
        }
        if (typeof p.base_cep === 'string' && p.base_cep.trim()) {
          originCep = p.base_cep;
        }
        if (typeof p.km_rate === 'number' && p.km_rate > 0 && p.km_rate <= 50) {
          kmRate = p.km_rate;
        }
        if (typeof p.base_lat === 'number' && typeof p.base_lng === 'number') {
          cachedOriginCoords = { lat: p.base_lat, lng: p.base_lng };
        }
      }
    }

    const originCoords =
      cachedOriginCoords ||
      (await geocodeAddress(originAddress, originCep, DEFAULT_ORIGIN_COORDS)) ||
      DEFAULT_ORIGIN_COORDS;

    const destCoords = await geocodeAddress(destinationAddress, destinationCep, originCoords);

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
    console.error('Error calculating travel cost:', err);
    return NextResponse.json(
      { error: 'Erro ao calcular o custo de deslocamento.' },
      { status: 500 }
    );
  }
}
