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
  createdAt: string;
  updatedAt: string;
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

export interface CreateTextSourceRequest {
  title: string;
  text: string;
  type?: SourceType;
}
