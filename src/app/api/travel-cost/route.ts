import { NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/database/server';

const DEFAULT_ORIGIN_ADDRESS = 'Rua das Embarcações, 171, Nova Parnamirim, Parnamirim - RN';
const DEFAULT_ORIGIN_COORDS = { lat: -5.8914, lng: -35.2064 }; // Nova Parnamirim, RN
const DEFAULT_KM_RATE = 2.5;

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

async function geocodeAddress(address?: string | null, cep?: string | null): Promise<Coords | null> {
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
          return {
            lat: parseFloat(cepData.lat),
            lng: parseFloat(cepData.lng),
          };
        }
      }
    } catch {
      // continua para Nominatim
    }
  }

  // 2. Tentar Nominatim (OpenStreetMap)
  if (address && address.trim()) {
    const cleanQuery = address
      .replace(/CEP:\s*\d{5}-?\d{3}/gi, '')
      .replace(/\s+-\s+/g, ', ')
      .trim();

    const queries = [
      cleanQuery,
      `${cleanQuery}, Rio Grande do Norte, Brasil`,
    ];

    for (const q of queries) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'HubVet-App/1.0 (vetgabrielasoares@gmail.com)' },
          next: { revalidate: 86400 },
        });
        if (res.ok) {
          const results = await res.json();
          if (Array.isArray(results) && results.length > 0 && results[0].lat && results[0].lon) {
            return {
              lat: parseFloat(results[0].lat),
              lng: parseFloat(results[0].lon),
            };
          }
        }
      } catch {
        // tenta próxima query
      }
    }
  }

  return null;
}

function haversineRoadDistanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinDLng * sinDLng;
  const straightKm = 2 * R * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
  return straightKm * 1.3; // Fator de correção viária urbana
}

async function calculateDrivingDistanceKm(origin: Coords, dest: Coords): Promise<number> {
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
    const res = await fetch(osrmUrl, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0 && typeof data.routes[0].distance === 'number') {
        return data.routes[0].distance / 1000;
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
        if (typeof p.km_rate === 'number' && p.km_rate > 0) {
          kmRate = p.km_rate;
        }
        if (typeof p.base_lat === 'number' && typeof p.base_lng === 'number') {
          cachedOriginCoords = { lat: p.base_lat, lng: p.base_lng };
        }
      }
    }

    const originCoords =
      cachedOriginCoords ||
      (await geocodeAddress(originAddress, originCep)) ||
      DEFAULT_ORIGIN_COORDS;

    const destCoords = await geocodeAddress(destinationAddress, destinationCep);

    if (!destCoords) {
      return NextResponse.json(
        {
          error:
            'Não foi possível localizar as coordenadas exatas deste endereço. Confira o CEP ou rua/bairro.',
        },
        { status: 422 }
      );
    }

    const oneWayKmRaw = await calculateDrivingDistanceKm(originCoords, destCoords);
    const oneWayKm = Math.max(0.5, Number(oneWayKmRaw.toFixed(1)));
    const roundTripKm = Number((oneWayKm * 2).toFixed(1));
    const recommendedFee = Number((roundTripKm * kmRate).toFixed(2));

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
