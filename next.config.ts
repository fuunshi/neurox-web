import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        /**
         * The verification and reset links carry their token in the query
         * string. `no-referrer` stops that URL travelling to any third party the
         * page later loads — without it, a font or image request would hand the
         * token to someone else in a `Referer` header.
         */
        source: "/auth/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
      {
        // Reset lives at the root, not under /auth, because that is the path the
        // backend's email template builds.
        source: "/reset-password",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
