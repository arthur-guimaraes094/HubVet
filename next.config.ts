import type { NextConfig } from "next";

function getSupabaseImagePatternBase(): { protocol: 'http' | 'https'; hostname: string } {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      return {
        protocol: parsed.protocol === 'http:' ? 'http' : 'https',
        hostname: parsed.hostname,
      };
    } catch {
      // Fallback caso NEXT_PUBLIC_SUPABASE_URL esteja malformada em tempo de build
    }
  }
  return {
    protocol: 'https',
    hostname: 'afggyuhfcbwocfcgxgkl.supabase.co',
  };
}

const supabaseImageBase = getSupabaseImagePatternBase();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: supabaseImageBase.protocol,
        hostname: supabaseImageBase.hostname,
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: supabaseImageBase.protocol,
        hostname: supabaseImageBase.hostname,
        pathname: '/storage/v1/object/sign/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
