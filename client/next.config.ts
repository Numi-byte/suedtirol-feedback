import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Feedback submissions can include a photo of up to 10 MB. Leave room for
    // the multipart form fields and encoding overhead around that file.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
