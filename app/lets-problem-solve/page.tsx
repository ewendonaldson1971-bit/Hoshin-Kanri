import { MobileWorkspaceNavigation } from "../components/workspace-navigation";
import { QualityWorkspaceSidebar } from "../components/quality-workspace-sidebar";

export default function LetsProblemSolvePage() {
  return (
    <div className="quality-shell">
      <QualityWorkspaceSidebar activeItem="lets-problem-solve" />

      <main className="quality-main problem-solve-main">
        <header className="quality-topbar problem-solve-topbar">
          <MobileWorkspaceNavigation activeItem="lets-problem-solve" />
          <div className="problem-solve-heading">
            <span className="quality-eyebrow">CONTINUOUS IMPROVEMENT</span>
            <h1>Let’s Problem Solve</h1>
            <p>A structured space for reviewing issues, identifying causes and building practical solutions.</p>
          </div>
        </header>

        <section className="problem-solve-placeholder" aria-labelledby="problem-solve-placeholder-title">
          <span aria-hidden="true">◎</span>
          <h2 id="problem-solve-placeholder-title">Problem-solving tools and workflows will be added here.</h2>
        </section>
      </main>
    </div>
  );
}
