"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type WorkspaceNavigationId = "strategy" | "quality" | "lets-problem-solve" | "training" | "scorecards" | "initiatives" | "reviews" | "vivadocs" | "people" | "settings";

export type WorkspaceNavigationItem = {
  id: WorkspaceNavigationId;
  label: string;
  icon: string;
  href: string;
  group: "Workspace" | "Manage";
  count?: string;
};

export const workspaceNavigationItems: WorkspaceNavigationItem[] = [
  { id: "strategy", label: "Strategy", icon: "◫", href: "/strategy", group: "Workspace" },
  { id: "quality", label: "Quality events", icon: "◇", href: "/quality", group: "Workspace" },
  { id: "lets-problem-solve", label: "Let’s Problem Solve", icon: "◎", href: "/lets-problem-solve", group: "Workspace" },
  { id: "training", label: "Training academy", icon: "▷", href: "/training", group: "Workspace" },
  { id: "scorecards", label: "Scorecards", icon: "◎", href: "/strategy?view=Scorecards", group: "Workspace" },
  { id: "initiatives", label: "Initiatives", icon: "↗", href: "/strategy?view=Initiatives", group: "Workspace", count: "4" },
  { id: "reviews", label: "Reviews", icon: "◷", href: "/strategy?view=Reviews", group: "Workspace" },
  { id: "vivadocs", label: "VivaDocs", icon: "▤", href: "/vivadocs", group: "Workspace" },
  { id: "people", label: "People", icon: "♙", href: "/strategy?view=People", group: "Manage" },
  { id: "settings", label: "Settings", icon: "⚙", href: "/strategy?view=Settings", group: "Manage" },
];

export function navigationItem(id: WorkspaceNavigationId) {
  return workspaceNavigationItems.find((item) => item.id === id)!;
}

export function MobileWorkspaceNavigation({ activeItem }: { activeItem?: WorkspaceNavigationId }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 701px)");
    function closeAtDesktopWidth(event: MediaQueryListEvent) {
      if (event.matches) setOpen(false);
    }
    desktop.addEventListener("change", closeAtDesktopWidth);
    return () => desktop.removeEventListener("change", closeAtDesktopWidth);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function closeDrawer(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <div className="mobile-workspace-navigation">
      <button ref={triggerRef} className="mobile-menu-button" type="button" aria-label="Open workspace navigation" aria-controls="mobile-workspace-drawer" aria-expanded={open} onClick={() => setOpen(true)}>
        <i aria-hidden="true"><span /><span /><span /></i><span>Menu</span>
      </button>
      {open && <div className="mobile-drawer-layer">
        <button className="mobile-drawer-backdrop" type="button" aria-label="Close workspace navigation" onClick={() => closeDrawer(true)} />
        <aside ref={drawerRef} id="mobile-workspace-drawer" className="mobile-workspace-drawer" role="dialog" aria-modal="true" aria-label="Workspace navigation">
          <header>
            <Link href="/" aria-label="Vivad SPARK home" onClick={() => closeDrawer()}><img src="/vivad-logo.png" alt="Vivad SPARK — Hoshin, Continuous Improvement" /></Link>
            <button ref={closeRef} type="button" aria-label="Close workspace navigation" onClick={() => closeDrawer(true)}>×</button>
          </header>
          <nav aria-label="Mobile workspace navigation">
            {(["Workspace", "Manage"] as const).map((group) => <div className="mobile-navigation-group" key={group}>
              <span>{group}</span>
              {workspaceNavigationItems.filter((item) => item.group === group).map((item) => <Link className={activeItem === item.id ? "active" : ""} href={item.href} aria-current={activeItem === item.id ? "page" : undefined} onClick={() => closeDrawer()} key={item.id}>
                <i aria-hidden="true">{item.icon}</i><span>{item.label}</span>{item.count && <b>{item.count}</b>}
              </Link>)}
            </div>)}
          </nav>
          <footer><span>RS</span><div><strong>Rubin Sekuleski</strong><small>Owner · Vivad</small></div></footer>
        </aside>
      </div>}
    </div>
  );
}
