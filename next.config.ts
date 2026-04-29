import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    'https://preview-chat-bb448876-8353-4373-a34f-99b5ef1b844a.space-z.ai',
  ],
};

export default nextConfig;
