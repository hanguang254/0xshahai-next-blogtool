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
    useFileSystemPublicRoutes: true,
    useHashRouting: true,
};

export default nextConfig;
