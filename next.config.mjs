/** @type {import('next').NextConfig} */
const nextConfig = {
    async redirects() {
        return [
          {
            source: '/',
            destination: '/owner',
            permanent: true,
          },
        ];
      },
};

export default nextConfig;
