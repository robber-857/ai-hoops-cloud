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
  UserRound,
  Utensils,
  Video,
} from "lucide-react";
import { routes } from "@/lib/routes";

export const accountNavigationSections = [
  {
    label: "Workspace",
    items: [
      { href: routes.user.me, label: "Overview", icon: House, exact: true },
      { href: routes.user.assistant, label: "AI Coach", icon: Sparkles, exact: true },
      { href: routes.user.messages, label: "Notifications", icon: Bell, exact: true },
    ],
  },
  {
    label: "Training",
    items: [
      { href: routes.user.plans, label: "Training plans", icon: ClipboardList, exact: true },
      { href: routes.user.tasks, label: "Training tasks", icon: NotebookPen, exact: true },
      { href: routes.user.classReports, label: "Class reports", icon: GraduationCap, exact: false },
      { href: routes.user.classVideos, label: "Class videos", icon: Video, exact: true },
      { href: routes.foods, label: "Food nutrition", icon: Utensils, exact: false },
    ],
  },
  {
    label: "Progress",
    items: [
      { href: routes.user.reports, label: "Analysis reports", icon: FileChartColumn, exact: true },
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

export const accountNavigation = [
  ...accountNavigationSections.flatMap(({ items }) => items),
  profileNavigation,
];

export const trainingNavigation = [
  { href: routes.pose2d.shooting, label: "Shooting", icon: ScanLine },
  { href: routes.pose2d.dribbling, label: "Dribbling", icon: ScanLine },
  { href: routes.pose2d.training, label: "Training", icon: Dumbbell },
];
