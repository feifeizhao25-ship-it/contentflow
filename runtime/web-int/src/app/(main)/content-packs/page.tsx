const packs = [
  ['Product launch', 'LinkedIn · X · YouTube', '7 drafts', 'US / UK'],
  ['Founder narrative', 'LinkedIn · Newsletter', '4 drafts', 'Global English'],
  ['Customer education', 'TikTok · Instagram', '12 drafts', 'AU / SG'],
];
export default function ContentPacksPage(){return <main className="shell"><div className="eyebrow">Campaign library</div><h1>Content packs built around outcomes.</h1><p>Each pack keeps claims, market notes, channel variants, and approval status together.</p><div className="grid">{packs.map(([name,channels,count,markets])=><article className="card" key={name}><span className="status">{markets}</span><h2>{name}</h2><p>{channels}</p><div className="metric">{count}</div></article>)}</div></main>}
