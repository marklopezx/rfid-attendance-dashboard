import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add the new 10.0.0.187 IP here:
  allowedDevOrigins: [
    "10.0.0.187",
    "10.238.219.132",
    "172.20.193.132",
    "192.168.161.132",
  ],
};

export default nextConfig;
