import React from 'react';

export default function CreditNoteDocument({ creditNote, employee, sales }) {
  // Provision ist Brutto - berechne Netto und MwSt
  const brutto = creditNote.total_commission || 0;
  const mwstRate = 0.19;
  const netto = brutto / (1 + mwstRate);
  const mwst = brutto - netto;

  return (
    <div id="credit-note-document" className="bg-white p-12 w-full h-full min-h-[297mm]" style={{ fontFamily: 'Arial, sans-serif', width: '210mm', height: '297mm' }}>
      {/* Header with Logo */}
      <div className="text-center mb-12">
        <img 
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691d914be3952e3190d4dbb7/fd4ebd25d_EE-logo-1-1e3f66-1024x576.png"
          alt="Career Agents"
          className="h-48 w-auto mx-auto object-contain"
        />
      </div>

      {/* Company Address */}
      <div className="text-xs text-slate-600 mb-8">
        CAREER AGENTS | Seelbacher Weg 4, 35764 Sinn, Germany
      </div>

      {/* Employee Address */}
      <div className="mb-12">
        <p className="font-semibold">{employee?.full_name || creditNote.employee_name}</p>
        {employee?.address && <p>{employee.address}</p>}
        {(employee?.postal_code || employee?.city) && (
          <p>{employee?.postal_code} {employee?.city}</p>
        )}
      </div>

      {/* Title and Details */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-6">Gutschrift</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-semibold">Datum:</span>
          </div>
          <div>
            {new Date(creditNote.issued_date).toLocaleDateString('de-DE')}
          </div>
          <div>
            <span className="font-semibold">Partner:</span>
          </div>
          <div>
            {creditNote.employee_name}
          </div>
          <div>
            <span className="font-semibold">Abrechnungsnummer:</span>
          </div>
          <div>
            {creditNote.credit_note_number}
          </div>
          <div>
            <span className="font-semibold">Steuernummer:</span>
          </div>
          <div>
            {employee?.tax_id || '021/809/37508'}
          </div>
        </div>
      </div>

      <p className="text-sm mb-8">
        Ihre Provisionsabrechnung/Gutschrift zum Stichtag {new Date(creditNote.issued_date).toLocaleDateString('de-DE')}
      </p>

      {/* Sales Table */}
      <div className="mb-8">
        <table className="w-full border-t-2 border-b-2 border-slate-800">
          <thead>
            <tr className="text-sm">
              <th className="text-left py-3 font-semibold">Kunde und Tarif</th>
              <th className="text-right py-3 font-semibold">Anzahl</th>
              <th className="text-right py-3 font-semibold">Netto</th>
              <th className="text-right py-3 font-semibold">MwSt</th>
              <th className="text-right py-3 font-semibold">Ust</th>
              <th className="text-right py-3 font-semibold">Brutto</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale, index) => {
              const saleBrutto = sale.commission_amount || 0;
              const saleNetto = saleBrutto / (1 + mwstRate);
              const saleMwst = saleBrutto - saleNetto;
              
              return (
                <tr key={index} className="text-sm border-b border-slate-200">
                  <td className="py-4">
                    <div className="font-semibold">{sale.customer_name}</div>
                    <div className="text-xs text-slate-600">
                      {sale.product || 'Tarif'}
                      {sale.bandwidth && ` - ${sale.bandwidth}`}
                      {sale.contract_duration_months && ` - ${sale.contract_duration_months} Monate`}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(sale.sale_date).toLocaleDateString('de-DE')}
                    </div>
                  </td>
                  <td className="text-right">1</td>
                  <td className="text-right">{saleNetto.toFixed(2)}</td>
                  <td className="text-right">19%</td>
                  <td className="text-right">{saleMwst.toFixed(2)}</td>
                  <td className="text-right">{saleBrutto.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-sm mb-8">
        Die Auszahlung erfolgt auf das von Ihnen angegebene Konto.
      </p>

      <div className="border-t border-slate-300 pt-4">
        {/* Summary */}
        <div className="flex justify-end">
          <div className="w-96">
            <div className="flex justify-between py-2">
              <span>Zwischensumme</span>
              <span className="font-semibold">{netto.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between py-2">
              <span>Steuerbetrag</span>
              <span className="font-semibold">{mwst.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between py-2 border-t-2 border-slate-800 mt-2 pt-2">
              <span className="font-bold">Gesamtbetrag</span>
              <span className="font-bold text-lg">{brutto.toFixed(2)} €</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-slate-300 text-center text-xs text-slate-600">
        <p>CAREER AGENTS | Seelbacher Weg 4, 35764 Sinn, Germany</p>
        <p>Postbank BIC: PBNKDEFF IBAN: DE33 1001 0010 0073 5071 40</p>
        <p>Steuernummer: 009 853 31159</p>
        <p>Steuer ID: DE361433334</p>
      </div>
    </div>
  );
}