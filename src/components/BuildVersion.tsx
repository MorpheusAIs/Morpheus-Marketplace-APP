'use client';

import { BUILD_VERSION } from '@/lib/build-version';

export function BuildVersion() {
  return (
    <div className="fixed bottom-2 right-2 z-50 opacity-40 hover:opacity-100 transition-opacity">
      <div className="bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-xs text-gray-400 font-mono">
        v{BUILD_VERSION}
      </div>
    </div>
  );
}

