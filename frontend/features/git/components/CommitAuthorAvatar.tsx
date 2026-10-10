import React, { useEffect, useState } from 'react';
import type { CommitAuthorAvatarProps } from '../types/CommitAuthorAvatarProps';
import type { HashedAvatar } from '../types/HashedAvatar';
import { PixelIdenticon } from './PixelIdenticon';

function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export const CommitAuthorAvatar: React.FC<CommitAuthorAvatarProps> = ({ name, email, size = 40 }) => {
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
