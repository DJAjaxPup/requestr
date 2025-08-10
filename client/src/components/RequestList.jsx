import { useEffect, useMemo, useState } from 'react';

export default function RequestList({ role = 'audience', items = [], onUpvote }) {
  const [voted, setVoted] = useState(() => {
    try {
      const raw = localStorage.getItem('votedIds');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('votedIds', JSON.stringify(Array.from(voted)));
    } catch {}
  }, [voted]);

  const list = useMemo(() => Array.isArray(items) ? items : [], [items]);

  const vote = (id) => {
    if (!id || voted.has(id)) return;
    const next = new Set(voted);
    next.add(id);
    setVoted(next);
    onUpvote?.(id);
  };

  // Only show a chip for queued/playing; hide for "new" and "done"
  const chip = (status) => {
    if (status === 'playing') return <span className="status-chip">Playing</span>;
    if (status === 'queued')  return <span className="status-chip">Queued</span>;
    return null;
  };

  return (
    <div className="card">
      <h3>Requests</h3>
      <div className="list">
        {list.map((item) => {
          const status = item?.status || 'new';
          const rowClass =
            status === 'playing' ? 'status-playing' :
            status === 'queued'  ? 'status-queued'  :
            status === 'done'    ? 'status-done'    :
            '';

          return (
            <div key={item.id} className={`item ${rowClass}`}>
              <div>
                <div className="item-title">
                  <strong>{item?.song || ''}</strong>
                  {item?.artist ? ` — ${item.artist}` : ''}
                </div>
                <div className="meta" style={{ display:'flex', gap:8, alignItems:'center', marginTop:4 }}>
                  {chip(status)}
                  <span>by {item?.user || 'Guest'}</span>
                </div>
              </div>

              <div className="vote-wrap" style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span className="votes">{item?.votes ?? 0}</span>
                <button
                  className="upvote"
                  onClick={() => vote(item.id)}
                  disabled={voted.has(item.id)}
                  aria-label="Upvote"
                  title={voted.has(item.id) ? 'You already voted' : 'Upvote'}
                  style={{ display:'flex', alignItems:'center', gap:6 }}
                >
                  ▲ <span style={{ fontSize:'0.9em' }}>Upvote</span>
                </button>
              </div>
            </div>
          );
        })}
        {!list.length ? <div className="small">No requests yet.</div> : null}
      </div>
    </div>
  );
}
