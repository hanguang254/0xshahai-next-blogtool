/** @type {import('next').NextConfig} */
const nextConfig = {
    // async redirects() {
    //     return [
    //       {
    //         source: '/',
    //         destination: '/owner',
    //         permanent: true,
    //       },
    //     ];
    //   },
    exportPathMap: function () {
      return {
        "/": { page: "/owner" },
      };
    },
    useFileSystemPublicRoutes: true,
    useHashRouting: true,
};

export default nextConfig;
