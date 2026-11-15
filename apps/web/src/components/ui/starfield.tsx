import type { CSSProperties } from "react";

// Fixed positions keep the server render and hydration identical.
const stars = Array.from({ length: 72 }, (_, index) => ({
  left: `${(index * 37 + 11) % 100}%`,
  size: `${index % 4 === 0 ? 4 : index % 3 === 0 ? 3 : 2}px`,
  duration: `${7 + (index % 7)}s`,
  delay: `${-(7 + (index % 7)) * ((index * 23 + 7) % 100) / 100}s`,
  opacity: 0.4 + (index % 4) * 0.12,
}));

export function Starfield() {
  return (
      <div className="starfield" aria-hidden="true">
        {stars.map((star, index) => (
          <span
            key={index}
            className="starfield-star"
            style={{
              left: star.left,
              width: star.size,
              height: star.size,
              opacity: star.opacity,
              "--star-duration": star.duration,
              "--star-delay": star.delay,
            } as CSSProperties}
          />
        ))}
      </div>
  );
}
