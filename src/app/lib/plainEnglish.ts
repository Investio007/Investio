/** Keep user-facing copy short and easy (Grade 9 beginner English). */

const MAX_PLAIN_SENTENCES = 5;

/** Split text into sentences and keep at most 5 short ones. */
export function limitPlainSentences(
  input: string | string[] | null | undefined,
  max = MAX_PLAIN_SENTENCES,
): string[] {
  const raw = Array.isArray(input) ? input.join(" ") : input ?? "";
  const parts = raw
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) return [];
  return parts.slice(0, max).map((s) => (/[.!?]$/.test(s) ? s : `${s}.`));
}

export function asPlainParagraph(
  input: string | string[] | null | undefined,
  max = MAX_PLAIN_SENTENCES,
): string {
  return limitPlainSentences(input, max).join(" ");
}
