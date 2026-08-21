import Link from "next/link";
import { navigationItem } from "./workspace-navigation";

export const QUALITY_SHEET_LINK =
  "https://docs.google.com/spreadsheets/d/1aKVB1RjaQSoEW9yw14YJ2asSrsSwDDR3EB2KnSfPRMc/edit?gid=407617143#gid=407617143";

type QualityWorkspaceSidebarProps = {
  activeItem: "quality" | "lets-problem-solve";
};

export function QualityWorkspaceSidebar({ activeItem }: QualityWorkspaceSidebarProps) {
  const onQualityPage = activeItem === "quality";
  const qualityItem = navigationItem("quality");
  const problemSolveItem = navigationItem("lets-problem-solve");

  return (
    <aside className="quality-sidebar">
      <Link className="quality-brand" href="/" aria-label="Vivad SPARK home">
        <img src="/vivad-logo.png" alt="Vivad SPARK — Hoshin, Continuous Improvement" />
      </Link>
      <nav aria-label="Vivad workspace">
        <span className="quality-nav-label">Workspace</span>
        <Link href={navigationItem("strategy").href}><i aria-hidden="true">{navigationItem("strategy").icon}</i> {navigationItem("strategy").label}</Link>
        <Link className={onQualityPage ? "active" : undefined} href={qualityItem.href} aria-current={onQualityPage ? "page" : undefined}><i aria-hidden="true">{qualityItem.icon}</i> {qualityItem.label}</Link>
        <Link href={navigationItem("training").href}><i aria-hidden="true">{navigationItem("training").icon}</i> {navigationItem("training").label}</Link>
        <Link href={navigationItem("vivadocs").href}><i aria-hidden="true">{navigationItem("vivadocs").icon}</i> {navigationItem("vivadocs").label}</Link>
        <Link href={onQualityPage ? "#trends" : "/quality#trends"}><i aria-hidden="true">↗</i> Trends</Link>
        <Link href={onQualityPage ? "#event-log" : "/quality#event-log"}><i aria-hidden="true">☷</i> Event log</Link>
        <Link className={!onQualityPage ? "active" : undefined} href={problemSolveItem.href} aria-current={!onQualityPage ? "page" : undefined}><i aria-hidden="true">{problemSolveItem.icon}</i> {problemSolveItem.label}</Link>
      </nav>
      <div className="quality-sidebar-note">
        <span>LIVE SOURCE</span>
        <strong>Google Sheets</strong>
        <small>Read-only connection</small>
        <a href={QUALITY_SHEET_LINK} target="_blank" rel="noreferrer">Open source log ↗</a>
      </div>
    </aside>
  );
}
