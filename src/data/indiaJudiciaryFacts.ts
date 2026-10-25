/**
 * Short, factual trivia about the Indian judiciary — shown during long
 * processing waits (the free-tier server can take up to a minute to wake
 * from sleep) so the user has something worth reading instead of a bare
 * spinner.
 */
export const INDIA_JUDICIARY_FACTS: string[] = [
  'The Supreme Court of India was established on 28 January 1950, two days after the Constitution came into force.',
  'The Constitution of India is the longest written constitution of any sovereign country in the world.',
  'India has a single integrated judicial system: the Supreme Court, High Courts, and subordinate courts below them.',
  'The Allahabad High Court, established in 1866, is one of the oldest High Courts in India.',
  'Article 32 of the Constitution lets citizens approach the Supreme Court directly to enforce their fundamental rights.',
  'The Chief Justice of India is appointed by the President of India.',
  'Lok Adalats resolve disputes through conciliation and compromise, outside the formal court process.',
  'The National Company Law Tribunal (NCLT) was set up in 2016 to hear corporate and insolvency matters.',
  'India\'s courts are increasingly moving to e-filing under the e-Courts Mission Mode Project.',
  'The Supreme Court can strike down any law that violates the Constitution — this is called judicial review.',
  'India has 25 High Courts, each with jurisdiction over one or more states and union territories.',
  'The Indian judiciary follows a common law system, a legacy of British colonial administration.',
];

/** Returns a shuffled copy so repeat sessions don't always start on the
 * same fact. */
export function shuffledFacts(): string[] {
  const arr = [...INDIA_JUDICIARY_FACTS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
