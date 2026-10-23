import { NextResponse } from 'next/server';
import { VET_SUPPLIES_CATALOG } from '@/core/data/vet-supplies-catalog';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim().toLowerCase();
  const category = searchParams.get('category');

  let items = VET_SUPPLIES_CATALOG;

  if (category) {
    items = items.filter((i) => i.category === category);
  }

  if (query) {
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(query) ||
        (i.concentration && i.concentration.toLowerCase().includes(query))
    );
  }

  return NextResponse.json({ items });
}
