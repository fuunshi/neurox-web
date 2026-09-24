import { RecoverAccountForm } from "./recover-account-form";

export const metadata = { title: "Restore your account" };

export default async function RecoverAccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.email;
  const email = Array.isArray(raw) ? raw[0] : raw;

  return <RecoverAccountForm initialEmail={email} />;
}
