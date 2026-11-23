import {
  Bell,
  ClipboardList,
  Dumbbell,
  FileChartColumn,
  GraduationCap,
  House,
  LineChart,
  NotebookPen,
  ScanLine,
  Sparkles,
  Settings,
  UserRound,
  Utensils,
  Video,
} from "lucide-react";
import { routes } from "@/lib/routes";

const overview = { href: routes.user.me, label: "Overview", icon: House, exact: true };
const assistant = { href: routes.user.assistant, label: "AI Coach", icon: Sparkles, exact: true };
const tasks = { href: routes.user.tasks, label: "Training tasks", icon: NotebookPen, exact: true };
const reports = { href: routes.user.reports, label: "Analysis reports", icon: FileChartColumn, exact: true };

export const accountNavigationSections = [
  {
    label: "Workspace",
    items: [
      overview,
      assistant,
      { href: routes.user.messages, label: "Notifications", icon: Bell, exact: true },
    ],
  },
  {
    label: "Training",
    items: [
      { href: routes.user.plans, label: "Training plans", icon: ClipboardList, exact: true },
      tasks,
      { href: routes.user.classReports, label: "Class reports", icon: GraduationCap, exact: false },
      { href: routes.user.classVideos, label: "Class videos", icon: Video, exact: true },
      { href: routes.foods, label: "Food nutrition", icon: Utensils, exact: false },
    ],
  },
  {
    label: "Progress",
    items: [
      reports,
      { href: routes.user.trends, label: "Growth trends", icon: LineChart, exact: true },
    ],
  },
];

export const profileNavigation = {
  href: routes.user.profile,
  label: "Personal profile",
  icon: UserRound,
  exact: true,
};

export const settingsNavigation = { href: routes.settings, label: "Settings", icon: Settings, exact: true };

export const accountNavigation = [
  ...accountNavigationSections.flatMap(({ items }) => items),
  profileNavigation,
  settingsNavigation,
];

export const trainingNavigation = [
  { href: routes.pose2d.shooting, label: "Shooting", icon: ScanLine },
  { href: routes.pose2d.dribbling, label: "Dribbling", icon: ScanLine },
  { href: routes.pose2d.training, label: "Training", icon: Dumbbell },
];

export const mobileTabs = [
  overview,
  { ...tasks, label: "Tasks" },
  assistant,
  { ...reports, label: "Reports" },
];

export const mobileMenuSections = [
  { label: "Video analysis", items: trainingNavigation },
  ...accountNavigationSections.filter(section => section.label !== "Workspace").map(section => ({
    label: section.label,
    items: section.items.filter(item => !mobileTabs.some(tab => tab.href === item.href)),
  })),
  { label: "Account", items: [profileNavigation, settingsNavigation] },
];
