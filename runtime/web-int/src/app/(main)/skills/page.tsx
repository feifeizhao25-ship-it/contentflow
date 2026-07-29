const categories = [
  { name: 'Creation', skills: ['Headline improvement', 'Social posts', 'Video scripts'] },
  { name: 'Growth', skills: ['SEO review', 'Market adaptation'] },
  { name: 'Trust', skills: ['Safety review', 'Source verification'] },
];

export default function SkillsPage() {
  return <main className="shell">
    <div className="eyebrow">Verified capabilities</div><h1>Skills for a real workflow.</h1>
    <p>Capabilities are grouped by job to be done. Unreleased features never return simulated results.</p>
    <div className="grid">{categories.map(category => <section className="card" key={category.name}>
      <h2>{category.name}</h2>{category.skills.map(skill => <p key={skill}>{skill}</p>)}
    </section>)}</div>
    <section className="card meta-panel"><span className="status">Coming soon</span>
      <h2>No additional verified skills yet</h2><p>Team approval workflows and trained brand voice are being evaluated before release.</p>
    </section>
  </main>;
}
