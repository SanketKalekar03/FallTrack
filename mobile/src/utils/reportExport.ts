import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ProductionEntry, Rate } from '../types';
import { formatDateToDDMMYYYY } from './dateFormatter';

// Helper function to generate HTML report content
const generateHTMLReportContent = (
  entries: ProductionEntry[],
  rates: Rate[],
  title: string,
  profile: { app_name: string; manager_name: string; manager_phone: string }
): string => {
  const formatDateToSlash = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr.replace(/-/g, '/');
  };

  const getMonthYearStr = (entriesList: ProductionEntry[]): string => {
    if (entriesList.length === 0) {
      const today = new Date();
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${months[today.getMonth()]}-${today.getFullYear()}`;
    }
    const sorted = [...entriesList].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
    const latestDate = sorted[0].entry_date;
    const parts = latestDate.split('-');
    if (parts.length === 3) {
      const monthIdx = parseInt(parts[1], 10) - 1;
      const year = parts[0];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${months[monthIdx]}-${year}`;
    }
    return '';
  };

  const currentMonthStr = getMonthYearStr(entries);

  let dateRange = '';
  if (entries.length > 0) {
    const dates = entries.map(e => e.entry_date).sort();
    dateRange = `${formatDateToSlash(dates[0])} to ${formatDateToSlash(dates[dates.length - 1])}`;
  } else {
    dateRange = `${formatDateToSlash(new Date().toISOString().split('T')[0])}`;
  }

  const getActiveRateForDate = (dateStr: string): number => {
    const sortedRates = [...rates].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    const matched = sortedRates.find(r => dateStr >= r.effective_from);
    return matched ? matched.rate_per_dozen : 5.0;
  };

  const uniqueRates = Array.from(new Set(entries.map(e => getActiveRateForDate(e.entry_date))));
  const rateText = uniqueRates.length === 1 
    ? `${uniqueRates[0].toFixed(2)}` 
    : `${Math.min(...uniqueRates).toFixed(2)} - ${Math.max(...uniqueRates).toFixed(2)}`;

  let totalFalls = 0;
  let totalIncome = 0;
  let lastPrintedDate = '';

  const rows = entries.map((e, index) => {
    const rate = getActiveRateForDate(e.entry_date);
    const income = (e.quantity / 12) * rate;
    totalFalls += e.quantity;
    totalIncome += income;

    const dateToPrint = e.entry_date === lastPrintedDate ? '' : formatDateToDDMMYYYY(e.entry_date);
    lastPrintedDate = e.entry_date;

    return `
      <tr style="background-color: ${index % 2 === 1 ? '#F8FAFC' : '#FFFFFF'};">
        <td style="padding: 10px 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px; color: #475569;">${dateToPrint}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px; font-weight: 600; color: #334155;">${e.color?.name || 'Unspecified'}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #F1F5F9; font-size: 12px; text-align: right; color: #334155; font-weight: bold; padding-right: 12px;">${e.quantity.toLocaleString()}</td>
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
          @page {
            margin: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #334155;
            background-color: #FFFFFF;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header-container {
            background-color: #0F172A;
            padding: 24px 30px;
            border-bottom: 4px solid #EA580C;
            color: #FFFFFF;
          }
          .header-flex {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .header-left h1 {
            font-size: 24px;
            font-weight: 800;
            margin: 0;
            letter-spacing: 0.5px;
          }
          .header-left p {
            font-size: 8px;
            color: #BAE6FD;
            margin: 4px 0 0 0;
            font-weight: 600;
            letter-spacing: 0.5px;
          }
          .header-right {
            text-align: right;
          }
          .header-right h2 {
            font-size: 12px;
            font-weight: 800;
            margin: 0;
            letter-spacing: 0.5px;
          }
          .header-right p {
            font-size: 10px;
            color: #E0F2FE;
            margin: 4px 0 0 0;
          }
          .content {
            padding: 30px;
            padding-bottom: 60px;
          }
          .report-metadata {
            margin-bottom: 24px;
            border-bottom: 1px solid #E2E8F0;
            padding-bottom: 12px;
          }
          .report-metadata-title {
            font-size: 11px;
            font-weight: 800;
            color: #1E293B;
            margin: 0 0 8px 0;
            letter-spacing: 0.5px;
          }
          .metadata-flex {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #64748B;
            font-weight: 500;
          }
          .metadata-col {
            line-height: 1.6;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #0F172A;
            color: #FFFFFF;
            padding: 10px 8px;
            font-size: 11px;
            font-weight: 700;
            text-align: left;
          }
          th.text-right {
            text-align: right;
            padding-right: 12px;
          }
          .totals-row td {
            border-top: 2px solid #CBD5E1;
            padding: 16px 8px;
            font-size: 12px;
            font-weight: 800;
            color: #0F172A;
          }
          .footer {
            position: fixed;
            bottom: 20px;
            left: 30px;
            right: 30px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #94A3B8;
            border-top: 1px solid #F1F5F9;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div class="header-flex">
            <div class="header-left">
              <h1>${profile.app_name.toUpperCase()}</h1>
              <p>THE ULTIMATE SAREE FALL LEDGER PLATFORM</p>
            </div>
            <div class="header-right">
              <h2>PRODUCTION REPORT</h2>
              <p>Name: ${profile.manager_name} &bull; Phone: ${profile.manager_phone}</p>
              <p style="font-size: 9px; opacity: 0.85; margin: 4px 0 0 0;">Generated: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
            </div>
          </div>
        </div>

        <div class="content">
          <div class="report-metadata">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; position: relative;">
              <h3 class="report-metadata-title" style="margin: 0;">REPORT METADATA</h3>
              <div style="position: absolute; left: 50%; transform: translateX(-50%); font-size: 11px; font-weight: 800; color: #1E293B; letter-spacing: 0.5px;">${currentMonthStr}</div>
              <div style="width: 100px;"></div>
            </div>
            <div class="metadata-flex">
              <div class="metadata-col">
                <div>${dateRange}</div>
                <div>Rate Card: Rs. ${rateText} per Dozen</div>
              </div>
              <div class="metadata-col" style="text-align: right;">
                <div>Total Log Records: ${entries.length}</div>
                <div>Export Source: Mobile App</div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="border-top-left-radius: 4px; border-bottom-left-radius: 4px;">Date</th>
                <th>Color</th>
                <th class="text-right" style="border-top-right-radius: 4px; border-bottom-right-radius: 4px;">Falls Count</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="totals-row">
                <td>Total Summary:</td>
                <td style="font-weight: 800; color: #0F172A;">${totalFalls.toLocaleString()} Falls</td>
                <td style="text-align: right; padding-right: 12px; font-weight: 800; color: #0F172A;">Total Income: Rs. ${totalIncome.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="footer">
          <div>&copy; ${new Date().getFullYear()} ${profile.app_name} Technologies. All rights reserved.</div>
          <div>Page 1 of 1</div>
        </div>
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
