export default function Header({ room, tipsUrl }){
  return (
    <div className="header">
      <div>
        <div className="logo">Requestr</div>
        <div className="small">Room <span className="kbd">{room}</span></div>
      </div>
      {tipsUrl ? <a className="link" href={tipsUrl} target="_blank" rel="noreferrer">Tip the DJ</a> : <span className="small">No tip link</span>}
    </div>
  );
}
