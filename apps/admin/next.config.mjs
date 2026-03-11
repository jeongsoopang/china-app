/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@foryou/supabase", "@foryou/types", "@foryou/utils", "@foryou/ui"]
};

export default nextConfig;
