import { Button, buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";

export const metadata = { title: "Kitchen sink" };

/**
 * Development surface: every primitive in every scheme. Not linked from the
 * app. Exists so a palette change can be checked in one place — the point of
 * three schemes is that nothing below this line needs to know which is active.
 */
export default function KitchenSinkPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Kitchen sink</h1>
          <p className="text-ink-muted">
            Every primitive, in whichever scheme is active.
          </p>
        </div>
        <ThemeSwitcher />
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="danger">Delete</Button>
          <Button loading>Working</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <a
            href="https://example.com"
            className={buttonStyles({ variant: "secondary" })}
          >
            A link wearing button styles
          </a>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Chips</h2>
        <div className="flex flex-wrap gap-2">
          <Chip>Neutral</Chip>
          <Chip tone="accent">Active</Chip>
          <Chip tone="due">Draft</Chip>
          <Chip tone="danger">Failed</Chip>
          <Chip tone="success">Ready</Chip>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Fields</h2>
        <Field label="Deck title" required hint="Shown in your library.">
          <Input placeholder="Cardiac physiology" required />
        </Field>
        <Field
          label="Email"
          required
          error="That address is already registered."
        >
          <Input type="email" defaultValue="sam@example.com" />
        </Field>
        <Field
          label="Password"
          required
          error={[
            "Must be at least 8 characters.",
            "Must contain a number.",
          ]}
        >
          <Input type="password" defaultValue="short" />
        </Field>
        <Field label="Paste your notes">
          <Textarea placeholder="Mitosis is the process by which…" />
        </Field>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Panels</h2>
        <Panel>
          <PanelHeader
            title="Flat panel"
            description="Hairline only. The default."
            action={<Button size="sm" variant="secondary">Action</Button>}
          />
          <PanelBody>
            <p className="text-ink-muted">
              Elevation is reserved for things that genuinely float above the
              page, so hierarchy stays legible.
            </p>
          </PanelBody>
        </Panel>
        <Panel elevated>
          <PanelBody>Elevated, for menus and dialogs.</PanelBody>
        </Panel>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">Loading and empty</h2>
        <div className="flex items-center gap-3 text-ink-muted">
          <Spinner /> <span>Spinning</span>
        </div>
        <SkeletonText lines={3} />
        <Skeleton className="h-24 w-full" />
        <EmptyState
          title="No decks yet"
          description="A deck holds the cards for one subject. Create one, then bring your notes to it."
          action={<Button>Create a deck</Button>}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl">Type scale</h2>
        <p className="font-display text-5xl">Reading is the work</p>
        <p className="font-display text-3xl">A deck title in the serif</p>
        <p className="font-display text-xl italic">
          A source excerpt, where the serif earns its keep.
        </p>
        <p className="max-w-prose">
          Body copy in Public Sans at a comfortable measure. The measure is held
          under 80 characters because that is where prose stops being tiring,
          and the leading is generous because these paragraphs are read rather
          than scanned.
        </p>
        <p className="text-ink-muted">Muted, for supporting detail.</p>
        <p className="text-ink-subtle text-sm">Subtle, for metadata.</p>
        <p className="text-accent">Accent, for interactive text.</p>
        <p className="text-due-fg">Due, for anything needing attention.</p>
        <p className="text-danger-fg">Danger, for failures.</p>
      </section>
    </main>
  );
}
