import React, { useEffect, useRef } from 'react';
import { Copy } from '../../../common/components/icons/Copy';
import type { CommitContextMenuState } from '../types/CommitContextMenuState';

export const CommitHashContextMenu: React.FC<{
    menu: CommitContextMenuState;
    onCopy: (hash: string) => void;
    onClose: () => void;
}> = ({ menu, onCopy, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const width = 210;
    const height = 44;
    const left = Math.max(8, Math.min(menu.x, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(menu.y, window.innerHeight - height - 8));

    useEffect(() => {
        const handlePointerDown = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            )
                onClose();
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handlePointerDown);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            role="menu"
            aria-label="Commit actions"
            style={{ left, top }}
            className="fixed z-[60] w-[210px] border border-surface1 bg-mantle py-1 shadow-xl"
        >
            <button
                type="button"
                role="menuitem"
                onClick={() => onCopy(menu.hash)}
                className="flex h-8 w-full items-center gap-2 px-3 text-left text-xs text-text hover:bg-surface0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand"
            >
                <Copy className="h-3.5 w-3.5 text-subtext0" />
                Copy Commit Hash
            </button>
        </div>
    );
};
