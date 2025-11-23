import React from 'react';

export default function PVP() {
  return (
    <div className="h-[calc(100vh-8rem)]">
      <iframe
        src="https://pvp.1und1.net/#/avc"
        className="w-full h-full border-0 rounded-lg shadow-md"
        title="PVP Portal"
        allow="fullscreen"
      />
    </div>
  );
}