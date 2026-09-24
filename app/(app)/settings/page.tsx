import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Panel, PanelHeader, PanelBody } from "@/components/ui/panel";
import { getProfile } from "@/lib/server/queries";
import { ProfileForm } from "./profile-form";
import { SecurityPanel } from "./security-panel";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { profile } = await getProfile();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl">Settings</h1>
        <p className="mt-1 text-ink-muted">Your account and sign-in details.</p>
      </div>

      <Panel>
        <PanelHeader
          title="Profile"
          description="How your name appears, and where you are studying from."
        />
        <PanelBody>
          <ProfileForm
            initial={{
              firstName: profile.firstName ?? "",
              lastName: profile.lastName ?? "",
              displayName: profile.displayName ?? "",
              bio: profile.bio ?? "",
              country: profile.country ?? "",
              timezone: profile.timezone ?? "",
              language: profile.language ?? "",
            }}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Signing in"
          description="Password and two-factor authentication."
        />
        <PanelBody>
          <SecurityPanel />
        </PanelBody>
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/auth/forgot-password"
          className={buttonStyles({ variant: "quiet" })}
        >
          Reset your password by email
        </Link>
      </div>
    </div>
  );
}
