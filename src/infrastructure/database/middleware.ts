import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

export async function updateSession(request: NextRequest) {
  // Não interceptar rotas internas da Vercel (SSO de Preview, Toolbar, Analytics)
  if (request.nextUrl.pathname.startsWith('/_vercel')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const isAuthRoute =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/cadastro')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')

  if (!session && !isAuthRoute && !isApiRoute) {
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

  if (session && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    const redirectResponse = NextResponse.redirect(url)
    redirectResponse.headers.set('Content-Type', 'text/html; charset=utf-8')
    return redirectResponse
  }

  return supabaseResponse
}
