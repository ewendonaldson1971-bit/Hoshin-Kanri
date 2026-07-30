import Link from "next/link";

const outcomes = [
  { value: "72%", label: "Plan confidence", detail: "+6% this quarter", tone: "green" },
  { value: "18", label: "Outcome owners", detail: "All updated", tone: "blue" },
  { value: "4", label: "Active initiatives", detail: "3 on track", tone: "red" },
  { value: "30", label: "Day review rhythm", detail: "Next: 16 Sep", tone: "grey" },
];

const systemSteps = [
  {
    number: "01",
    title: "Choose the vital few",
    text: "Translate ambition into a small set of breakthrough objectives that everyone can name and understand.",
  },
  {
    number: "02",
    title: "Connect work to outcomes",
    text: "Make the relationship between priorities, measures, initiatives, and accountable leaders visible.",
  },
  {
    number: "03",
    title: "Learn through review",
    text: "Use a consistent monthly rhythm to surface gaps, agree countermeasures, and adapt without losing direction.",
  },
];

export default function HomePage() {
  return (
    <div className="home-page">
      <header className="home-header">
        <Link className="brand home-brand" href="/" aria-label="Vivad home">
          <img className="vivad-logo" src="/vivad-logo.png" alt="Vivad" />
        </Link>
        <nav className="home-nav" aria-label="Home navigation">
          <a href="#system">The system</a>
          <a href="#alignment">Alignment</a>
          <a href="#rhythm">Review rhythm</a>
          <Link href="/quality">Quality events</Link>
        </nav>
        <Link className="button button-primary header-cta" href="/strategy">
          Open workspace <span>→</span>
        </Link>
      </header>

      <main>
        <section className="home-hero">
          <div className="hero-copy">
            <span className="home-kicker"><i /> FY2026 planning workspace</span>
            <h1>Turn strategy into<br /><em>a system of action.</em></h1>
            <p>
              Hoshin Kanri connects your biggest priorities to measurable outcomes,
              accountable owners, and a review rhythm that keeps the whole organisation moving.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary home-primary" href="/strategy">
                Explore the workspace <span>→</span>
              </Link>
              <a className="button button-secondary" href="#system">See how it works</a>
            </div>
            <div className="hero-proof">
              <div className="proof-avatars"><span>MC</span><span>LW</span><span>NS</span><span>AB</span></div>
              <p><strong>One plan. One language.</strong><br />Built for leaders and teams doing the work.</p>
            </div>
          </div>

          <div className="hero-visual" aria-label="Strategy alignment preview">
            <div className="visual-aura aura-blue" />
            <div className="visual-aura aura-green" />
            <article className="north-card">
              <div className="mini-heading">
                <div><span>TRUE NORTH</span><strong>Strategy deployment</strong></div>
                <span className="mini-score">72%</span>
              </div>
              <div className="mini-objectives">
                <div><i className="mini-line blue" /><span>O1</span><strong>Effortless customer experience</strong><small>78%</small></div>
                <div><i className="mini-line red" /><span>O2</span><strong>Predictable delivery engine</strong><small>64%</small></div>
                <div><i className="mini-line green" /><span>O3</span><strong>High-performance culture</strong><small>71%</small></div>
              </div>
            </article>
            <article className="matrix-preview">
              <span className="preview-label">ALIGNMENT</span>
              <div className="preview-grid">
                {Array.from({ length: 20 }).map((_, index) => (
                  <i className={index === 6 || index === 13 ? "strong" : index === 8 || index === 16 ? "support" : ""} key={index} />
                ))}
              </div>
            </article>
            <article className="review-preview">
              <span className="review-icon">✓</span>
              <div><strong>September review</strong><small>18 of 18 updates ready</small></div>
            </article>
          </div>
        </section>

        <section className="outcome-strip" aria-label="Plan summary">
          {outcomes.map((outcome) => (
            <article key={outcome.label}>
              <span className={`outcome-signal ${outcome.tone}`} />
              <div><strong>{outcome.value}</strong><span>{outcome.label}</span><small>{outcome.detail}</small></div>
            </article>
          ))}
        </section>

        <section className="system-section" id="system">
          <div className="home-section-heading">
            <div>
              <span className="section-number">01</span>
              <span className="section-kicker red">The operating system</span>
              <h2>Strategy people can actually use.</h2>
            </div>
            <p>
              A practical system for creating focus, making trade-offs visible, and turning
              review meetings into decisions—not status theatre.
            </p>
          </div>
          <div className="system-grid">
            {systemSteps.map((step) => (
              <article key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <i />
              </article>
            ))}
          </div>
        </section>

        <section className="alignment-section" id="alignment">
          <div className="alignment-copy">
            <span className="section-kicker">The alignment view</span>
            <h2>See the whole strategy.<br />Understand your part.</h2>
            <p>
              The X-matrix makes cause and effect explicit. It shows how long-term direction,
              annual priorities, measures, and improvement work reinforce one another.
            </p>
            <ul>
              <li><span>✓</span> Connect every initiative to an outcome</li>
              <li><span>✓</span> Clarify ownership before work begins</li>
              <li><span>✓</span> Find gaps and overload at a glance</li>
            </ul>
            <Link className="text-link home-link" href="/strategy">Explore the X-matrix <span>→</span></Link>
          </div>
          <div className="xmatrix">
            <div className="x-top"><span>BREAKTHROUGH OBJECTIVES</span><strong>Customer</strong><strong>Delivery</strong><strong>People</strong></div>
            <div className="x-left"><span>ANNUAL PRIORITIES</span><strong>Effortless experience</strong><strong>Reliable flow</strong><strong>Frontline capability</strong></div>
            <div className="x-center">
              {[3, 1, 2, 1, 3, 2, 2, 2, 3].map((level, index) => <i className={`dot-level-${level}`} key={index} />)}
            </div>
            <div className="x-right"><span>OWNERS</span><strong>M. Chen</strong><strong>L. Ward</strong><strong>N. Singh</strong></div>
            <div className="x-bottom"><span>OUTCOME MEASURES</span><strong>CES ≤ 2.0</strong><strong>OTD 96%</strong><strong>Engage 82</strong></div>
          </div>
        </section>

        <section className="rhythm-section" id="rhythm">
          <div className="rhythm-card">
            <span className="section-kicker red">The review rhythm</span>
            <h2>Progress without surprises.</h2>
            <p>A simple monthly cadence keeps facts current, decisions clear, and countermeasures moving.</p>
            <div className="rhythm-line">
              {[
                ["W1", "Update", "Owners refresh measures"],
                ["W2", "Understand", "Teams explain the gaps"],
                ["W3", "Decide", "Leaders remove blockers"],
                ["W4", "Act", "Countermeasures move"],
              ].map(([week, title, text], index) => (
                <div key={week}>
                  <span className={index === 2 ? "active" : ""}>{week}</span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="home-cta">
          <div>
            <span className="section-kicker">Your strategy, in motion</span>
            <h2>Make progress visible.<br /><em>Make action inevitable.</em></h2>
          </div>
          <Link className="button button-primary home-primary" href="/strategy">Open the FY2026 plan <span>→</span></Link>
        </section>
      </main>

      <footer className="home-footer">
        <Link className="brand home-brand" href="/" aria-label="Vivad home">
          <img className="vivad-logo footer-vivad-logo" src="/vivad-logo.png" alt="Vivad" />
        </Link>
        <p>Strategy deployment for teams that value clarity, learning, and action.</p>
        <span>FY2026 · Corporate strategy</span>
      </footer>
    </div>
  );
}
