// Translation Service for AY-AD Admin Panel
// Uses Google Translate API (free tier)

async function translateText(text, targetLang) {
  if (!text || text.trim() === '') return '';
  
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();
    
    // Extract translated text from response
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      return data[0].map(item => item[0]).join('');
    }
    
    return text; // Return original if translation fails
  } catch (error) {
    console.error(`Translation error for ${targetLang}:`, error);
    return text; // Return original on error
  }
}

async function translateToAllLanguages(text) {
  if (!text || text.trim() === '') {
    return {
      ar: '',
      ru: '',
      zh: ''
    };
  }
  
  try {
    // Translate to all languages in parallel
    const [ar, ru, zh] = await Promise.all([
      translateText(text, 'ar'), // Arabic
      translateText(text, 'ru'), // Russian
      translateText(text, 'zh-CN') // Chinese Simplified
    ]);
    
    return { ar, ru, zh };
  } catch (error) {
    console.error('Translation error:', error);
    return { ar: text, ru: text, zh: text };
  }
}

// Export functions
window.translateService = {
  translateText,
  translateToAllLanguages
};
