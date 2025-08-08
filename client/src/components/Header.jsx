export default function Header({ room, tipsUrl }) {
  return (
    <div className="header">
      <div>
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src="/CF.png"
            alt="CityFest"
            className="brand-logo"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span>CityFest Requests</span>
        </div>
        <div className="small">
          Room <span className="kbd">{room || '—'}</span> • The Loft, San Diego • Aug 10, 2025
        </div>
      </div>

      {tipsUrl ? (
        <a
          href={tipsUrl}
          target="_blank"
          rel="noreferrer"
          className="button"
          style={{ textDecoration: 'none' }}
          aria-label="Tip Jar"
        >
          💸 Tip Jar
        </a>
      ) : (
        <span className="small">Tip Jar unavailable</span>
      )}
    </div>
  );
}

