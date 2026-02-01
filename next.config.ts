/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Keep TS config explicit so Next doesn't keep "helpfully" rewriting it.
  // (Does NOT disable type-checking.)
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
};

module.exports = nextConfig;
