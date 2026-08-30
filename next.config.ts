import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.20.193.132"],
};

export default function config() {
  return nextConfig;
}
