import React, { useEffect, useState } from 'react';

interface Props {
  name: string;
  email: string;
  size?: number;
}

interface HashedAvatar {
  email: string;
  url: string;
}

function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createPixels(seed: number): Array<{ x: number; y: number }> {
  let state = seed || 0x9e3779b9;
  const pixels: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      if ((state & 1) === 1) {
        pixels.push({ x, y }, { x: 4 - x, y });
      }
    }
  }
  return pixels;
}

function PixelIdenticon({ seed }: { seed: number }) {
  const pixels = createPixels(seed);
  const hue = seed % 360;

  return (
    <svg
      viewBox="0 0 5 5"
      aria-hidden="true"
      className="h-full w-full"
      shapeRendering="crispEdges"
    >
      <rect width="5" height="5" fill="var(--color-surface0)" />
      {pixels.map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={`hsl(${hue} 62% 62%)`} />
      ))}
    </svg>
  );
}

export const CommitAuthorAvatar: React.FC<Props> = ({ name, email, size = 40 }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const seed = hashSeed(normalizedEmail || name.trim().toLowerCase() || 'unknown');
  const [gravatar, setGravatar] = useState<HashedAvatar | null>(null);
  const [failedEmail, setFailedEmail] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    if (!normalizedEmail || !globalThis.crypto?.subtle) return;

    const emailBytes = new TextEncoder().encode(normalizedEmail);
    globalThis.crypto.subtle
      .digest('SHA-256', emailBytes)
      .then((digest) => {
        if (!isCurrent) return;
        const hash = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0')
        ).join('');
        setGravatar({
          email: normalizedEmail,
          url: `https://0.gravatar.com/avatar/${hash}?s=80&d=404`,
        });
      })
      .catch(() => {
        // Fall back to a local identicon when Web Crypto is unavailable.
      });

    return () => {
      isCurrent = false;
    };
  }, [normalizedEmail]);

  const hasGravatar = gravatar?.email === normalizedEmail && failedEmail !== normalizedEmail;

  return (
    <span
      className="shrink-0 overflow-hidden rounded-full border border-surface1 bg-surface0"
      style={{ width: size, height: size }}
    >
      {hasGravatar ? (
        <img
          src={gravatar.url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailedEmail(normalizedEmail)}
        />
      ) : (
        <PixelIdenticon seed={seed} />
      )}
    </span>
  );
};
