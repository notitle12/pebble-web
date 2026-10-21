import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [{
      source: "/:path*",
      has: [{type: "host", value: "pebble-log.com"}],
      destination: "https://www.pebble-log.com/:path*",
      permanent: true,
    }];
  },
};
export default config;
