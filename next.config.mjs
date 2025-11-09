/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Optimize images for production
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Disable x-powered-by header for security
  poweredByHeader: false,
  // Enable strict mode for React
  reactStrictMode: true,
  // Optimize bundle size
  productionBrowserSourceMaps: false,
  // Configure environment variables that should be available on the client
  env: {
    NEXT_PUBLIC_APP_NAME: 'FMCD Dashboard',
  },
};

export default nextConfig;
