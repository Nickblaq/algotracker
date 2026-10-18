import type { NextConfig } from 'next';

// Where the FastAPI backend lives. The browser never calls it directly: the
// rewrite below makes every /api/* request same-origin, exactly like the Vite
// dev proxy used to. `app/api/llm/route.ts` is a real route, so it wins over
// this rewrite (rewrites run after the filesystem).
const PYTHON_API = 'http://127.0.0.1:8000';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${PYTHON_API}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
