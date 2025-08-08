export default function Header({ room, tipsUrl }){
  return (
    <div style={{ textAlign:'center', marginBottom:'16px' }}>
      <img
        src="https://images.squarespace-cdn.com/content/v1/58177a078419c25c3b5b7b46/1705966899824-BGI91I9E5HJZMDK0EK1B/CF.png?format=2500w"
        alt="CityFest Logo"
        style={{ maxWidth:'300px', width:'80%', height:'auto', marginBottom:'8px' }}
      />
      <div className="logo" style={{ textAlign:'center' }}>
        CityFest Requests
      </div>
      <div className="small" style={{ textAlign:'center' }}>
        Room <span className="kbd">{room}</span> • The Loft, San Diego • Aug 10, 2025
      </div>
    </div>
  );
}
