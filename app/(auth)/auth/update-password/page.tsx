import { UpdatePasswordForm } from "./update-password-form";

export const metadata = { title: "Choose a new password" };

/**
 * Reached two ways, with the same fields and different framing:
 *
 *  - **Forced**, straight after signing in with `step: UPDATE_PASSWORD`. The
 *    request acts on the short-lived temporary token in an httpOnly cookie.
 *  - **Voluntary**, from account settings, acting on the normal access token.
 *
 * Which token is used is decided on the server, so this page does not need to
 * know which situation it is in.
 */
export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
