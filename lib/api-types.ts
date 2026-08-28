/**
 * Hand-written types for the API surface this app actually uses.
 *
 * Not generated from the OpenAPI document, for three reasons found by reading
 * the backend: the login response is a TypeScript union that OpenAPI cannot
 * express (the controller declares only one branch), the list endpoints build
 * their `{data, pagination}` shape inline in the service so it never reaches the
 * schema, and the envelope is applied by an interceptor and is likewise
 * invisible to it. A generator would encode the schema while missing the
 * contract, and the contract is where the surprises are.
 *
 * Every payload arrives wrapped. See `unwrap` in lib/server/api.ts.
 */

/* -------------------------------------------------------------------------- */
/* Envelopes                                                                   */
/* -------------------------------------------------------------------------- */

export interface SuccessEnvelope<T> {
  success: true;
  statusCode: number;
  /** Always "Request successful" — the interceptor overwrites the controller's
   *  own message, so never read this for user-facing copy. */
  message: string;
  data: T;
  requestId: string;
  timestamp: string;
}

/**
 * Note `status`, not `success` — the error filter does not share the
 * interceptor's shape. `message` is a string for thrown exceptions and a
 * `string[]` for class-validator failures.
 *
 * Extra keys are forwarded, which is how `code` and `recoverableUntil` reach the
 * client on a recoverable-account conflict.
 */
export interface ErrorEnvelope {
  status: false;
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
  requestId: string;
  code?: string;
}

export interface CursorPagination {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

export interface CursorPage<T> {
  data: T[];
  pagination: CursorPagination;
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

export type UserRole =
  | "USER"
  | "RESEARCHER"
  | "ADMIN"
  | "MODERATOR"
  | "SUPER_ADMIN";

export type UserStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "PENDING_VERIFICATION";

/**
 * How a login attempt ended when it did not simply succeed. The response is a
 * union: read `step` first and only then look for `accessToken`.
 */
export type LoginStep =
  | "UPDATE_PASSWORD"
  | "MFA_SETUP_REQUIRED"
  | "MFA_REQUIRED";

export interface AuthenticatedUser {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: UserRole;
  accessToken: string;
  refreshToken: string;
}

export interface StepUpChallenge {
  step: LoginStep;
  temporaryToken: string;
}

export type LoginResult = AuthenticatedUser | StepUpChallenge;

export function isStepUp(result: LoginResult): result is StepUpChallenge {
  return "step" in result && !("accessToken" in result);
}

export interface RegisteredUser {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  isActive: boolean;
}

export interface AuthMe {
  id: string;
  email: string;
  role: UserRole;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  forcePasswordChange: boolean;
  isActive: boolean;
}

export interface UserMetadata {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  lastLoginAt: string | null;
  profileCompleteStatus: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface MfaSetup {
  /** A data URL, rendered as an <img>. */
  qrCodeDataUrl: string;
  manualEntryCode: string;
}

export interface MessageResponse {
  message: string;
}

/* -------------------------------------------------------------------------- */
/* Decks and cards                                                             */
/* -------------------------------------------------------------------------- */

export type CardStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface Deck {
  id: string;
  title: string;
  description: string | null;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FlashCard {
  id: string;
  deckId: string;
  front: string;
  back: string;
  hint: string | null;
  status: CardStatus;
  /** Null for hand-written cards; set once a generation job produced it. */
  generationJobId: string | null;

  // Scheduling. `dueAt` null means never reviewed, so due now.
  dueAt: string | null;
  /** The gap between reviews this card has earned, in days. 0 until first
   *  success, and 0 again while a forgotten card is in a relearn step. */
  intervalDays: number;
  /** Consecutive successful reviews. */
  repetitions: number;
  /** How often this card has been forgotten — a hint that the card itself needs
   *  rewriting, not more reviewing. */
  lapses: number;
  lastReviewedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Study                                                                       */
/* -------------------------------------------------------------------------- */

export type ReviewRating = "AGAIN" | "HARD" | "GOOD" | "EASY";

export interface DeckStats {
  total: number;
  active: number;
  draft: number;
  archived: number;
  /** Active cards in play, including ones never reviewed and ones being
   *  relearned. This is the number the study screen offers. */
  due: number;
  newCards: number;
  learned: number;
  learning: number;
  reviewedInLastDay: number;
}

export interface StudyPool {
  data: FlashCard[];
  pagination: CursorPagination;
  stats: DeckStats;
}

export interface ReviewResult {
  cardId: string;
  rating: ReviewRating;
  scheduling: {
    intervalDays: number;
    dueAt: string;
    repetitions: number;
    lapses: number;
  };
}

/** A proposed rewrite of a card that keeps being forgotten. Never applied on
 *  its own — the reader accepts it or discards it. */
export interface CardImprovement {
  front: string;
  back: string;
  hint: string | null;
  /** One sentence on what was wrong with the original. */
  reason: string;
  model: string;
}

export interface ReviewDay {
  /** `YYYY-MM-DD` in the reader's timezone. */
  day: string;
  reviews: number;
  /** Reviews that were not AGAIN. */
  correct: number;
}

export interface ForecastDay {
  day: string;
  due: number;
}

export interface StudyOverview {
  totals: {
    reviews: number;
    activeCards: number;
    learnedCards: number;
    /** Null until there is something to divide by. */
    retention: number | null;
    dueNow: number;
  };
  streak: { current: number; longest: number };
  daily: ReviewDay[];
  forecast: ForecastDay[];
  /** The zone every day boundary above was computed in. */
  timezone: string;
}

/* -------------------------------------------------------------------------- */
/* Knowledge graph                                                             */
/* -------------------------------------------------------------------------- */

export type GraphNodeType = "SOURCE" | "DECK" | "TERM";
export type GraphEdgeType = "GENERATED_FROM" | "COVERS";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  /** Relative importance, 0–1. Drives node size. */
  weight: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: GraphEdgeType;
  weight: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /**
   * True while the term layer is synthetic. Source and deck nodes and the
   * edges between them are real generation provenance; the terms are not.
   */
  placeholder: boolean;
}

/* -------------------------------------------------------------------------- */
/* Quizzes                                                                     */
/* -------------------------------------------------------------------------- */

export type QuizFormat = "MULTIPLE_CHOICE" | "CLOZE" | "MATCHING";
export type QuizAttemptStatus = "IN_PROGRESS" | "COMPLETED";

export const QUIZ_FORMATS: readonly QuizFormat[] = [
  "MULTIPLE_CHOICE",
  "CLOZE",
  "MATCHING",
] as const;

export interface QuizQuestion {
  position: number;
  cardId: string;
  prompt: string;
  options: string[];
  /**
   * Present only once this question has been answered. The API withholds the
   * answer until then, so an in-flight quiz cannot be read as an answer key —
   * and a finished one can be reviewed.
   */
  correct?: string;
  chosen?: string | null;
  wasCorrect?: boolean;
}

export interface QuizAttempt {
  id: string;
  deckId: string;
  format: QuizFormat;
  status: QuizAttemptStatus;
  questionCount: number;
  correctCount: number;
  questions: QuizQuestion[];
  startedAt: string;
  finishedAt: string | null;
}

export interface QuizAnswerResult {
  position: number;
  chosen: string | null;
  correct: string;
  wasCorrect: boolean;
}

export interface QuizProgress {
  attemptId: string;
  status: QuizAttemptStatus;
  answered: number;
  questionCount: number;
  correctCount: number;
  results: QuizAnswerResult[];
  completed: boolean;
}

export interface QuizHistoryItem {
  id: string;
  deckId: string;
  deckTitle: string;
  format: QuizFormat;
  status: QuizAttemptStatus;
  questionCount: number;
  correctCount: number;
  startedAt: string;
  finishedAt: string | null;
}

/* -------------------------------------------------------------------------- */
/* Sources                                                                     */
/* -------------------------------------------------------------------------- */

export type SourceType = "TEXT" | "MARKDOWN" | "TXT" | "PDF" | "DOCX";
export type SourceStatus = "PENDING" | "EXTRACTING" | "READY" | "FAILED";

export interface Source {
  id: string;
  title: string;
  type: SourceType;
  status: SourceStatus;
  fileName: string | null;
  sizeBytes: number | null;
  characterCount: number | null;
  /** Populated only when `status` is FAILED. An unparseable upload still
   *  answers 201, so this is the field to read, not the HTTP code. */
  error: string | null;
  excerpt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourceDetail extends Source {
  text: string | null;
}

export interface TextChunk {
  index: number;
  text: string;
}

/* -------------------------------------------------------------------------- */
/* Generation                                                                  */
/* -------------------------------------------------------------------------- */

export type GenerationJobStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

/** A job is finished once its status is one of these; polling stops. */
export const TERMINAL_JOB_STATUSES: readonly GenerationJobStatus[] = [
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
];

export interface GenerationJob {
  id: string;
  deckId: string;
  sourceId: string;
  status: GenerationJobStatus;
  /** Which generator ran — `heuristic` or `gemini`. */
  provider: string;
  model: string | null;
  /** The requested cap, or null when the default applied. */
  cardsRequested: number | null;
  /** Only meaningful once SUCCEEDED. Zero is a valid result, not a failure. */
  cardsCreated: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                   */
/* -------------------------------------------------------------------------- */

/** One bucket of a series: how many reviews, and how many were recalled. */
export interface ReviewSlot {
  reviews: number;
  /** Reviews that were not AGAIN. */
  correct: number;
}

export interface WeekdayBucket extends ReviewSlot {
  /** 0 is Sunday, matching the API's `dow`. */
  weekday: number;
}

export interface HourBucket extends ReviewSlot {
  /** 0 is midnight, in the reader's own timezone. */
  hour: number;
}

export interface ReviewAnalytics {
  totals: { reviews: number; days: number; cards: number };
  /** Always seven entries, Sunday first — the API fills the quiet days. */
  weekdays: WeekdayBucket[];
  /** Always twenty-four entries, midnight first. */
  hours: HourBucket[];
  ratings: Array<{ rating: ReviewRating; count: number }>;
  leeches: Array<{
    cardId: string;
    deckId: string;
    deckTitle: string;
    front: string;
    count: number;
    lapses: number;
  }>;
  windowDays: number;
  timezone: string;
}

/**
 * Nothing here divides by zero for you: an accuracy is `null` when no question
 * has been asked, which is a different thing from answering none correctly.
 */
export interface QuizAnalytics {
  totals: {
    attempts: number;
    questions: number;
    correct: number;
    accuracy: number | null;
  };
  /** One entry per format, including any never tried. */
  byFormat: Array<{
    format: QuizFormat;
    attempts: number;
    questions: number;
    correct: number;
    accuracy: number | null;
  }>;
  recent: Array<{
    id: string;
    deckId: string;
    deckTitle: string;
    format: QuizFormat;
    questionCount: number;
    correctCount: number;
    accuracy: number | null;
    finishedAt: string | null;
  }>;
  missed: Array<{
    cardId: string;
    deckId: string;
    deckTitle: string;
    front: string;
    count: number;
    asked: number;
  }>;
}

export interface GenerationAnalytics {
  totals: {
    jobs: number;
    succeeded: number;
    failed: number;
    /** Queued or running — asked for, not yet finished. */
    inFlight: number;
    cardsCreated: number;
    averageSeconds: number | null;
  };
  byProvider: Array<{ provider: string; jobs: number; cardsCreated: number }>;
  bySource: Array<{
    sourceId: string;
    title: string;
    jobs: number;
    cardsCreated: number;
    failed: number;
  }>;
  recent: Array<{
    id: string;
    sourceTitle: string | null;
    deckTitle: string | null;
    status: GenerationJobStatus;
    cardsCreated: number;
    seconds: number | null;
    error: string | null;
    finishedAt: string | null;
  }>;
}

/* -------------------------------------------------------------------------- */
/* Activity                                                                    */
/* -------------------------------------------------------------------------- */

export interface Activity {
  id: string;
  type: string;
  actor: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  entityType: string;
  entityId: string;
  contextType: string | null;
  contextId: string | null;
  data: Record<string, unknown>;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                     */
/* -------------------------------------------------------------------------- */

export interface UserProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  phoneNumber: string | null;
  country: string | null;
  timezone: string | null;
  language: string | null;
  /** An object on read, but a JSON *string* on write — see UpdateProfileRequest. */
  socialLinks: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
}

/* -------------------------------------------------------------------------- */
/* Requests — mirror the DTOs exactly                                          */
/* -------------------------------------------------------------------------- */

/**
 * `ValidationPipe` runs with `forbidNonWhitelisted`, so a body carrying one
 * field the DTO does not declare is a 400 rather than a silently ignored key.
 * These types are the contract; build bodies explicitly rather than spreading
 * form state, and let the compiler catch the difference.
 */
export interface RegisterRequest {
  firstName: string;
  lastName?: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  phoneNumber?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateDeckRequest {
  title: string;
  description?: string;
}

export interface UpdateDeckRequest {
  title?: string;
  description?: string;
}

export interface CreateCardRequest {
  front: string;
  back: string;
  hint?: string;
  status?: CardStatus;
}

export type ImportFormat = "csv" | "tsv";

export interface ImportCardsRequest {
  content: string;
  /** Omitted, the delimiter is sniffed from the header line. */
  format?: ImportFormat;
}

export interface ImportCardsResult {
  created: number;
  /**
   * One entry per unusable row, naming its line, and so also the count of them
   * — the API does not send a separate total, because two numbers that must
   * agree are two numbers that can disagree.
   *
   * They are not a failure: a spreadsheet with a blank line at the end is
   * normal. They are reported rather than dropped in silence, so a row that did
   * not make it can be fixed and imported again.
   */
  errors: string[];
  /** The cards as created, so the list can show them without a refetch. */
  cards: FlashCard[];
}

export interface CreateTextSourceRequest {
  title: string;
  text: string;
  type?: SourceType;
}

export interface CreateGenerationJobRequest {
  sourceId: string;
  maxCards?: number;
}

export interface UpdateCardRequest {
  front?: string;
  back?: string;
  hint?: string;
  status?: CardStatus;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
  newConfirmationPassword: string;
}

/**
 * `firstName` is required even on update — the DTO has no `@IsOptional` on it —
 * and `socialLinks` / `preferences` are validated with `@IsJSON`, so they must
 * be sent as **JSON strings**, not objects, even though `GET /user/me/profile`
 * returns them as objects. The mismatch is the backend's, not a mistake here.
 */
export interface UpdateProfileRequest {
  firstName: string;
  lastName?: string;
  displayName?: string;
  bio?: string;
  phoneNumber?: string;
  country?: string;
  timezone?: string;
  language?: string;
  socialLinks?: string;
  preferences?: string;
}

/* -------------------------------------------------------------------------- */
/* Notifications and the realtime socket                                       */
/* -------------------------------------------------------------------------- */

/** The tones the product already uses, so a notification is legible in all
 *  three schemes without a palette of its own. */
export type NotificationTone =
  | "neutral"
  | "accent"
  | "due"
  | "success"
  | "danger";

/**
 * A notification as the server renders it.
 *
 * `title`, `body` and `href` are produced from a template the server owns; the
 * database holds only `type` and its parameters. So this is a *rendered* thing —
 * there is no client-side template to keep in step, and rewording a message
 * rewrites what every past notification says.
 */
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  tone: NotificationTone;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  data: AppNotification[];
  unreadCount: number;
  hasMore: boolean;
}

/** What arrives on the socket when a notification is created. */
export interface NotificationMessage {
  notification: AppNotification;
  unreadCount: number;
}

/**
 * Progress on a generation run, pushed rather than polled.
 *
 * `status` is the queue's view of the job, which is authoritative: a worker that
 * died mid-run leaves the database row saying RUNNING, and only the queue knows
 * it failed.
 */
export interface JobUpdatedMessage {
  jobId: string;
  deckId: string;
  status: GenerationJobStatus;
  cardsCreated: number | null;
}

/**
 * A message the socket would not carry out.
 *
 * `topic` is present when a **subscription was refused**, and carries the name
 * the client asked for. It is absent when a handler failed, which is not about
 * any one subscription. The server decides which; see its `realtime.types.ts`.
 */
export interface RealtimeErrorMessage {
  topic?: string;
  message: string;
}

/** Connection state, for the one place that shows it. */
export type RealtimeStatus = "connecting" | "live" | "offline";
