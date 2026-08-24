'use client';

import { useState } from 'react';

const people = [
  { id: 'founder', name: 'Maya · Founder', goal: 'Build category trust', channel: 'LinkedIn', plan: 'Pro' },
  { id: 'creator', name: 'Leo · Creator', goal: 'Improve short-form retention', channel: 'TikTok', plan: 'Creator' },
  { id: 'marketer', name: 'Sofia · Growth lead', goal: 'Coordinate a US launch', channel: 'Instagram', plan: 'Business' },
  { id: 'agency', name: 'Noah · Agency owner', goal: 'Reduce approval time', channel: 'YouTube', plan: 'Business' },
  { id: 'analyst', name: 'Aisha · Analyst', goal: 'Publish evidence-led briefs', channel: 'LinkedIn', plan: 'Enterprise' },
];

const stages = [
  ['Set your signal', 'Choose an audience, market and outcome. No performance claim is shown before data exists.'],
  ['Collect evidence', 'Connect one channel and review the first source-backed content pattern.'],
  ['Learn your voice', 'Accept or reject tone suggestions so the workspace learns explicit preferences.'],
  ['Find the constraint', 'One high-impact bottleneck replaces a wall of generic metrics.'],
  ['Run one experiment', 'A platform-native draft and a measurable success criterion are ready for review.'],
  ['Turn insight into action', 'The workspace orders today’s work by urgency, confidence and effort.'],
  ['Review the week', 'See what changed, what remains uncertain and what to do next week.'],
];

export default function ExperienceWeekPage() {
  const [person, setPerson] = useState(people[0]);
  const [day, setDay] = useState(1);
  const [title, summary] = stages[day - 1];
  const confidence = Math.min(42 + day * 7 + people.indexOf(person) * 2, 92);

  return (
    <main className="shell week-shell">
      <div className="eyebrow">Personalization storyboard · demonstration data</div>
      <h1 className="week-title">Five people. Seven days. Five different reasons to return.</h1>
      <p className="week-lead">This is an acceptance view, not a promise of live performance. Select a person and a day to inspect how hierarchy, recommendations and evidence change.</p>

      <div className="persona-strip" role="list" aria-label="Personas">
        {people.map((item) => (
          <button key={item.id} className={`persona-chip ${person.id === item.id ? 'active' : ''}`} onClick={() => setPerson(item)}>
            <strong>{item.name}</strong><span>{item.goal}</span>
          </button>
        ))}
      </div>

      <div className="day-rail" aria-label="Days">
        {stages.map((_, index) => <button key={index} className={day === index + 1 ? 'active' : ''} onClick={() => setDay(index + 1)}>Day {index + 1}</button>)}
      </div>

      <section className="experience-grid">
        <article className="focus-card">
          <div className="focus-meta"><span>{person.channel}</span><span>{person.plan}</span><span>Day {day} of 7</span></div>
          <p className="micro-label">Your priority</p>
          <h2>{title}</h2>
          <p>{summary}</p>
          <div className="actions"><button className="button">{day === 7 ? 'Open weekly review' : 'Start the next action'}</button><button className="button secondary">Why am I seeing this?</button></div>
        </article>
        <aside className="evidence-card">
          <p className="micro-label">Evidence readiness</p>
          <div className="confidence">{confidence}%</div>
          <div className="confidence-track"><i style={{ width: `${confidence}%` }} /></div>
          <p>{day < 3 ? 'Early signal. Recommendations stay conservative until more first-party data is available.' : 'Based on connected activity, explicit preferences and reviewed source material.'}</p>
          <ul><li>Source date is visible</li><li>Facts and suggestions are separated</li><li>Personalization can be turned off</li></ul>
        </aside>
      </section>

      <section className="week-outcomes">
        <article><span>Changed for {person.name.split(' · ')[0]}</span><strong>{day === 1 ? 'Workspace order' : day < 4 ? 'Tone and channel emphasis' : day < 7 ? 'Recommended action' : 'Next-week plan'}</strong></article>
        <article><span>Skill in use</span><strong>{person.id === 'analyst' ? 'Source verification' : person.id === 'agency' ? 'Approval orchestration' : 'Market adaptation'}</strong></article>
        <article><span>Freshness contract</span><strong>Review required after 30 days</strong></article>
      </section>
    </main>
  );
}
