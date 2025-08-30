// Advanced Multilingual Conversational Tone Patterns
// This demonstrates how you could expand your current English-only analysis

const CONVERSATIONAL_PATTERNS = {
  'en': {
    pronouns: /\b(you|your|we|our|us|I|my|me)\b/gi,
    contractions: /\b(don't|won't|can't|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|doesn't|didn't|couldn't|shouldn't|wouldn't|mustn't|needn't|daren't|mayn't|oughtn't|mightn't|'ll|'re|'ve|'d|'m)\b/gi,
    questions: /\?/g,
    sentenceSeparators: /[.!?]+/
  },

  'es': {
    pronouns: /\b(tú|tu|nosotros|nuestro|nuestra|yo|mi|me|usted|ustedes)\b/gi,
    contractions: /\b(del|al|pa'|pa|'l|'s|'m|'n)\b/gi, // Spanish has fewer contractions
    questions: /[\?¿]/g, // Include inverted question mark
    sentenceSeparators: /[.!?¿¡]+/,
    informalMarkers: /\b(che|pues|oye|mira|bueno|vale)\b/gi // Informal discourse markers
  },

  'fr': {
    pronouns: /\b(tu|ton|ta|tes|nous|notre|nos|je|mon|ma|mes|vous|votre|vos)\b/gi,
    contractions: /\b(j'|n'|d'|l'|m'|t'|s'|c'|qu')\b/gi,
    questions: /\?/g,
    sentenceSeparators: /[.!?]+/,
    informalMarkers: /\b(bon|ben|allez|tiens|dis|écoute)\b/gi
  },

  'de': {
    pronouns: /\b(du|dein|deine|wir|unser|unsere|ich|mein|meine|ihr|euer|eure)\b/gi,
    contractions: /\b(ins|ans|aufs|fürs|durchs|ums|übers|unters|vors|hinters|neben|beim)\b/gi,
    questions: /\?/g,
    sentenceSeparators: /[.!?]+/,
    informalMarkers: /\b(na|ja|ach|mal|halt|eben|also)\b/gi
  },

  'pt': {
    pronouns: /\b(você|tu|teu|tua|nós|nosso|nossa|eu|meu|minha|vocês)\b/gi,
    contractions: /\b(do|da|dos|das|no|na|nos|nas|pelo|pela|pelos|pelas|dum|duma|duns|dumas|num|numa|nuns|numas)\b/gi,
    questions: /\?/g,
    sentenceSeparators: /[.!?]+/,
    informalMarkers: /\b(né|então|tipo|cara|mano|pô|nossa)\b/gi
  },

  'it': {
    pronouns: /\b(tu|tuo|tua|noi|nostro|nostra|io|mio|mia|voi|vostro|vostra)\b/gi,
    contractions: /\b(del|della|dello|dei|delle|degli|nel|nella|nello|nei|nelle|negli|sul|sulla|sullo|sui|sulle|sugli|dal|dalla|dallo|dai|dalle|dagli)\b/gi,
    questions: /\?/g,
    sentenceSeparators: /[.!?]+/,
    informalMarkers: /\b(beh|mah|boh|dai|guarda|senti|dimmi)\b/gi
  },

  'ja': {
    pronouns: /\b(あなた|君|僕|私|俺|我々|われわれ)\b/g,
    contractions: null, // Japanese doesn't use contractions like Western languages
    questions: /[？?]/g,
    sentenceSeparators: /[。！？!?]/,
    informalMarkers: /\b(だよ|だね|でしょ|じゃん|っす|ちゃう|てる|ってる)\b/g,
    politenessMarkers: /\b(です|ます|ございます|いらっしゃい|させていただ)\b/g // Japanese-specific: politeness levels
  },

  'zh': {
    pronouns: /\b(你|您|我们|我|咱们|大家)\b/g,
    contractions: null, // Chinese doesn't have contractions
    questions: /[？?]/g,
    sentenceSeparators: /[。！？!?]/,
    informalMarkers: /\b(哈哈|呵呵|嗯|哦|啊|呀|嘛|吧|咯)\b/g
  }
};

// Language-specific scoring logic
const SCORING_RULES = {
  'en': {
    avgSentenceLengthThresholds: [20, 30], // English baseline
    pronounDensityThresholds: [0.02, 0.01],
    questionDensityThresholds: [0.1, 0.05]
  },
  
  'es': {
    avgSentenceLengthThresholds: [25, 35], // Spanish tends to be wordier
    pronounDensityThresholds: [0.015, 0.008], // Different pronoun usage patterns
    questionDensityThresholds: [0.08, 0.04],
    informalMarkerBonus: 15 // Extra points for informal discourse markers
  },
  
  'fr': {
    avgSentenceLengthThresholds: [22, 32], // French similar to Spanish
    pronounDensityThresholds: [0.018, 0.009],
    questionDensityThresholds: [0.09, 0.045],
    informalMarkerBonus: 12
  },
  
  'ja': {
    avgSentenceLengthThresholds: [15, 25], // Japanese sentences are typically shorter
    pronounDensityThresholds: [0.005, 0.002], // Japanese often drops pronouns
    questionDensityThresholds: [0.12, 0.06],
    politenessAnalysis: true, // Unique to Japanese: analyze formal vs informal speech
    politenessWeight: 20
  }
};

// Example of how your current analyzeConversationalTone could be expanded
function analyzeMultilingualConversationalTone($, detectedLanguage = 'en') {
  const patterns = CONVERSATIONAL_PATTERNS[detectedLanguage] || CONVERSATIONAL_PATTERNS['en'];
  const rules = SCORING_RULES[detectedLanguage] || SCORING_RULES['en'];
  
  const bodyText = $('body').text();
  const sentences = bodyText.split(patterns.sentenceSeparators).filter(s => s.trim().length > 0);
  
  if (sentences.length === 0) return { score: 0, factors: {}, scope: 'no-content' };
  
  let score = 0;
  const factors = {};
  
  // 1. Average sentence length (language-specific thresholds)
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / sentences.length;
  factors.avgSentenceLength = avgSentenceLength;
  
  if (avgSentenceLength < rules.avgSentenceLengthThresholds[0]) score += 25;
  else if (avgSentenceLength < rules.avgSentenceLengthThresholds[1]) score += 15;
  
  // 2. Personal pronouns (language-specific patterns)
  const pronounMatches = bodyText.match(patterns.pronouns) || [];
  const pronounDensity = pronounMatches.length / bodyText.split(/\s+/).length;
  factors.personalPronouns = pronounMatches.length;
  factors.pronounDensity = pronounDensity;
  
  if (pronounDensity > rules.pronounDensityThresholds[0]) score += 25;
  else if (pronounDensity > rules.pronounDensityThresholds[1]) score += 15;
  
  // 3. Questions (language-specific question marks)
  const questionMarks = (bodyText.match(patterns.questions) || []).length;
  const questionDensity = questionMarks / sentences.length;
  factors.questionWords = questionMarks;
  factors.questionDensity = questionDensity;
  
  if (questionDensity > rules.questionDensityThresholds[0]) score += 25;
  else if (questionDensity > rules.questionDensityThresholds[1]) score += 15;
  
  // 4. Contractions (where applicable)
  if (patterns.contractions) {
    const contractionMatches = bodyText.match(patterns.contractions) || [];
    factors.contractionsFound = contractionMatches.length;
    
    if (contractionMatches.length > 5) score += 25;
    else if (contractionMatches.length > 2) score += 15;
  }
  
  // 5. Language-specific informal markers
  if (patterns.informalMarkers && rules.informalMarkerBonus) {
    const informalMatches = bodyText.match(patterns.informalMarkers) || [];
    factors.informalMarkers = informalMatches.length;
    
    if (informalMatches.length > 0) score += rules.informalMarkerBonus;
  }
  
  // 6. Japanese-specific politeness analysis
  if (detectedLanguage === 'ja' && rules.politenessAnalysis) {
    const politenessMatches = bodyText.match(patterns.politenessMarkers) || [];
    const formalDensity = politenessMatches.length / bodyText.split(/\s+/).length;
    
    factors.politenessLevel = formalDensity > 0.1 ? 'formal' : formalDensity > 0.05 ? 'mixed' : 'informal';
    
    // More informal = more conversational for AI
    if (factors.politenessLevel === 'informal') score += 20;
    else if (factors.politenessLevel === 'mixed') score += 10;
  }
  
  return {
    score: Math.min(score, 100),
    factors,
    scope: `${detectedLanguage}-specific`,
    confidence: patterns === CONVERSATIONAL_PATTERNS['en'] && detectedLanguage !== 'en' ? 'fallback' : 'native'
  };
}

module.exports = {
  CONVERSATIONAL_PATTERNS,
  SCORING_RULES,
  analyzeMultilingualConversationalTone
};