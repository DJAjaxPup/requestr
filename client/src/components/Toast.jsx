export default function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#28a745', // bright green for success
        color: '#fff',
        padding: '12px 20px',
        borderRadius: 6,
        fontWeight: 600,
        fontSize: '1rem',
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        zIndex: 1000,
        animation: 'fadeInOut 2.5s ease'
      }}
    >
      {msg}
    </div>
  );
}

