import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Prose } from "./prose";

/**
 * What the reading surface guarantees.
 *
 * Two of these are security assertions rather than rendering ones, and they are
 * the reason this file exists: **imported material is semi-trusted**, and the
 * notes it produces are rendered on a public, indexable page.
 */
describe("Prose", () => {
  it("renders ordinary markdown", () => {
    render(
      <Prose markdown={"## A heading\n\nSome *emphasis* and a list:\n\n- one\n- two"} />,
    );

    expect(
      screen.getByRole("heading", { name: "A heading", level: 2 }),
    ).toBeDefined();
    expect(screen.getByText("emphasis")).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  /**
   * The constructs a study note actually uses.
   *
   * Worth pinning because the obvious hardening step — adding
   * `rehype-sanitize` — was measured and *removed* for silently deleting
   * content. Whatever else changes here, tables and task lists have to survive.
   */
  it("keeps the GFM a study note depends on", () => {
    const { container } = render(
      <Prose
        markdown={[
          "| Term | Meaning |",
          "| --- | --- |",
          "| Stack | Last in, first out |",
          "",
          "- [x] finished",
          "- [ ] still to do",
        ].join("\n")}
      />,
    );

    // The table survives, and is wrapped so it can scroll on a phone.
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelector(".table-scroll")).not.toBeNull();
    expect(screen.getByRole("cell", { name: "Last in, first out" })).toBeDefined();

    // Task list checkboxes survive, and the checked one is actually checked.
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(2);
    expect((boxes[0] as HTMLInputElement).checked).toBe(true);
  });

  /**
   * The vector that survives without raw HTML.
   *
   * `[click](javascript:alert(1))` is a markdown-level link, not an injected
   * element, so nothing about disabling `rehype-raw` defends against it. Only
   * the URL allow-list does.
   */
  it("refuses a hostile URL scheme", () => {
    const { container } = render(
      <Prose markdown={"[click me](javascript:alert(1))"} />,
    );

    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    // Emptied rather than dropped: the link text is still the author's words.
    expect(anchor?.getAttribute("href") ?? "").not.toContain("javascript:");
  });

  it("keeps in-site links, which this site is built on", () => {
    const { container } = render(
      <Prose markdown={"[Semester 3](/bca/semester-3) and [a note](/bca/x/notes/y)"} />,
    );

    const hrefs = [...container.querySelectorAll("a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toEqual(["/bca/semester-3", "/bca/x/notes/y"]);
  });

  it("opens external links in a new tab, and internal ones in the same one", () => {
    const { container } = render(
      <Prose markdown={"[outside](https://example.com) [inside](/bca)"} />,
    );

    const [external, internal] = [...container.querySelectorAll("a")];

    expect(external.getAttribute("target")).toBe("_blank");
    expect(external.getAttribute("rel")).toContain("noopener");
    expect(internal.getAttribute("target")).toBeNull();
  });

  /**
   * Raw HTML is escaped text, not markup — which is the whole reason
   * `rehype-raw` is absent. If this ever fails, someone added it.
   *
   * Both halves matter and they pull in opposite directions. Nothing may ever
   * be executable; and the text must still be **visible**, because a note
   * teaching HTML has to be able to show a tag. The second half is what ruled
   * out `rehype-sanitize`, which deleted the string entirely and would have
   * silently eaten a lesson on exactly this.
   */
  it("shows raw HTML as inert text rather than executing or deleting it", () => {
    const { container } = render(
      <Prose markdown={"<script>alert(1)</script>"} />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });
});
