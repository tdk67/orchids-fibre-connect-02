import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter } from 'lucide-react';

export default function BenutzertypFilter({ value, onChange, userRole }) {
  if (userRole !== 'admin') return null;

  return (
    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
      <Filter className="h-4 w-4 text-slate-500" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-48 border-0 focus:ring-0">
          <SelectValue placeholder="Daten-Ansicht" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Interner Mitarbeiter">Intern</SelectItem>
          <SelectItem value="Partner 1">Partner 1</SelectItem>
          <SelectItem value="Partner 2">Partner 2</SelectItem>
          <SelectItem value="Partner 3">Partner 3</SelectItem>
          <SelectItem value="Partner 4">Partner 4</SelectItem>
          <SelectItem value="Partner 5">Partner 5</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}