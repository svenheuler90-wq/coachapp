import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.2.145', // WLAN
    '192.168.2.77',  // LAN
  ],
};

export default nextConfig;