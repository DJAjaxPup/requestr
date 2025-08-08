import React from 'react';
import QRCode from 'qrcode.react';
import CFLogo from '/CF.png'; // served from public folder

export default function QRJoin({ roomId, venueName, date, location }) {
  const joinUrl = `${window.location.origin}/join/${roomId}`;

  return (
    <div className="card qr-wrap">
      {/* Header */}
      <div className="header">
        <div className="logo">
          <img src={CFLogo} alt="CityFest" className="brand-logo" />
          {venueName?.toUpperCase() || 'EVENT'} REQUESTS
        </div>
        <div className="small">
          Room <span className="badge">{roomId}</span>
          {location && <> • {location}</>}
          {date && <> • {date}</>}
        </div>
      </div>

      {/* QR Code */}
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <QRCode
          value={joinUrl}
          size={200}
          bgColor="transparent"
          fgColor="#ffffff"
          level="H"
          includeMargin={true}
        />
      </div>

      {/* Share link */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <a href={joinUrl} className="link">
          {joinUrl}
        </a>
      </div>
    </div>
  );
}
