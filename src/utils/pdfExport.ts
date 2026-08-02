import { jsPDF } from 'jspdf';
import type { ProductionEntry } from '../types';
import { getActiveUserId } from '../services/dbService';

/**
 * Formats a date string from YYYY-MM-DD to DD-MM-YYYY for user display.
 */
const formatDateToDDMMYYYY = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

/**
 * Renders Devanagari text to a high-DPI canvas and returns a PNG Data URL.
 * This utilizes the browser's native text shaper and fonts to ensure Devanagari
 * script ligatures and matras are rendered perfectly without corruption.
 */
const renderMarathiTextToImage = (text: string): string => {
  const canvas = document.createElement('canvas');
  // High-DPI dimensions for crisp rendering in the PDF
  canvas.width = 600;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw text with a fallback chain supporting Marathi/Devanagari fonts
    ctx.font = '500 50px "Noto Sans Devanagari", "Poppins", "Kohinoor Devanagari", "Segoe UI", sans-serif';
    ctx.fillStyle = '#334155'; // Matching dark slate row text color (#334155)
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 40);
  }
  return canvas.toDataURL('image/png');
};

export const exportEntriesToPDF = (
  entries: ProductionEntry[],
  getActiveRateForDate: (dateStr: string) => number,
  titleText: string = 'FallTrack Production Report'
) => {
  const userId = getActiveUserId();
  const appName = localStorage.getItem(`falltrack_app_name_${userId}`) || 'FallTrack';
  const managerName = localStorage.getItem(`falltrack_profile_name_${userId}`) || 'Manager';
  const managerPhone = localStorage.getItem(`falltrack_profile_phone_${userId}`) || '9876543210';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let pageNumber = 1;

  // Helper to draw standard page footer
  const addFooter = (pageNum: number) => {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // #94A3B8 (Muted Slate)
    doc.text(`© ${new Date().getFullYear()} ${appName} Technologies. All rights reserved.`, 14, 287);
    doc.text(`Page ${pageNum}`, 196, 287, { align: 'right' });
  };

  // --- 1. PREMIUM HEADER BLOCK ---
  // Dark Navy Header Block
  doc.setFillColor(15, 23, 42); // #0F172A (Dark Navy)
  doc.rect(0, 0, 210, 24, 'F');

  // Orange Accent Line
  doc.setFillColor(234, 88, 12); // #EA580C (Orange)
  doc.rect(0, 24, 210, 2, 'F');

  // App Name
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text(appName.toUpperCase(), 14, 15);

  // Subtitle
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(186, 230, 253); // #BAE6FD (Light sky blue)
  doc.text('THE ULTIMATE SAREE FALL LEDGER PLATFORM', 14, 20);

  // Report Title (Right aligned)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('PRODUCTION REPORT', 196, 11, { align: 'right' });

  // Metadata (Right aligned)
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(224, 242, 254); // #E0F2FE (Very light sky blue)
  doc.text(`Name: ${managerName}  |  Phone: ${managerPhone}`, 196, 16, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}`, 196, 21, { align: 'right' });

  // --- 2. REPORT METADATA SECTION ---
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59); // #1E293B (Dark Slate)
  doc.text('REPORT METADATA', 14, 35);

  // Center current income month (like July-2026) below orange line
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
  doc.text(currentMonthStr, 105, 35, { align: 'center' });

  // Metadata grid values
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // #64748B (Slate Gray)
  
  // Left Column
  const formatDateToSlash = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr.replace(/-/g, '/');
  };

  let dateRange = '';
  if (entries.length > 0) {
    const dates = entries.map(e => e.entry_date).sort();
    dateRange = `${formatDateToSlash(dates[0])} to ${formatDateToSlash(dates[dates.length - 1])}`;
  } else {
    dateRange = `${formatDateToSlash(new Date().toISOString().split('T')[0])}`;
  }
  doc.text(dateRange, 14, 41);
  
  const uniqueRates = Array.from(new Set(entries.map(e => getActiveRateForDate(e.entry_date))));
  const rateText = uniqueRates.length === 1 
    ? `Rs. ${uniqueRates[0].toFixed(2)} per Dozen` 
    : `Rs. ${Math.min(...uniqueRates).toFixed(2)} - Rs. ${Math.max(...uniqueRates).toFixed(2)} per Dozen`;
  doc.text(`Rate Card: ${rateText}`, 14, 46);

  // Right Column
  doc.text(`Total Log Records: ${entries.length}`, 196, 41, { align: 'right' });
  doc.text(`Export Source: Web Dashboard`, 196, 46, { align: 'right' });

  // Divider line below metadata
  doc.setDrawColor(226, 232, 240); // #E2E8F0 (Light Gray)
  doc.setLineWidth(0.4);
  doc.line(14, 51, 196, 51);

  // --- 3. TABULAR DATA LOGS ---
  let y = 58;
  doc.setFillColor(15, 23, 42); // Dark Navy Table Header
  doc.rect(14, y, 182, 8, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255); // White header text
  doc.text('Date', 20, y + 5.5);
  doc.text('Color', 75, y + 5.5);
  doc.text('Falls Count', 140, y + 5.5);
  
  // Reset typography for rows
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85); // #334155 (Dark Slate)
  
  let totalFalls = 0;
  let totalIncome = 0;
  let lastPrintedDate = '';
  
  y += 8;
  
  entries.forEach((e, index) => {
    // Page break handling
    if (y > 270) {
      addFooter(pageNumber); // Add footer to the completed page before creating a new one
      doc.addPage();
      pageNumber++;
      y = 20;
      
      // Reprint header on new page
      doc.setFillColor(15, 23, 42); // Dark Navy Table Header
      doc.rect(14, y, 182, 8, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text('Date', 20, y + 5.5);
      doc.text('Color', 75, y + 5.5);
      doc.text('Falls Count', 140, y + 5.5);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      y += 8;
      
      lastPrintedDate = '';
    }
    
    // Zebra striping with a soft slate-blue background
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252); // #F8FAFC
      doc.rect(14, y, 182, 7, 'F');
    }
    
    // Row separator line
    doc.setDrawColor(241, 245, 249); // #F1F5F9 (Very Light Gray)
    doc.setLineWidth(0.3);
    doc.line(14, y + 7, 196, y + 7);
    
    const rate = getActiveRateForDate(e.entry_date);
    const income = (e.quantity / 12) * rate;
    
    totalFalls += e.quantity;
    totalIncome += income;
    
    // Format date - print only if it changes, keeping it blank for repeated consecutive dates
    const dateToPrint = e.entry_date === lastPrintedDate ? '' : formatDateToDDMMYYYY(e.entry_date);
    if (dateToPrint) {
      doc.text(dateToPrint, 20, y + 5);
      lastPrintedDate = e.entry_date;
    }
    
    // Draw Marathi color name as image to support Devanagari font rendering
    const colorName = e.color?.name || 'Unspecified';
    if (colorName !== 'Unspecified') {
      const colorImgData = renderMarathiTextToImage(colorName);
      doc.addImage(colorImgData, 'PNG', 75, y + 0.8, 36, 5);
    } else {
      doc.text('Unspecified', 75, y + 5);
    }
    
    doc.text(e.quantity.toLocaleString(), 140, y + 5);
    
    y += 7;
  });

  // Draw line before totals
  doc.setDrawColor(226, 232, 240); // #E2E8F0
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);
  y += 2;

  // Print Totals Row
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42); // Dark Navy
  doc.text('Total Summary:', 20, y + 5);
  doc.text(totalFalls.toLocaleString(), 140, y + 5);
  doc.text(`Total Income: Rs. ${totalIncome.toFixed(2)}`, 196, y + 5, { align: 'right' });
  
  // Add footer to the final page
  addFooter(pageNumber);

  doc.save(`FallTrack_${titleText.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};
