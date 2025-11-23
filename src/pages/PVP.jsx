import React, { useEffect } from 'react';

export default function PVP() {
  useEffect(() => {
    window.open('https://pvp.1und1.net/#/avc', '_blank');
  }, []);

  return (
    <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
      <div className="text-center space-y-4">
        <div className="text-6xl">✓</div>
        <h2 className="text-2xl font-bold text-slate-900">PVP Portal wurde geöffnet</h2>
        <p className="text-slate-600">
          Das Portal wurde in einem neuen Tab geöffnet.
        </p>
      </div>
    </div>
  );
}