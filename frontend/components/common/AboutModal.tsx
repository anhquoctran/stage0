import React, { useState, useEffect } from 'react';
import { AppLogo } from './AppLogo';
import { Check, Copy, DownloadCloud, X } from './icons';
import { useAboutInfo } from '../../hooks/useAboutInfo';
import { usePreferencesStore } from '../../store/usePreferencesStore';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const about = useAboutInfo();
  const [copiedVersion, setCopiedVersion] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyVersion = async () => {
    try {
      await navigator.clipboard.writeText(about.version);
      setCopiedVersion(true);
      setTimeout(() => setCopiedVersion(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleCopyDiagnosticInfo = async () => {
    const diagnosticText = [
      `Name: ${about.name}`,
      `Author: ${about.author}`,
      `Version: ${about.version}`,
      `Package Version: ${about.packageVersion}`,
      `Git Commit: ${about.gitCommit}`,
      `Architecture: ${about.arch}`,
      `Release Date: ${about.releaseDate}`,
      `Copyright: ${about.copyright}`,
      `License: ${about.license}`,
      `Platform / OS: ${about.os || (typeof navigator !== 'undefined' ? navigator.platform : 'unknown')}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(diagnosticText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        data-tauri-drag-region
        className="relative bg-[#181825] border border-[#313244] p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 cursor-default text-text overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1 text-subtext0 hover:text-text hover:bg-surface0 transition-colors cursor-pointer"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with AppLogo */}
        <div className="flex flex-col items-center text-center mt-1 mb-5">
          <AppLogo size="lg" className="mb-3.5" />
          <h2 data-tauri-drag-region className="text-xl font-bold tracking-tight text-text">
            {about.name}
          </h2>
          <p className="text-xs text-subtext0 font-medium tracking-wide mt-0.5">
            {about.tagline}
          </p>

          {/* Primary Version Badge */}
          <div className="mt-3 flex items-center gap-1.5 bg-[#11111b] border border-[#313244] px-2.5 py-1">
            <span className="text-[10px] text-subtext0 uppercase font-mono tracking-wider">Version</span>
            <code className="text-xs font-mono font-medium text-subtext0 px-1">
              {about.version}
            </code>
            <button
              type="button"
              onClick={handleCopyVersion}
              className="ml-1 p-0.5 text-subtext0 hover:text-text transition-colors cursor-pointer"
              title="Copy version string"
            >
              {copiedVersion ? (
                <span className="flex items-center gap-1 text-[10px] text-green font-mono">
                  <Check className="w-3 h-3 text-green" /> Copied
                </span>
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Detailed Metadata Grid */}
        <div className="bg-[#11111b]/80 border border-[#313244]/80 p-3.5 mb-4 text-xs space-y-2">
          {/* Author */}
          <div className="flex items-center justify-between py-0.5 border-b border-[#313244]/50 pb-1.5">
            <span className="text-subtext0 font-medium">Author</span>
            <span className="text-text font-semibold">{about.author}</span>
          </div>

          {/* Release Date */}
          <div className="flex items-center justify-between py-0.5 border-b border-[#313244]/50 pb-1.5">
            <span className="text-subtext0 font-medium">Release Date</span>
            <span className="font-mono text-text font-medium">{about.releaseDate}</span>
          </div>

          {/* Architecture & Git SHA */}
          <div className="flex items-center justify-between py-0.5 border-b border-[#313244]/50 pb-1.5">
            <span className="text-subtext0 font-medium">Architecture / Commit</span>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-surface0 px-1.5 py-0.5 text-[11px] text-subtext1">
                {about.arch}
              </span>
              <span className="font-mono text-subtext0 text-[11px]">
                {about.gitCommit}
              </span>
            </div>
          </div>

          {/* Copyright & License */}
          <div className="pt-0.5 text-center">
            <p className="text-[11px] text-subtext1 leading-relaxed">
              {about.copyright}
            </p>
          </div>
        </div>

        {/* Engine Description */}
        <p className="text-[11px] text-subtext0 text-center leading-relaxed mb-5 px-1">
          {about.description}
        </p>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#313244]/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyDiagnosticInfo}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface0 hover:bg-surface1 text-subtext1 hover:text-text text-xs transition-colors cursor-pointer"
              title="Copy system and version information"
            >
              {copiedAll ? (
                <>
                  <Check className="w-3 h-3 text-green" />
                  <span className="text-green font-medium">Copied Info</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Info</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                usePreferencesStore.getState().openPreferences('updates-check');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface0 hover:bg-surface1 text-subtext1 hover:text-text text-xs transition-colors cursor-pointer"
              title="Check for software updates in Preferences"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-blue" />
              <span>Check for Updates</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 bg-[#89b4fa] hover:bg-[#74a8f7] text-[#11111b] font-semibold text-xs transition-all shadow-md cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
