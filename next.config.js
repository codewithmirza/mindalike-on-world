/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Export as static site for Cloudflare Workers
  output: 'export',
  
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  
  // Trailing slash for proper routing
  trailingSlash: false,
  
  // Handle MiniKit properly
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
};

module.exports = nextConfig;
