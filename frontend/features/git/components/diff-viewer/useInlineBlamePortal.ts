import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { ChangedFile } from '../../types/ChangedFile';
import type { RepoInfo } from '../../types/RepoInfo';
import type { FileBlamePayload } from '../../types/FileBlamePayload';
import type { BlameCommit } from '../../types/BlameCommit';

export function useInlineBlamePortal({
  selectedFile,
  currentRepo,
  compareBranch,
  baseBranch,
  fetchFileBlame,
  toggleFileBlame,
  blamePayload,
  showInlineBlame,
  viewMode,
  fileViewTab,
  fontSize,
  fontFamily,
  theme,
  diffData,
}: {
  selectedFile: ChangedFile | null;
  currentRepo: RepoInfo | null;
  compareBranch: string;
  baseBranch: string;
  fetchFileBlame: (path: string, revision: string) => void;
  toggleFileBlame: () => void;
  blamePayload: FileBlamePayload | null;
  showInlineBlame: boolean;
  viewMode: 'split' | 'unified';
  fileViewTab: string;
  fontSize: number;
  fontFamily: string;
  theme: string;
  diffData: unknown;
}) {
  const [activeLine, setActiveLine] = useState<{
    side: 'old' | 'new';
    lineNo: number;
  } | null>(null);
  const [oldBlamePayload, setOldBlamePayload] = useState<FileBlamePayload | null>(null);
  const [portalMount, setPortalMount] = useState<HTMLElement | null>(null);
  const diffContainerRef = useRef<HTMLDivElement>(null);

  // Global Alt+B shortcut to toggle blame
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleFileBlame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFileBlame]);

  // Prefetch git blame for current file in background (for compare revision & base revision)
  useEffect(() => {
    if (selectedFile && currentRepo && !selectedFile.is_binary) {
      fetchFileBlame(selectedFile.path, compareBranch || 'HEAD');
      if (baseBranch) {
        const oldPath = selectedFile.old_path || selectedFile.path;
        invoke<FileBlamePayload>('get_file_blame', {
          repoPath: currentRepo.local_path,
          filePath: oldPath,
          revision: baseBranch,
          ignoreWhitespace: false,
        })
          .then((payload) => setOldBlamePayload(payload))
          .catch(() => setOldBlamePayload(null));
      }
    } else if (selectedFile?.is_binary) {
      setOldBlamePayload(null);
    }
  }, [
    selectedFile?.path,
    selectedFile?.old_path,
    selectedFile?.is_binary,
    compareBranch,
    baseBranch,
    currentRepo?.local_path,
    fetchFileBlame,
  ]);

  // Set default active line on file change
  useEffect(() => {
    if (selectedFile) {
      setActiveLine({ side: 'new', lineNo: 1 });
    }
  }, [selectedFile?.path]);

  // Handle clicking any line in the diff viewer to move active inline blame line
  const handleDiffClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.inline-blame-badge')) return;

    const tr = target.closest('tr.diff-line') as HTMLTableRowElement | null;
    if (!tr) return;

    const oldNumTd = tr.querySelector('.diff-line-old-num') as HTMLElement | null;
    const newNumTd = tr.querySelector('.diff-line-new-num') as HTMLElement | null;
    const oldContentTd = tr.querySelector('.diff-line-old-content') as HTMLElement | null;
    const newContentTd = tr.querySelector('.diff-line-new-content') as HTMLElement | null;

    const unifiedNumTd = tr.querySelector('.diff-line-num') as HTMLElement | null;
    const unifiedContentTd = tr.querySelector('.diff-line-content') as HTMLElement | null;

    let side: 'old' | 'new' = 'new';
    let lineNo: number | null = null;

    if (oldContentTd && newContentTd) {
      // Split mode
      const isOldSide = Boolean(target.closest('.diff-line-old-content, .diff-line-old-num'));
      if (isOldSide) {
        side = 'old';
        const numSpan = oldNumTd?.querySelector('[data-line-num]');
        const raw = numSpan?.getAttribute('data-line-num');
        lineNo = raw ? parseInt(raw, 10) : null;
      } else {
        side = 'new';
        const numSpan = newNumTd?.querySelector('[data-line-num]');
        const raw = numSpan?.getAttribute('data-line-num');
        lineNo = raw ? parseInt(raw, 10) : null;
      }
    } else if (unifiedContentTd && unifiedNumTd) {
      // Unified mode
      const newSpan = unifiedNumTd.querySelector('[data-line-new-num]');
      const oldSpan = unifiedNumTd.querySelector('[data-line-old-num]');
      const newRaw = newSpan?.getAttribute('data-line-new-num');
      const oldRaw = oldSpan?.getAttribute('data-line-old-num');

      if (newRaw && parseInt(newRaw, 10)) {
        side = 'new';
        lineNo = parseInt(newRaw, 10);
      } else if (oldRaw && parseInt(oldRaw, 10)) {
        side = 'old';
        lineNo = parseInt(oldRaw, 10);
      }
    }

    if (lineNo && !isNaN(lineNo)) {
      setActiveLine({ side, lineNo });
    }
  }, []);

  // Compute active commit from blame payload
  const activeBlameCommit: BlameCommit | null = useMemo(() => {
    if (!activeLine) return null;
    const payload =
      activeLine.side === 'old' && oldBlamePayload ? oldBlamePayload : blamePayload;
    if (!payload) return null;
    const line = payload.lines.find((l) => l.line_no === activeLine.lineNo);
    if (!line) return null;
    return payload.commits[line.commit_id] || null;
  }, [activeLine, blamePayload, oldBlamePayload]);

  // Mount inline blame DOM wrapper and set active line highlight
  useEffect(() => {
    if (!showInlineBlame) {
      if (diffContainerRef.current) {
        diffContainerRef.current
          .querySelectorAll('.stage0-active-line')
          .forEach((el) => el.classList.remove('stage0-active-line'));
        diffContainerRef.current
          .querySelectorAll('.stage0-inline-blame-wrapper')
          .forEach((el) => el.remove());
      }
      setPortalMount(null);
      return;
    }

    if (!activeLine || !diffContainerRef.current) return;
    const container = diffContainerRef.current;

    let targetTd: HTMLElement | null = null;

    // Split view check
    if (activeLine.side === 'new') {
      const span = container.querySelector(
        `.diff-line-new-num [data-line-num="${activeLine.lineNo}"]`
      );
      if (span) {
        targetTd = span.closest('tr')?.querySelector('.diff-line-new-content') as HTMLElement | null;
      }
    } else {
      const span = container.querySelector(
        `.diff-line-old-num [data-line-num="${activeLine.lineNo}"]`
      );
      if (span) {
        targetTd = span.closest('tr')?.querySelector('.diff-line-old-content') as HTMLElement | null;
      }
    }

    // Unified view check
    if (!targetTd) {
      if (activeLine.side === 'new') {
        const span = container.querySelector(
          `[data-line-new-num="${activeLine.lineNo}"]`
        );
        if (span) {
          targetTd = span.closest('tr')?.querySelector('.diff-line-content') as HTMLElement | null;
        }
      } else {
        const span = container.querySelector(
          `[data-line-old-num="${activeLine.lineNo}"]`
        );
        if (span) {
          targetTd = span.closest('tr')?.querySelector('.diff-line-content') as HTMLElement | null;
        }
      }
    }

    if (!targetTd) {
      setPortalMount(null);
      return;
    }

    // Update active line highlight
    container
      .querySelectorAll('.stage0-active-line')
      .forEach((el) => el.classList.remove('stage0-active-line'));
    targetTd.closest('tr')?.classList.add('stage0-active-line');

    // Remove old mount points from other lines
    container.querySelectorAll('.stage0-inline-blame-wrapper').forEach((el) => {
      if (el.parentElement !== targetTd) {
        el.remove();
      }
    });

    // Create or locate mount point in targetTd
    let mount = targetTd.querySelector('.stage0-inline-blame-wrapper') as HTMLElement | null;
    if (!mount) {
      mount = document.createElement('span');
      mount.className = 'stage0-inline-blame-wrapper';
      targetTd.appendChild(mount);
    }

    setPortalMount(mount);
  }, [
    activeLine,
    showInlineBlame,
    diffData,
    viewMode,
    fileViewTab,
    fontSize,
    fontFamily,
    theme,
  ]);

  // Clean up portal mount and active line highlight on unmount or file change
  useEffect(() => {
    return () => {
      if (diffContainerRef.current) {
        diffContainerRef.current
          .querySelectorAll('.stage0-active-line')
          .forEach((el) => el.classList.remove('stage0-active-line'));
        diffContainerRef.current
          .querySelectorAll('.stage0-inline-blame-wrapper')
          .forEach((el) => el.remove());
      }
    };
  }, [selectedFile?.path]);

  return {
    diffContainerRef,
    handleDiffClick,
    activeLine,
    activeBlameCommit,
    portalMount,
  };
}

