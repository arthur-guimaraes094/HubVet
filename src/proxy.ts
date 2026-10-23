import { type NextRequest } from 'next/server'
import { updateSession } from '@/infrastructure/database/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _vercel (Vercel internal preview/SSO/insights endpoints)
     * - favicon.ico (favicon file)
     * - manifest.json (PWA manifest)
     * - icons/ (PWA icons)
     * - templates/ (PDF stationery templates)
     */
    '/((?!_next/static|_next/image|_vercel|favicon.ico|manifest\\.json|icons/|templates/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
