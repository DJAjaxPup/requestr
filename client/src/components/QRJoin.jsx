import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export default function QRJoin({ roomCode }) {
  const canvasRef = useRef(null);
  const [link, setLink] = useState('');

  useEffect(() => {
    if (!roomCode || !canvasRef.current) return;

    // Responsive size: wide on desktop, big enough on phones
    const base = Math.min(320, Math.floor(window.innerWidth - 64));
    const size = Math.max(200, base);

    const url = `${window.location.origin}/?room=${encodeURIComponent(roomCode)}`;
    setLink(url);

    QRCode.toCanvas(canvasRef.current, url, { width: size, margin: 1 }, (err) => {
      if (err) console.error('QR render error:', err);
    });
  }, [roomCode]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); } catch {}
  };

  if (!roomCode) return null;

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/CF.png" alt="CityFest" className="brand-logo" />
          <span>CityFest — Scan to Request</span>
        </div>
      </div>

      <div className="row qr-wrap" style={{ alignItems: 'flex-start', marginTop: 12 }}>
        <canvas ref={canvasRef} />
        <div>
          <div className="small" style={{ maxWidth: 260, wordBreak: 'break-word' }}>{link}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="button" onClick={copy}>Copy link</button>
          </div>
          <div className="meta" style={{ marginTop: 6 }}>
            Tip: screenshot the QR and drop it on the venue screens.
          </div>
        </div>
      </div>
    </div>
  );
}
