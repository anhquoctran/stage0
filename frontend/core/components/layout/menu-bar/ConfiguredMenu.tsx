import { useEffect, useState } from 'react';
import { Check } from '../../../../common/components/icons/Check';
import { ChevronRight } from '../../../../common/components/icons/ChevronRight';
import { formatShortcutText } from '../../../../common/utils/shortcuts';
import {
  MENU_COMMANDS,
  RECENT_MENU,
  menuEnabled,
  menuLabel,
  menuNodesForPlatform,
} from '../../../constants/applicationMenu';
import type { ConfiguredMenuProps } from '../../../types/menu/ConfiguredMenuProps';
import type { MenuNode } from '../../../types/menu/MenuNode';
import { menuIcons } from './menuIcons';

export function ConfiguredMenu(props: ConfiguredMenuProps) {
  const { node, flags, platform, fileManager, execute, onClose, recentRepos } = props;
  const [hovered, setHovered] = useState(false);
  const [activeChild, setActiveChild] = useState<string | null>(null);
  const topLevel = props.onToggle !== undefined;
  const open = props.isOpen ?? hovered;
  useEffect(() => {
    if (!open) setActiveChild(null);
  }, [open]);
  const command = node.command ? MENU_COMMANDS[node.command] : undefined;
  const enabled = menuEnabled(command?.requires || node.requires, flags);
  const checked = command?.checked ? Boolean(flags[command.checked as keyof typeof flags]) : false;
  const label = menuLabel(command?.label || node.label || '', fileManager);
  const Icon = menuIcons[command?.icon || node.icon || ''];
  const children: MenuNode[] =
    node.dynamic === 'recentRepositories'
      ? [
          ...recentRepos.map((repo) => ({
            command: `recent_repo_${repo.id}`,
            label: repo.name,
            description: repo.local_path,
          })),
          ...(recentRepos.length
            ? [
                { separator: true },
                {
                  id: 'remove_recent_menu',
                  label: RECENT_MENU.removeLabel,
                  icon: 'Trash2',
                  items: recentRepos.map((repo) => ({
                    command: `remove_recent_repo_${repo.id}`,
                    label: repo.name,
                    description: repo.local_path,
                  })),
                },
                { command: 'clear_recent' },
              ]
            : []),
        ]
      : menuNodesForPlatform(node.items || [], platform);

  if (node.separator) return <div role="separator" className="my-1 border-t border-surface0" />;
  if (node.command)
    return (
      <button
        type="button"
        role={command?.checked ? 'menuitemcheckbox' : 'menuitem'}
        aria-checked={command?.checked ? checked : undefined}
        disabled={!enabled}
        data-menu-command={node.command}
        title={node.description}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={props.onHover}
        onClick={() => {
          onClose();
          execute(node.command!);
        }}
        className="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-left text-xs text-text hover:bg-surface1 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-subtext0" />}
        <span className="min-w-0 flex-1 truncate">
          {label}
          {node.description && (
            <span className="block truncate font-mono text-[10px] text-subtext0">
              {node.description}
            </span>
          )}
        </span>
        {command?.shortcut && (
          <span className="font-mono text-[10px] text-subtext0">
            {formatShortcutText(command.shortcut, platform === 'macos').replaceAll(
              'CmdOrCtrl',
              'Ctrl'
            )}
          </span>
        )}
        {checked && <Check className="h-3.5 w-3.5" />}
      </button>
    );

  return (
    <div
      className={topLevel ? 'relative flex h-full items-center' : 'relative'}
      onMouseEnter={() => {
        setHovered(true);
        props.onHover?.();
      }}
      onMouseLeave={() => {
        setHovered(false);
        setActiveChild(null);
        props.onLeave?.();
      }}
    >
      <button
        type="button"
        disabled={!enabled}
        role={topLevel ? undefined : 'menuitem'}
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (topLevel) props.onToggle?.();
          else if (open) {
            setHovered(false);
            props.onLeave?.();
          } else {
            setHovered(true);
            props.onHover?.();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
            event.preventDefault();
            setHovered(true);
            if (topLevel && !open) props.onToggle?.();
            if (!topLevel) props.onHover?.();
            const button = event.currentTarget;
            requestAnimationFrame(() =>
              button.parentElement?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()
            );
          }
        }}
        className={`flex items-center gap-2 rounded-sm text-xs disabled:opacity-40 ${topLevel ? `px-2.5 py-1 ${open ? 'bg-surface1 text-text' : 'text-subtext1 hover:bg-surface0'}` : 'w-full px-3 py-1.5 text-left text-text hover:bg-surface1'}`}
      >
        {!topLevel && Icon && <Icon className="h-3.5 w-3.5 text-subtext0" />}
        <span className="flex-1">{label}</span>
        {!topLevel && <ChevronRight className="h-3.5 w-3.5 text-subtext0" />}
      </button>
      {open && enabled && (
        <div
          role="menu"
          aria-label={label}
          className={`absolute z-50 min-w-64 rounded-sm border border-surface0 bg-mantle py-1.5 shadow-2xl ${topLevel ? 'left-0 top-full mt-0.5' : 'left-full top-0'} `}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' && !topLevel) {
              event.preventDefault();
              event.stopPropagation();
              props.onLeave?.();
              event.currentTarget.parentElement?.querySelector('button')?.focus();
              return;
            }
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            const items = [
              ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                ':scope > button:not(:disabled), :scope > div > button:not(:disabled)'
              ),
            ];
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            event.preventDefault();
            event.stopPropagation();
            items[
              (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
            ]?.focus();
          }}
        >
          {node.dynamic && !recentRepos.length && (
            <p className="px-3 py-2 text-xs text-subtext0">{RECENT_MENU.emptyLabel}</p>
          )}
          {children.map((child, index) => (
            <ConfiguredMenu
              key={child.command || child.id || index}
              {...props}
              node={child}
              isOpen={child.id ? activeChild === child.id : undefined}
              onToggle={undefined}
              onHover={() => setActiveChild(child.id || null)}
              onLeave={() => setActiveChild((current) => (current === child.id ? null : current))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
