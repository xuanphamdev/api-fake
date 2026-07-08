/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/dashboard',
  assetPrefix: '/dashboard',
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/login',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
