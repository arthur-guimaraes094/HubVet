import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

export async function updateSession(request: NextRequest) {
  // Não interceptar rotas internas da Vercel (SSO de Preview, Toolbar, Analytics)
  if (request.nextUrl.pathname.startsWith('/_vercel')) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Fail-closed caso as Environment Variables de ambiente ainda não estejam disponíveis
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in this Vercel environment/branch.'
    )
    const isLogin = request.nextUrl.pathname.startsWith('/login')
    const isApi = request.nextUrl.pathname.startsWith('/api')
    if (isApi) {
      return NextResponse.json({ error: 'Serviço indisponível' }, { status: 503 })
    }
    if (!isLogin) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      const redirectResponse = NextResponse.redirect(url)
      redirectResponse.headers.set('Content-Type', 'text/html; charset=utf-8')
      return redirectResponse
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: claimsData } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(claimsData?.claims?.sub)

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')

  if (!isAuthenticated && !isAuthRoute && !isApiRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    const redirectResponse = NextResponse.redirect(url)
    redirectResponse.headers.set('Content-Type', 'text/html; charset=utf-8')

    // Limpar cookies do Supabase se a sessão for inválida
    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name.startsWith('sb-')) {
        redirectResponse.cookies.delete(cookie.name)
      }
    })

    return redirectResponse
  }

  if (isAuthenticated && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    const redirectResponse = NextResponse.redirect(url)
    redirectResponse.headers.set('Content-Type', 'text/html; charset=utf-8')
    return redirectResponse
  }

  return supabaseResponse
}
