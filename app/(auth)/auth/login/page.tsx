import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

/**
 * `searchParams` is a promise in Next 16, and reading it makes this page dynamic
 * — correct here, since the form's starting state comes from the query string
 * (where to return to, which address to prefill, what just happened).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const first = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return (
    <LoginForm
      next={first("next")}
      initialEmail={first("email")}
      justVerified={first("verified") === "1"}
      justReset={first("reset") === "1"}
    />
  );
}
