import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ProductionEntry, Rate } from '../types';

// Helper function to generate HTML report content
const generateHTMLReportContent = (
  entries: ProductionEntry[],
  rates: Rate[],
  title: string,
  profile: { app_name: string; manager_name: string; manager_phone: string }
): string => {
  const getActiveRateForDate = (dateStr: string): number => {
    const sortedRates = [...rates].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    const matched = sortedRates.find(r => dateStr >= r.effective_from);
    return matched ? matched.rate_per_dozen : 5.0;
  };

  let totalFalls = 0;
  let totalIncome = 0;

  const rows = entries.map((e, index) => {
    const rate = getActiveRateForDate(e.entry_date);
    const income = (e.quantity / 12) * rate;
    totalFalls += e.quantity;
    totalIncome += income;

    return `
      <tr style="background-color: ${index % 2 === 1 ? '#F8FAFC' : '#FFFFFF'};">
        <td style="padding: 10px 8px; border-bottom: 1px solid #E2E8F0; font-size: 12px; color: #475569;">${e.entry_date}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #E2E8F0; font-size: 12px; font-weight: 600; color: #1E293B;">${e.color?.name || 'Unspecified'}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align: right; color: #1E293B; font-weight: bold;">${e.quantity.toLocaleString()}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 30px;
            color: #334155;
            background-color: #FFFFFF;
          }
          .header {
            border-bottom: 2px solid #0284C7;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .app-name {
            font-size: 26px;
            font-weight: 800;
            color: #0284C7;
            margin: 0 0 4px 0;
          }
          .manager-info {
            font-size: 12px;
            color: #64748B;
            margin: 0;
            font-weight: 500;
          }
          .report-title {
            font-size: 18px;
            font-weight: 800;
            color: #0F172A;
            margin: 0 0 6px 0;
          }
          .meta-row {
            font-size: 11px;
            color: #64748B;
            margin-bottom: 24px;
            font-weight: 500;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #0284C7;
            color: #FFFFFF;
            padding: 10px 8px;
            font-size: 12px;
            font-weight: 700;
            text-align: left;
          }
          .totals-row td {
            border-top: 2px solid #CBD5E1;
            padding: 16px 8px;
            font-size: 13px;
            font-weight: 800;
            color: #0F172A;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="app-name">${profile.app_name}</h1>
          <p class="manager-info">Manager: ${profile.manager_name} &bull; Phone: ${profile.manager_phone}</p>
        </div>

        <h2 class="report-title">${title}</h2>
        <div class="meta-row">
          Report Date: ${new Date().toLocaleDateString('en-IN')} &bull; Total Records: ${entries.length}
        </div>

        <table>
          <thead>
            <tr>
              <th style="border-top-left-radius: 6px; border-bottom-left-radius: 6px;">Date</th>
              <th>Color</th>
              <th style="text-align: right; border-top-right-radius: 6px; border-bottom-right-radius: 6px; padding-right: 12px;">Falls Count</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="totals-row">
              <td>Total Summary:</td>
              <td style="text-align: right;">${totalFalls.toLocaleString()} Falls</td>
              <td style="text-align: right; padding-right: 12px;">Total Income: Rs. ${totalIncome.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;
};

// Share PDF function (via standard mobile share-sheet)
export const exportEntriesToPDFMobile = async (
  entries: ProductionEntry[],
  rates: Rate[],
  title: string,
  profile: { app_name: string; manager_name: string; manager_phone: string }
) => {
  const htmlContent = generateHTMLReportContent(entries, rates, title, profile);

  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    
    // Copy the generated PDF to a friendly named file in the cache directory
    const FileSystem = require('expo-file-system/legacy');
    const friendlyFilename = `${title.replace(/[\s\(\):/]/g, '_')}.pdf`;
    const destinationUri = `${FileSystem.cacheDirectory}${friendlyFilename}`;
    
    // Remove if already exists to avoid copy error
    await FileSystem.deleteAsync(destinationUri, { idempotent: true });
    
    await FileSystem.copyAsync({
      from: uri,
      to: destinationUri
    });

    await Sharing.shareAsync(destinationUri, { 
      mimeType: 'application/pdf', 
      dialogTitle: 'Share PDF Report'
    });
  } catch (error) {
    console.error('Failed to export PDF:', error);
    throw error;
  }
};

// Download PDF function (via system print spooler with Save as PDF which shows download notifications)
export const saveEntriesToPDFMobile = async (
  entries: ProductionEntry[],
  rates: Rate[],
  title: string,
  profile: { app_name: string; manager_name: string; manager_phone: string }
) => {
  const htmlContent = generateHTMLReportContent(entries, rates, title, profile);

  try {
    await Print.printAsync({ html: htmlContent });
  } catch (error) {
    console.error('Failed to print PDF:', error);
    throw error;
  }
};

// Export to CSV function
export const exportEntriesToCSVMobile = async (
  entries: ProductionEntry[],
  rates: Rate[],
  title: string
) => {
  const getActiveRateForDate = (dateStr: string): number => {
    const sortedRates = [...rates].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    const matched = sortedRates.find(r => dateStr >= r.effective_from);
    return matched ? matched.rate_per_dozen : 5.0;
  };

  try {
    const headers = 'Date,Color,Quantity (Falls),Rate/Doz (Rs.),Earned Income (Rs.)\n';
    const rows = entries.map(e => {
      const rate = getActiveRateForDate(e.entry_date);
      const income = (e.quantity / 12) * rate;
      const colorName = e.color?.name || 'Unspecified';
      const escapedColor = `"${colorName.replace(/"/g, '""')}"`;
      return `${e.entry_date},${escapedColor},${e.quantity},${rate},${income.toFixed(2)}`;
    }).join('\n');

    const csvContent = headers + rows;
    
    const FileSystem = require('expo-file-system/legacy');
    const filename = `${title.replace(/\s+/g, '_')}_export.csv`;
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: 'Share CSV Report'
    });
  } catch (error) {
    console.error('Failed to export CSV:', error);
    throw error;
  }
};
