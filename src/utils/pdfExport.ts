import { jsPDF } from 'jspdf';
import type { ProductionEntry } from '../types';

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
    ctx.font = '500 42px "Noto Sans Devanagari", "Poppins", "Kohinoor Devanagari", "Segoe UI", sans-serif';
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
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Set default font
  doc.setFont('Helvetica', 'normal');

  // Header Title
  doc.setFontSize(22);
  doc.setTextColor(92, 62, 163); // Brand color: Deep Indigo #5C3EA3
  doc.text('FallTrack', 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 120);
  doc.text('Saree Fall Production & Income Management System', 14, 25);
  
  // Divider
  doc.setDrawColor(92, 62, 163);
  doc.setLineWidth(0.5);
  doc.line(14, 28, 196, 28);
  
  // Report Title
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 40);
  doc.text(titleText, 14, 38);
  
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
  doc.setFillColor(92, 62, 163); // Brand color: Deep Indigo #5C3EA3
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
      doc.setFillColor(92, 62, 163); // Brand color: Deep Indigo #5C3EA3
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
      doc.setFillColor(248, 247, 250); // #F8F7FA
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
      // Position image at X=75, aligned nicely with table rows
      doc.addImage(colorImgData, 'PNG', 75, y + 1.2, 30, 4);
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
  
  y += 15;

  // Add Font Support / Export Note at the bottom
  if (y > 275) {
    doc.addPage();
    y = 20;
  }
  doc.setDrawColor(230, 230, 240);
  doc.setLineWidth(0.2);
  doc.line(14, y, 196, y);
  y += 4;
  
  doc.setFont('Helvetica', 'oblique');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 150);
  doc.text('Note: Marathi color names are rendered using high-DPI browser canvas layouts for PDF compatibility.', 14, y);
  doc.text('For Devanagari raw text exports, please use the CSV Export option (which has full Marathi Unicode support).', 14, y + 3.5);

  doc.save(`FallTrack_${titleText.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
};
