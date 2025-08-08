export default function RequestList({ items, onUpvote, role }){
  return (
    <div className="list">
      {items.map(req => (
        <div key={req.id} className={`item status-${req.status}`}>
          <div>
            <div style={{fontWeight:700}}>{req.song} {req.artist ? `— ${req.artist}` : ''}</div>
            {req.note && <div className="meta">“{req.note}”</div>}
            <div className="meta">by {req.user} • votes {req.votes} • {req.status}</div>
          </div>
          <div className="row">
            {role === 'audience' && <button className="button" onClick={()=>onUpvote(req.id)}>▲</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
