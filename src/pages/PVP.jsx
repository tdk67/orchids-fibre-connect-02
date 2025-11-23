import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, X, Maximize2 } from 'lucide-react';

export default function PVP() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">PVP Portal</h1>
          <p className="text-slate-500 mt-1">Zugriff auf das 1&1 Versatel PVP System</p>
        </div>
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-blue-900 hover:bg-blue-800"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          PVP Portal öffnen
        </Button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-white">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-slate-50">
              <div className="flex items-center gap-3">
                <ExternalLink className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-slate-900">PVP Portal - 1&1 Versatel</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <iframe
              src="https://pvp.1und1.net/#/avc"
              className="flex-1 w-full border-0"
              title="PVP Portal"
              allow="fullscreen"
            />
          </div>
        </div>
      )}
    </div>
  );
}