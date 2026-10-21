export const LANE_STEP = 18;

export const NODE_X_OFFSET = 12;

export const ROW_HEIGHT = 36;

export const LANE_COLORS = [
    'var(--color-brand)',
    'var(--color-blue)',
    'var(--color-teal)',
    'var(--color-green)',
    'var(--color-peach)',
    'var(--color-mauve)',
    'var(--color-sky)',
    'var(--color-yellow)',
];

export function laneX(lane: number) {
    return NODE_X_OFFSET + lane * LANE_STEP;
}

export function referenceColor(reference: string) {
    const branchName = reference.replace(/^HEAD -> /, '');
    let hash = 0x811c9dc5;
    for (const character of branchName) {
        hash ^= character.codePointAt(0) ?? 0;
        hash = Math.imul(hash, 0x01000193);
    }
    return LANE_COLORS[(hash >>> 0) % LANE_COLORS.length];
}

export async function copyTextToClipboard(value: string) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return;
        }
    } catch {
        // Some desktop webviews reject Clipboard API access; try the legacy path.
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard access was denied');
}

