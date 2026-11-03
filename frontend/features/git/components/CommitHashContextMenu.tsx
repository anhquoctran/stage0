import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Copy } from '../../../common/components/icons/Copy';
import type { CommitContextMenuState } from '../types/CommitContextMenuState';

export const CommitHashContextMenu: React.FC<{
    menu: CommitContextMenuState;
    onCopy: (hash: string) => void;
    onClose: () => void;
}> = ({ menu, onCopy, onClose }) => {
    const { t } = useTranslation();
    const menuRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 210, height: 44 });
    const copyLabel = t('git.commitDetails.copyHash');
    const { width, height } = size;
    const left = Math.max(8, Math.min(menu.x, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(menu.y, window.innerHeight - height - 8));

    useLayoutEffect(() => {
        const rect = menuRef.current?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
            setSize((previous) => previous.width === rect.width && previous.height === rect.height
                ? previous : { width: rect.width, height: rect.height });
        }
    }, [menu.x, menu.y, copyLabel]);

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
        window.addEventListener('resize', onClose);
        window.addEventListener('scroll', onClose, true);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', onClose);
            window.removeEventListener('scroll', onClose, true);
        };
    }, [onClose]);

    // Client coordinates are viewport-relative. Modal transforms/backdrop filters
    // establish a different fixed-position containing block, so escape it via a portal.
    return createPortal(
        <div
            ref={menuRef}
            role="menu"
            aria-label={t('git.commitDetails.actions')}
            style={{ left, top }}
            className="fixed z-[60] w-[210px] max-w-[calc(100vw-16px)] border border-surface1 bg-mantle py-1 shadow-xl rounded-sm"
        >
            <button
                type="button"
                role="menuitem"
                onClick={() => onCopy(menu.hash)}
                className="flex h-8 w-full items-center gap-2 px-3 text-start text-xs text-text hover:bg-surface0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand rounded-sm"
            >
                <Copy className="h-3.5 w-3.5 text-subtext0" />
                {copyLabel}
            </button>
        </div>,
        document.body,
    );
};
