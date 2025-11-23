import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export default function PVP() {
  const openPVP = () => {
    window.open('https://pvp.1und1.net/#/avc', '_blank', 'width=1400,height=900');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">PVP Portal</h1>
        <p className="text-slate-500 mt-1">Zugriff auf das 1&1 Versatel PVP System</p>
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>PVP Portal öffnen</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center">
          <div className="max-w-md mx-auto space-y-6">
            <div className="p-6 bg-blue-50 rounded-full w-24 h-24 mx-auto flex items-center justify-center">
              <ExternalLink className="h-12 w-12 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Öffnen Sie das PVP Portal
              </h3>
              <p className="text-slate-600">
                Klicken Sie auf den Button, um das PVP Portal in einem neuen Fenster zu öffnen.
              </p>
            </div>
            <Button
              onClick={openPVP}
              size="lg"
              className="bg-blue-900 hover:bg-blue-800"
            >
              <ExternalLink className="h-5 w-5 mr-2" />
              PVP Portal öffnen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}