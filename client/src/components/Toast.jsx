export default function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="toast toast-show" role="status" aria-live="polite">
      {msg}
    </div>
  );
}
