import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon, type FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import type { FC } from 'react';
import {
  faArrowDown,
  faArrowRotateLeft,
  faArrowRight,
  faArrowUp,
  faArrowUpRightFromSquare,
  faArrowsLeftRight,
  faArrowsRotate,
  faBold,
  faBolt,
  faBox,
  faBoxOpen,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCircleExclamation,
  faCircleHalfStroke,
  faCircleInfo,
  faClockRotateLeft,
  faCloudArrowDown,
  faCode,
  faCodeBranch,
  faCodeCommit,
  faCodeCompare,
  faCodeMerge,
  faCodePullRequest,
  faDesktop,
  faDownload,
  faEllipsis,
  faFileCircleExclamation,
  faFolderTree,
  faFolderMinus,
  faForwardStep,
  faGear,
  faGlobe,
  faHeading,
  faItalic,
  faKey,
  faLink,
  faList,
  faListOl,
  faLock,
  faMagnifyingGlass,
  faPaperPlane,
  faPalette,
  faPen,
  faPlay,
  faPlug,
  faPlus,
  faPowerOff,
  faQuoteLeft,
  faRobot,
  faRotate,
  faRotateLeft,
  faServer,
  faShield,
  faShieldHalved,
  faSpinner,
  faSun,
  faTableColumns,
  faTableList,
  faTag,
  faTerminal,
  faTextHeight,
  faTriangleExclamation,
  faUnderline,
  faUsers,
  faWandMagicSparkles,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import {
  faBell,
  faBookmark,
  faCircleCheck,
  faCircleXmark,
  faClock,
  faCopy,
  faEye,
  faEyeSlash,
  faFileCode,
  faFileLines,
  faFolder,
  faFolderOpen,
  faHardDrive,
  faKeyboard,
  faMessage,
  faMoon,
  faPenToSquare,
  faSquareCheck,
  faTrashCan,
  faUser,
} from '@fortawesome/free-regular-svg-icons';

type AppIconProps = Omit<FontAwesomeIconProps, 'icon'>;
type AppIconComponent = FC<AppIconProps>;

const createIcon = (icon: IconDefinition): AppIconComponent => {
  const AppIcon: AppIconComponent = (props) => <FontAwesomeIcon icon={icon} {...props} />;
  return AppIcon;
};

// Keep the existing semantic names at call sites while using Font Awesome Free glyphs.
export const AlertCircle = createIcon(faCircleExclamation);
export const AlertTriangle = createIcon(faTriangleExclamation);
export const ArrowDown = createIcon(faArrowDown);
export const Bell = createIcon(faBell);
export const ArrowLeftRight = createIcon(faArrowsLeftRight);
export const ArrowRight = createIcon(faArrowRight);
export const ArrowUp = createIcon(faArrowUp);
export const Bold = createIcon(faBold);
export const Bookmark = createIcon(faBookmark);
export const Bot = createIcon(faRobot);
export const Box = createIcon(faBox);
export const Cable = createIcon(faPlug);
export const Check = createIcon(faCheck);
export const CheckCircle2 = createIcon(faCircleCheck);
export const CheckSquare = createIcon(faSquareCheck);
export const ChevronDown = createIcon(faChevronDown);
export const ChevronLeft = createIcon(faChevronLeft);
export const ChevronRight = createIcon(faChevronRight);
export const ChevronUp = createIcon(faChevronUp);
export const Clock = createIcon(faClock);
export const Code = createIcon(faCode);
export const Code2 = createIcon(faCode);
export const Cog = createIcon(faGear);
export const Columns2 = createIcon(faTableColumns);
export const Copy = createIcon(faCopy);
export const Download = createIcon(faDownload);
export const DownloadCloud = createIcon(faCloudArrowDown);
export const Edit2 = createIcon(faPenToSquare);
export const Edit3 = createIcon(faPen);
export const ExternalLink = createIcon(faArrowUpRightFromSquare);
export const Eye = createIcon(faEye);
export const EyeOff = createIcon(faEyeSlash);
export const FileCode = createIcon(faFileCode);
export const FileJson = createIcon(faFileCode);
export const FileText = createIcon(faFileLines);
export const FileWarning = createIcon(faFileCircleExclamation);
export const Folder = createIcon(faFolder);
export const FolderCog = createIcon(faFolderOpen);
export const FolderDown = createIcon(faFolderOpen);
export const FolderGit2 = createIcon(faFolderTree);
export const FolderOpen = createIcon(faFolderOpen);
export const FolderTree = createIcon(faFolderTree);
export const FolderX = createIcon(faFolderMinus);
export const GitBranch = createIcon(faCodeBranch);
export const GitCommit = createIcon(faCodeCommit);
export const GitCompare = createIcon(faCodeCompare);
export const GitMerge = createIcon(faCodeMerge);
export const GitPullRequest = createIcon(faCodePullRequest);
export const Globe = createIcon(faGlobe);
export const HardDrive = createIcon(faHardDrive);
export const Heading = createIcon(faHeading);
export const History = createIcon(faClockRotateLeft);
export const Info = createIcon(faCircleInfo);
export const Italic = createIcon(faItalic);
export const Key = createIcon(faKey);
export const Keyboard = createIcon(faKeyboard);
export const Link = createIcon(faLink);
export const List = createIcon(faList);
export const ListOrdered = createIcon(faListOl);
export const Loader2 = createIcon(faSpinner);
export const Lock = createIcon(faLock);
export const MessageSquare = createIcon(faMessage);
export const Monitor = createIcon(faDesktop);
export const Moon = createIcon(faMoon);
export const MoreHorizontal = createIcon(faEllipsis);
export const Package = createIcon(faBoxOpen);
export const Palette = createIcon(faPalette);
export const PenLine = createIcon(faPen);
export const Play = createIcon(faPlay);
export const Plus = createIcon(faPlus);
export const Power = createIcon(faPowerOff);
export const Quote = createIcon(faQuoteLeft);
export const RefreshCw = createIcon(faArrowsRotate);
export const RotateCcw = createIcon(faRotateLeft);
export const RotateCw = createIcon(faRotate);
export const Rows2 = createIcon(faTableList);
export const Search = createIcon(faMagnifyingGlass);
export const Send = createIcon(faPaperPlane);
export const Server = createIcon(faServer);
export const Shield = createIcon(faShield);
export const ShieldAlert = createIcon(faShieldHalved);
export const ShieldCheck = createIcon(faShield);
export const SkipForward = createIcon(faForwardStep);
export const Sparkles = createIcon(faWandMagicSparkles);
export const SquareCode: FC<React.SVGProps<SVGSVGElement>> = ({ className = '', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`inline-block ${className}`}
    aria-hidden="true"
    {...props}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="m10 10-2 2 2 2" />
    <path d="m14 14 2-2-2-2" />
  </svg>
);
export const Sun = createIcon(faSun);
export const SunMoon = createIcon(faCircleHalfStroke);
export const Tag = createIcon(faTag);
export const Terminal = createIcon(faTerminal);
export const Trash2 = createIcon(faTrashCan);
export const Type = createIcon(faTextHeight);
export const Underline = createIcon(faUnderline);
export const Undo2 = createIcon(faArrowRotateLeft);
export const User = createIcon(faUser);
export const Users = createIcon(faUsers);
export const X = createIcon(faXmark);
export const XCircle = createIcon(faCircleXmark);
export const Zap = createIcon(faBolt);
