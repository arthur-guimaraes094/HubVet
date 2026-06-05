import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

export async function updateSession(request: NextRequest) {
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

  // Usando getSession() no proxy para validação rápida (JWT local, sem HTTP).
  // A proteção real dos dados é feita via RLS + getUser() nas Server Actions.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/cadastro')
  
  if (!session && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const redirectResponse = NextResponse.redirect(url)
    
    // Limpar cookies do Supabase se a sessão for inválida
    // para evitar loops infinitos de Refresh Token Not Found
    request.cookies.getAll().forEach(cookie => {
      if (cookie.name.startsWith('sb-')) {
        redirectResponse.cookies.delete(cookie.name)
      }
    })
    
    return redirectResponse
  }

  if (session && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
