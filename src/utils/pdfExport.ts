import { jsPDF } from 'jspdf';
import type { ProductionEntry } from '../types';
import { getActiveUserId } from '../services/dbService';

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
    ctx.fillStyle = '#3C3C46'; // Matching dark slate row text color
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

  // Set default font
  doc.setFont('Helvetica', 'normal');

  // Header Title
  doc.setFontSize(22);
  doc.setTextColor(2, 132, 199); // Brand color: Sky Blue #0284C7
  doc.text(appName, 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 120);
  doc.text(`Manager: ${managerName} • Phone: ${managerPhone}`, 14, 25);
  
  // Divider
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(0.5);
  doc.line(14, 28, 196, 28);
  
  // Report Title
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 40);
  const cleanTitle = titleText.replace(/^FallTrack\s+/i, `${appName} `);
  doc.text(cleanTitle, 14, 38);
  
  // Date Generated & Rate metadata (displayed once here)
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 150);
  doc.text(`Report Date: ${new Date().toLocaleDateString('en-IN')}`, 14, 44);
  doc.text(`Total Records: ${entries.length}`, 14, 48);

  const uniqueRates = Array.from(new Set(entries.map(e => getActiveRateForDate(e.entry_date))));
  const rateText = uniqueRates.length === 1 
    ? `Rs. ${uniqueRates[0].toFixed(2)}` 
    : `Rs. ${Math.min(...uniqueRates).toFixed(2)} - Rs. ${Math.max(...uniqueRates).toFixed(2)}`;
  doc.text(`Rate per Dozen: ${rateText}`, 14, 52);

  // Table Headers (no Income column)
  let y = 60;
  doc.setFillColor(2, 132, 199); // Brand color: Sky Blue #0284C7
  doc.rect(14, y, 182, 8, 'F');
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255); // High contrast: White
  doc.text('Date', 20, y + 5);
  doc.text('Color', 75, y + 5);
  doc.text('Falls Count', 140, y + 5);
  
  // Reset typography
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(60, 60, 70);
  
  let totalFalls = 0;
  let totalIncome = 0;
  let lastPrintedDate = '';
  
  y += 8;
  
  entries.forEach((e, index) => {
    // Page break handling
    if (y > 270) {
      doc.addPage();
      y = 20;
      
      // Reprint header on new page
      doc.setFillColor(2, 132, 199); // Brand color: Sky Blue #0284C7
      doc.rect(14, y, 182, 8, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(255, 255, 255); // High contrast: White
      doc.text('Date', 20, y + 5);
      doc.text('Color', 75, y + 5);
      doc.text('Falls Count', 140, y + 5);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(60, 60, 70);
      y += 8;
      
      // Reset last printed date on new page to ensure the first row of the page displays the date
      lastPrintedDate = '';
    }
    
    // Zebra striping
    if (index % 2 === 1) {
      doc.setFillColor(240, 249, 255); // #F0F9FF
      doc.rect(14, y, 182, 7, 'F');
    }
    
    const rate = getActiveRateForDate(e.entry_date);
    const income = (e.quantity / 12) * rate;
    
    totalFalls += e.quantity;
    totalIncome += income;
    
    // Format date - print only if it changes, keeping it blank for repeated consecutive dates
    const dateToPrint = e.entry_date === lastPrintedDate ? '' : e.entry_date;
    if (dateToPrint) {
      doc.text(dateToPrint, 20, y + 5);
      lastPrintedDate = e.entry_date;
    }
    
    // Draw Marathi color name as image to support Devanagari font rendering
    const colorName = e.color?.name || 'Unspecified';
    if (colorName !== 'Unspecified') {
      const colorImgData = renderMarathiTextToImage(colorName);
      // Position image at X=75, aligned nicely with table rows (increased size)
      doc.addImage(colorImgData, 'PNG', 75, y + 0.8, 36, 5);
    } else {
      doc.text('Unspecified', 75, y + 5);
    }
    
    doc.text(e.quantity.toLocaleString(), 140, y + 5);
    
    y += 7;
  });

  // Draw line before totals
  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.5);
  doc.line(14, y, 196, y);
  y += 2;

  // Print Totals Row (Total Falls aligned to column, Total Income right-aligned)
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(30, 30, 40);
  doc.text('Total Summary:', 20, y + 5);
  doc.text(totalFalls.toLocaleString(), 140, y + 5);
  doc.text(`Total Income: Rs. ${totalIncome.toFixed(2)}`, 196, y + 5, { align: 'right' });
  
  doc.save(`FallTrack_${titleText.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};
