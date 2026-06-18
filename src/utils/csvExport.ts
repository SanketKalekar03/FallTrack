import Papa from 'papaparse';
import type { ProductionEntry } from '../types';

export const exportEntriesToCSV = (
  entries: ProductionEntry[],
  getActiveRateForDate: (dateStr: string) => number
) => {
  const rows = entries.map((e) => {
    const rate = getActiveRateForDate(e.entry_date);
    const income = (e.quantity / 12) * rate;
    return {
      'Date': e.entry_date,
      'Color': e.color?.name || 'Unspecified',
      'Falls Count': e.quantity,
      'Rate/Dozen': `₹${rate}`,
      'Income': `₹${income.toFixed(2)}`
    };
  });

  const csvString = Papa.unparse(rows);
  
  // Use UTF-8 BOM (\uFEFF) to make sure Excel recognizes the Marathi unicode characters
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `FallTrack_Production_History_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
