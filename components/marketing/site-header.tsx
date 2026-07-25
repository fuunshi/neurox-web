import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { buttonStyles } from "@/components/ui/button";
import { Wordmark } from "./wordmark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href="/"
          className="rounded-md"
          aria-label="neurox, home"
        >
          <Wordmark />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeSwitcher />
          <Link
            href="/auth/login"
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className={buttonStyles({
              variant: "primary",
              size: "sm",
              className: "hidden sm:inline-flex",
            })}
          >
            Create an account
          </Link>
        </div>
      </div>
    </header>
  );
}
