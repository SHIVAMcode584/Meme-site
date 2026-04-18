const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "but",
  "by",
  "can",
  "did",
  "do",
  "does",
  "doing",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "hers",
  "him",
  "his",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "out",
  "she",
  "so",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "too",
  "up",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "who",
  "will",
  "with",
  "you",
  "your",
  "dont",
  "doesnt",
  "cant",
  "im",
  "ive",
  "id",
  "ill",
  "youre",
  "were",
  "theyre",
  "thats",
  "whats",
  "okay",
  "ok",
  "eh",
  "oh",
  "uh",
  "um",
]);

const TOPIC_RULES = [
  {
    terms: ["teacher", "school", "class", "exam", "question", "answer", "student", "study"],
    keywords: ["teacher", "student life", "exam", "funny", "relatable"],
  },
  {
    terms: ["friend", "friends", "bro", "dost", "bestie", "gang"],
    keywords: ["friends", "friendship", "funny", "relatable"],
  },
  {
    terms: ["crush", "love", "gf", "bf", "relationship", "dating"],
    keywords: ["crush", "relationship", "love", "funny"],
  },
  {
    terms: ["office", "work", "boss", "salary", "job", "meeting"],
    keywords: ["office life", "work", "boss", "relatable"],
  },
  {
    terms: ["family", "mom", "mum", "dad", "parents", "home"],
    keywords: ["family", "parents", "home", "relatable"],
  },
  {
    terms: ["sleep", "tired", "late", "deadline", "assignment", "project"],
    keywords: ["sleep", "deadline", "student life", "relatable"],
  },
  {
    terms: ["reaction", "laugh", "funny", "meme", "shock", "surprise"],
    keywords: ["reaction", "funny", "meme", "viral"],
  },
];

const EMOJI_REGEX = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier_Base}/gu;

function normalizeKeywordKey(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function stripEmoji(value) {
  return String(value || "").replace(EMOJI_REGEX, " ");
}

function cleanText(value) {
  return stripEmoji(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/['-]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseKeywords(value) {
  if (Array.isArray(value)) {
    return dedupeKeywords(value);
  }

  if (typeof value !== "string") {
    return [];
  }

  return dedupeKeywords(
    value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

export function formatKeywords(value) {
  return parseKeywords(value).join(", ");
}

export function dedupeKeywords(values) {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return;

    const key = normalizeKeywordKey(trimmed);
    if (!key || seen.has(key)) return;

    seen.add(key);
    result.push(trimmed);
  });

  return result;
}

export function toggleKeyword(value, keyword) {
  const current = parseKeywords(value);
  const key = normalizeKeywordKey(keyword);

  if (!key) return formatKeywords(current);

  const index = current.findIndex((item) => normalizeKeywordKey(item) === key);

  if (index >= 0) {
    current.splice(index, 1);
    return current.join(", ");
  }

  current.push(keyword.trim());
  return current.join(", ");
}

export function appendKeyword(value, keyword) {
  const current = parseKeywords(value);
  const next = String(keyword || "").trim();

  if (!next) return formatKeywords(current);

  current.push(next);
  return formatKeywords(current);
}

export function getNextKeywordVariant(currentVariant = "balanced") {
  const sequence = ["balanced", "phrase", "expanded"];
  const index = sequence.indexOf(currentVariant);

  if (index === -1) return sequence[0];

  return sequence[(index + 1) % sequence.length];
}

export function buildKeywordSuggestions(rawText, { maxKeywords = 8, variant = "balanced" } = {}) {
  const cleaned = cleanText(rawText);
  if (!cleaned) return [];

  const words = cleaned
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word && word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));

  const phraseCandidates = [];
  for (let index = 0; index < words.length - 1; index += 1) {
    const first = words[index];
    const second = words[index + 1];
    if (STOP_WORDS.has(first) || STOP_WORDS.has(second)) continue;
    phraseCandidates.push(`${first} ${second}`);
  }

  const frequency = new Map();
  words.forEach((word) => {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  });

  phraseCandidates.forEach((phrase) => {
    frequency.set(phrase, (frequency.get(phrase) || 0) + 0.85);
  });

  const lowerText = cleaned;
  const themedKeywords = [];

  TOPIC_RULES.forEach((rule) => {
    if (rule.terms.some((term) => lowerText.includes(term))) {
      themedKeywords.push(...rule.keywords);
    }
  });

  if (variant === "expanded") {
    if (lowerText.includes("question") || lowerText.includes("answer")) {
      themedKeywords.push("student life", "exam stress");
    }
    if (lowerText.includes("school") || lowerText.includes("class")) {
      themedKeywords.push("school life", "classroom");
    }
    if (lowerText.includes("teacher")) {
      themedKeywords.push("teacher joke", "classroom humor");
    }
    if (lowerText.includes("sleep") || lowerText.includes("tired")) {
      themedKeywords.push("sleepy", "late night");
    }
  }

  const rankedWords = [...frequency.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].length - right[0].length;
    })
    .map(([word]) => word);

  const variantSuggestions =
    variant === "phrase"
      ? dedupeKeywords([...themedKeywords, ...phraseCandidates, ...rankedWords])
      : variant === "expanded"
      ? dedupeKeywords([
          ...themedKeywords,
          ...rankedWords,
          ...phraseCandidates,
          "funny",
          "relatable",
          "meme",
        ])
      : dedupeKeywords([...themedKeywords, ...rankedWords, ...phraseCandidates]);

  return variantSuggestions.slice(0, Math.max(1, maxKeywords));
}

export function highlightTerms(text, keywords) {
  const source = String(text || "");
  const terms = parseKeywords(keywords)
    .flatMap((keyword) => keyword.toLowerCase().split(/\s+/))
    .map((term) => term.trim())
    .filter((term) => term.length > 2);

  const uniqueTerms = [...new Set(terms)].filter((term) => !STOP_WORDS.has(term));
  if (!source || uniqueTerms.length === 0) {
    return [{ text: source, matched: false }];
  }

  const pattern = new RegExp(`(${uniqueTerms.map(escapeForRegExp).join("|")})`, "gi");
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: source.slice(lastIndex, match.index), matched: false });
    }

    segments.push({ text: match[0], matched: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < source.length) {
    segments.push({ text: source.slice(lastIndex), matched: false });
  }

  return segments;
}

function escapeForRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
