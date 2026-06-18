// Marathi Devanagari to Latin (English Phonetic) Transliteration Utility

const COLOR_TRANSLITERATIONS: { [key: string]: string[] } = {
  'राणी': ['rani', 'raani'],
  'लाल': ['lal'],
  'पांढरा': ['pandhara', 'pandhra', 'panchra'],
  'केशरी': ['keshari', 'kesri', 'kesari'],
  'निळा': ['nila', 'neela'],
  'हिरवा': ['hirva', 'hirwa'],
  'पिवळा': ['pivla', 'piwla', 'piwala', 'pivala'],
  'गुलाबी': ['gulabi', 'gulaabi'],
  'काळा': ['kala', 'kaala'],
  'राजवाडी': ['rajwadi', 'rajvadi'],
  'मोरपंखी': ['morpankhi', 'morpanki', 'morpankh'],
  'जांभळा': ['jambhla', 'jambla', 'jambhal'],
  'करडा': ['karda', 'karada'],
  'तपकिरी': ['tapkiri', 'tapakeeri', 'tapaki']
};

export const transliterateDevanagari = (text: string): string => {
  let result = '';
  const baseMap: { [key: string]: string } = {
    'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u', 'ऋ': 'ru', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l',
    'क्ष': 'ksh', 'ज्ञ': 'dny'
  };
  const matraMap: { [key: string]: string } = {
    'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u', 'ृ': 'ru', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
    'ं': 'n', 'ः': 'h', 'ॅ': 'a', 'ॉ': 'o'
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (baseMap[char]) {
      let latin = baseMap[char];
      // Check if this is a consonant
      const isConsonant = !['अ', 'आ', 'इ', 'ई', 'उ', 'ऊ', 'ऋ', 'ए', 'ऐ', 'ओ', 'औ'].includes(char);
      if (isConsonant) {
        // If followed by a matra
        if (nextChar && matraMap[nextChar]) {
          latin += matraMap[nextChar];
          i++; // skip matra char in next iteration
        } else if (nextChar === '्') {
          // followed by halant (half character), do not add inherent 'a'
          i++; // skip halant char
        } else {
          // No matra, no halant. Add inherent 'a' if not at the end of the word
          if (nextChar && nextChar !== ' ' && baseMap[nextChar]) {
            latin += 'a';
          }
        }
      }
      result += latin;
    } else if (matraMap[char]) {
      result += matraMap[char];
    } else {
      result += char;
    }
  }
  return result.toLowerCase();
};

/**
 * Checks if a color's name matches a search query, either directly in Marathi
 * or through custom/automatic English phonetic transliteration.
 */
export const matchColor = (colorName: string, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const nameLower = colorName.toLowerCase();
  
  // 1. Direct match (Marathi or exact)
  if (nameLower.includes(q)) return true;

  // 2. Manual transliteration dictionary match
  const manual = COLOR_TRANSLITERATIONS[colorName];
  if (manual && manual.some(t => t.toLowerCase().includes(q))) return true;

  // 3. Automated transliteration match
  const autoTrans = transliterateDevanagari(colorName);
  if (autoTrans.includes(q)) return true;

  return false;
};

/**
 * Checks if a query is an exact match for a color name (or its exact transliteration),
 * preventing creation of duplicates (e.g. typing "keshari" shouldn't suggest adding it if "केशरी" exists).
 */
export const isExactColorMatch = (colorName: string, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  const nameLower = colorName.trim().toLowerCase();
  if (nameLower === q) return true;

  const manual = COLOR_TRANSLITERATIONS[colorName];
  if (manual && manual.some(t => t.toLowerCase() === q)) return true;

  if (transliterateDevanagari(colorName) === q) return true;

  return false;
};

/**
 * Returns a capitalized English representation of a Devanagari color name.
 */
export const getEnglishColorName = (name: string): string => {
  const manual = COLOR_TRANSLITERATIONS[name];
  if (manual && manual.length > 0) {
    const spelling = manual[0];
    return spelling.charAt(0).toUpperCase() + spelling.slice(1);
  }
  const auto = transliterateDevanagari(name);
  if (!auto) return 'Unspecified';
  return auto.charAt(0).toUpperCase() + auto.slice(1);
};
