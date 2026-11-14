/** Raw server explanation, kept verbatim (English) behind a Spanish summary. */
export function ServerDetail({
  reason,
  items,
}: {
  reason?: string | null;
  items?: string[];
}) {
  if (!reason && !items?.length) return null;
  return (
    <details className="server-detail">
      <summary>Detalle técnico del servidor (en inglés)</summary>
      <div lang="en">
        {reason && <p>{reason}</p>}
        {items && items.length > 0 && (
          <ul>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
