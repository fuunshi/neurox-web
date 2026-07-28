/**
 * Where the verification and reset emails actually go locally.
 *
 * The API sends over SMTP and nothing is running in front of a real inbox in
 * development — Mailpit captures it at `localhost:8025`. Without this note the
 * flow looks broken at exactly the point it is working correctly, and there is
 * no way to guess the port from the page.
 *
 * Development-only information, so it is one component reused by the screens
 * that end in an email rather than a paragraph repeated in each.
 */
export function LocalMailHint() {
  return (
    <p className="mt-4 rounded-md border border-line bg-surface-2 px-3.5 py-3 text-sm text-ink-muted">
      Running this locally? Nothing is delivered anywhere — read the message in
      Mailpit at{" "}
      <a
        href="http://localhost:8025"
        className="text-accent hover:underline"
        target="_blank"
        rel="noreferrer"
      >
        localhost:8025
      </a>
      .
    </p>
  );
}
