import type { NextConfig } from 'next';

// Where the FastAPI backend lives. The browser never calls it directly: the
// rewrite below makes every /api/* request same-origin, exactly like the Vite
// dev proxy used to. `app/api/llm/route.ts` is a real route, so it wins over
// this rewrite (rewrites run after the filesystem).
const PYTHON_API = 'http://127.0.0.1:8000';

const nextConfig: NextConfig = {
  // Hosts allowed to load dev assets (the cloud preview origin). Dev-only.
  allowedDevOrigins: [
    'pv-777b3d2b2888-94bbd441-3e40-41a9-a637-3aecf2ed67dd.style.dev',
    'pv-6fb8957dae36-b5706805-f4e5-43f1-893a-b16d2f4c984d.style.dev',
  ],

  // Keep the dev overlay out of the app's own UI.
  devIndicators: false,

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
