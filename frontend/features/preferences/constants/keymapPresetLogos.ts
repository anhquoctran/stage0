import vscode from '../assets/keymap-logos/vscode.svg';
import intellij from '../assets/keymap-logos/intellij-idea.svg';
import githubDesktop from '../assets/keymap-logos/github-desktop.png';
import fork from '../assets/keymap-logos/fork.png';
import sourcetree from '../assets/keymap-logos/sourcetree.png';
import gitkraken from '../assets/keymap-logos/gitkraken.svg';

// Local, original-color assets; provenance and attribution are beside the files.
export const KEYMAP_PRESET_LOGOS: Record<string, string> = {
  vscode,
  jetbrains: intellij,
  'github-desktop': githubDesktop,
  fork,
  sourcetree,
  gitkraken,
};
