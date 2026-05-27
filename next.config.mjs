/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Automatically sets the asset subpath in production to match your GitHub repository name
  basePath: process.env.NODE_ENV === 'production' ? '/logMachine' : '',
};

export default nextConfig;


