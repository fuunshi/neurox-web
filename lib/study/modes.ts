/**
 * The study modes, as data.
 *
 * `id` lands in a cookie, so it is a contract — keep it stable. This module is
 * deliberately free of components so it can be imported on the server, where the
 * saved choice is read.
 *
 * The set is expected to grow (the intent was always "and so on": a list view, a
 * quiz, audio). Adding one should mean adding an entry here and a component that
 * renders `CardSurface` — nothing else.
 */

export const STUDY_MODES = [
  {
    id: "swipe",
    label: "Swipe",
    hint: "One card at a time, dragged or arrow-keyed",
    /** Presents a single card, so the session tracks position. */
    sequential: true,
  },
  {
    id: "grid",
    label: "Grid",
    hint: "Everything at once, for scanning",
    sequential: false,
  },
] as const;

export type StudyModeId = (typeof STUDY_MODES)[number]["id"];

export const DEFAULT_STUDY_MODE: StudyModeId = "swipe";

export const STUDY_MODE_COOKIE = "nx_study_mode";

const MODE_IDS = STUDY_MODES.map((mode) => mode.id) as readonly string[];

export function isStudyModeId(value: unknown): value is StudyModeId {
  return typeof value === "string" && MODE_IDS.includes(value);
}

export function studyMode(id: StudyModeId) {
  return STUDY_MODES.find((mode) => mode.id === id) ?? STUDY_MODES[0];
}
