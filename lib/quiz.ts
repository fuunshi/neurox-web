import type { QuizFormat } from "@/lib/api-types";

/**
 * How each quiz format is described to a reader.
 *
 * The descriptions are the point of this module. "Cloze" means nothing to
 * anyone who has not met the word, and a reader choosing between three
 * unlabelled options is choosing at random — so each one says what it will
 * actually ask them to do, in the same voice the container cards use.
 */
export interface QuizFormatInfo {
  id: QuizFormat;
  label: string;
  description: string;
}

export const QUIZ_FORMAT_INFO: readonly QuizFormatInfo[] = [
  {
    id: "MULTIPLE_CHOICE",
    label: "Multiple choice",
    description:
      "One question, four answers, one of them right. The wrong ones are answers to other cards in the same deck, so none is obviously out of place.",
  },
  {
    id: "CLOZE",
    label: "Fill in the blank",
    description:
      "A sentence from a card with its key term removed. Tests the detail rather than the gist.",
  },
  {
    id: "MATCHING",
    label: "Matching",
    description:
      "Every question on one board, with one shared pile of answers to pair them up with.",
  },
] as const;

export function quizFormatLabel(format: QuizFormat): string {
  return (
    QUIZ_FORMAT_INFO.find((info) => info.id === format)?.label ?? format
  );
}
