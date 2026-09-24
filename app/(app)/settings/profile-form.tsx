"use client";

import { useState } from "react";
import { FormBanner } from "@/components/auth/form-banner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import type { UserProfile } from "@/lib/api-types";
import { useSubmit } from "@/lib/hooks/use-submit";

interface ProfileValues {
  firstName: string;
  lastName: string;
  displayName: string;
  bio: string;
  country: string;
  timezone: string;
  language: string;
}

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const { pending, error, fieldErrors, submit, setFieldErrors } = useSubmit();
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(false);

  const set = (key: keyof ProfileValues) => (value: string) => {
    setSaved(false);
    setValues((current) => ({ ...current, [key]: value }));
  };

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!values.firstName.trim()) {
      setFieldErrors({ firstName: "A first name is required." });
      return;
    }

    const outcome = await submit(() =>
      apiFetch<UserProfile>("user/update-profile", {
        method: "PUT",
        body: {
          // Always sent: the DTO has no `@IsOptional` on it, so omitting it is a
          // 400 even on a partial update.
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim() || undefined,
          displayName: values.displayName.trim() || undefined,
          bio: values.bio.trim() || undefined,
          country: values.country.trim() || undefined,
          timezone: values.timezone.trim() || undefined,
          language: values.language.trim() || undefined,
          // `socialLinks` and `preferences` are deliberately not sent. The API
          // validates them with `@IsJSON`, so they would have to go as JSON
          // *strings* while it returns them as objects — an easy way to corrupt
          // them from a form that does not edit them.
        },
      }),
    );

    if (outcome.ok) setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormBanner error={error} />
      {saved ? <FormBanner tone="accent">Profile saved.</FormBanner> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required error={fieldErrors.firstName}>
          <Input
            value={values.firstName}
            onChange={(event) => set("firstName")(event.target.value)}
            required
          />
        </Field>

        <Field label="Last name" error={fieldErrors.lastName}>
          <Input
            value={values.lastName}
            onChange={(event) => set("lastName")(event.target.value)}
          />
        </Field>
      </div>

      <Field
        label="Display name"
        error={fieldErrors.displayName}
        hint="Used instead of your full name where a short one fits better."
      >
        <Input
          value={values.displayName}
          onChange={(event) => set("displayName")(event.target.value)}
        />
      </Field>

      <Field label="About" error={fieldErrors.bio}>
        <Textarea
          rows={3}
          value={values.bio}
          onChange={(event) => set("bio")(event.target.value)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Country" error={fieldErrors.country}>
          <Input
            value={values.country}
            onChange={(event) => set("country")(event.target.value)}
          />
        </Field>

        <Field label="Timezone" error={fieldErrors.timezone}>
          <Input
            value={values.timezone}
            onChange={(event) => set("timezone")(event.target.value)}
            placeholder="UTC"
          />
        </Field>

        <Field label="Language" error={fieldErrors.language}>
          <Input
            value={values.language}
            onChange={(event) => set("language")(event.target.value)}
            placeholder="en"
          />
        </Field>
      </div>

      <Button type="submit" loading={pending} className="self-start">
        Save changes
      </Button>
    </form>
  );
}
