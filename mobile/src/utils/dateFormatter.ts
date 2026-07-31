/**
 * Formats a date string from YYYY-MM-DD to DD-MM-YYYY for user display.
 * Keeps fallback value if format is not matching.
 */
export const formatDateToDDMMYYYY = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};
