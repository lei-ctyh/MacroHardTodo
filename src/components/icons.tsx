// 统一图标出口：Lucide（ISC 许可），线性风格与 Microsoft To Do 的 Fluent 图标接近。
// 若以后想换回 Fluent，只需改这一个文件。
import { Star, type LucideProps } from "lucide-react";

export {
  Plus as PlusIcon,
  Plus as PlusSmallIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Sun as SunIcon,
  Star as StarOutlineIcon,
  StarOff as StarOffIcon,
  Circle as CircleIcon,
  Calendar as CalendarIcon,
  Calendar1 as CalendarTodayIcon,
  CalendarPlus as CalendarPlusIcon,
  CalendarDays as CalendarDaysIcon,
  CalendarCheck as CalendarCheckIcon,
  CalendarRange as CalendarRangeIcon,
  CalendarArrowUp as CalendarArrowUpIcon,
  ListStart as MoveToListIcon,
  Clock as ClockIcon,
  ArrowRight as ArrowRightIcon,
  ChevronsRight as ChevronsRightIcon,
  Sparkles as SparklesIcon,
  House as HomeIcon,
  GripVertical as GripVerticalIcon,
  ListTodo as ListIcon,
  List as ListLinesIcon,
  SquareDashed as UngroupIcon,
  Infinity as AllIcon,
  CircleCheck as CompletedIcon,
  Check as CheckIcon,
  Check as CheckSmallIcon,
  X as CloseIcon,
  X as CloseSmallIcon,
  MoreHorizontal as MoreIcon,
  MoreVertical as MoreVerticalIcon,
  Menu as MenuIcon,
  Trash2 as TrashIcon,
  Paperclip as AttachIcon,
  Bell as BellIcon,
  Repeat as RepeatIcon,
  ChevronRight as ChevronRightIcon,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  ArrowUpDown as SortIcon,
  Copy as CopyIcon,
  Cloud as CloudIcon,
  RefreshCw as SyncIcon,
  RefreshCw as RefreshIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  FolderOpen as FolderIcon,
  Info as InfoIcon,
  AlertTriangle as WarningIcon,
  User as PersonIcon,
  Pencil as EditIcon,
  ArrowLeft as BackIcon,
  ExternalLink as OpenIcon,
  StickyNote as NoteIcon,
  Palette as PaletteIcon,
  ImagePlus as ImageIcon,
  Lightbulb as LightbulbIcon,
} from "lucide-react";

export function StarFilledIcon(props: LucideProps) {
  return <Star {...props} fill="currentColor" strokeWidth={1.5} />;
}

/**
 * 分组：圆角方框 + 左侧竖线（与新建组图标同一套形状，无加号）。
 */
export function GroupIcon(props: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 9v6" />
    </svg>
  );
}

/**
 * 创建新组：圆角方框 + 右上角加号 + 左侧竖线。
 * 原创线性图标，形状参考 Fluent 的“新建组”，不包含微软素材。
 */
export function NewGroupIcon(props: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
      <path d="M9 9v6" />
      <path d="M18 3v5" />
      <path d="M15.5 5.5h5" />
    </svg>
  );
}
