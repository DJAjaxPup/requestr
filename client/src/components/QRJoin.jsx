import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export default function QRJoin({ roomCode }){
  const canvasRef = useRef(null);
  const [link, setLink] = useState('');

  useEffect(() => {
    if (!roomCode) return;
    const url = `${window.location.origin}/?room=${encodeURIComponent(roomCode)}`;

    setLink(url);
    QRCode.toCanvas(canvasRef.current, url, { width: 220, margin: 1 }, (err) => {
      if (err) console.error(err);
    });
  }, [roomCode]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); } catch {}
  };

  if (!roomCode) return null;
  return (
    <div className="card" style={{marginTop:12}}>
      <h3>Share / QR</h3>
      <div className="row" style={{alignItems:'flex-start'}}>
        <canvas ref={canvasRef} />
        <div>
          <div className="small" style={{maxWidth:260, wordBreak:'break-word'}}>{link}</div>
          <div className="row" style={{marginTop:8}}>
            <button className="button" onClick={copy}>Copy link</button>
          </div>
          <div className="meta" style={{marginTop:6}}>Tip: print this QR on a sign or show it on your laptop screen.</div>
        </div>
      </div>
    </div>
  );
}
