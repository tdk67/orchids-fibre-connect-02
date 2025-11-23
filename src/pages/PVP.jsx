import React from 'react';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function PVP() {
  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">PVP Portal</h1>
      </div>
      
      <Card className="flex-1 overflow-hidden border-0 shadow-lg relative">
        <iframe
          src="https://pvp.1und1.net/#/avc"
          className="w-full h-full border-0"
          title="PVP Portal"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
        />
        
        <div className="absolute top-4 right-4 bg-amber-50 border border-amber-200 rounded-lg p-3 max-w-md shadow-lg">
          <div className="flex gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">Hinweis</p>
              <p>Falls das Portal nicht lädt, blockiert die externe Website das Einbetten aus Sicherheitsgründen.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}