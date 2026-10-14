/**
 * Character-bigram Dice coefficient — the same algorithm the popular
 * "string-similarity" npm package uses, reimplemented here with no new
 * dependency. Used to rank SerpApi candidate names against the hotel name
 * decoded from a pasted Agoda URL's slug (see match.ts) — both strings are
 * expected to already be in the same language/script by the time this is
 * called (the slug is always romanized; match.ts queries SerpApi with
 * hl=en so candidate names are too).
 */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigramCounts(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < value.length - 1; i++) {
    const bigram = value.slice(i, i + 2);
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }
  return counts;
}

/** 0 (nothing in common) to 1 (identical after normalization). Two strings shorter than 2 chars after normalization score 0 against anything, including each other — too little signal to compare. */
export function diceCoefficient(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return na.length >= 2 ? 1 : 0;

  const bigramsA = bigramCounts(na);
  const bigramsB = bigramCounts(nb);
  let totalA = 0;
  for (const count of bigramsA.values()) totalA += count;
  let totalB = 0;
  for (const count of bigramsB.values()) totalB += count;
  if (totalA === 0 || totalB === 0) return 0;

  let intersection = 0;
  for (const [bigram, countA] of bigramsA) {
    const countB = bigramsB.get(bigram);
    if (countB) intersection += Math.min(countA, countB);
  }
  return (2 * intersection) / (totalA + totalB);
}

function tokenize(value: string): string[] {
  return normalize(value).split(" ").filter(Boolean);
}

/**
 * Token-overlap similarity weighted by how RARE each shared word is across
 * `corpus` (every other candidate name in the same SerpApi response).
 * Plain diceCoefficient treats every character equally, so two different
 * branches of the same chain ("Toyoko Inn Osaka Hankyu Juso Eki
 * Nishiguchi" vs "Toyoko Inn Osaka Sakuranomiya Eki Nishi-guchi") score
 * deceptively high just from sharing "toyoko inn osaka eki nishiguchi"
 * boilerplate, while the one word that actually distinguishes them
 * ("hankyu juso" vs "sakuranomiya") barely moves the score — confirmed
 * against a real SerpApi response (scripts/.output/coverage/debug-toyoko-
 * sakuranomiya.json) where the wrong branch scored 0.703 on bigram dice
 * alone. This downweights whatever word EVERY candidate in the pool
 * shares (the chain's own name, "hotel"/"inn", generic station words) and
 * upweights whatever word only a few share — no hardcoded stopword list,
 * so it adapts to any chain (Dormy Inn, APA, Super Hotel, ...) the same
 * way. Returns roughly 0-1: the fraction of the query's weighted token
 * mass that's also present in `candidate`.
 */
export function weightedTokenScore(query: string, candidate: string, corpus: string[]): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;
  const candidateTokens = new Set(tokenize(candidate));

  const documentFrequency = new Map<string, number>();
  for (const name of corpus) {
    for (const token of new Set(tokenize(name))) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const n = Math.max(1, corpus.length);
  // Smoothed IDF — always positive, never divides by zero, and a token
  // absent from the corpus entirely (df=0) still gets a well-defined,
  // high weight (it's maximally rare/distinguishing, by definition).
  const idf = (token: string) => Math.log((n + 1) / ((documentFrequency.get(token) ?? 0) + 1)) + 1;

  let matchedWeight = 0;
  let totalWeight = 0;
  for (const token of queryTokens) {
    const weight = idf(token);
    totalWeight += weight;
    if (candidateTokens.has(token)) matchedWeight += weight;
  }
  return totalWeight > 0 ? matchedWeight / totalWeight : 0;
}
