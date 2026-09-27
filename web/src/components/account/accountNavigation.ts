import { routes } from "@/lib/routes";

// Only expose working modules. Future camp modules join this list when ready.
export const accountNavigation = [
  { href: routes.user.me, label: "Overview", exact: true },
  { href: routes.user.plans, label: "Training plans", exact: true },
  { href: routes.user.tasks, label: "Training tasks", exact: true },
  { href: routes.user.reports, label: "Analysis reports", exact: true },
  { href: routes.user.trends, label: "Growth trends", exact: true },
  { href: routes.user.messages, label: "Messages", exact: true },
  { href: routes.user.profile, label: "Personal profile", exact: true },
];

export const trainingNavigation = [
  { href: routes.pose2d.shooting, label: "Shooting" },
  { href: routes.pose2d.dribbling, label: "Dribbling" },
  { href: routes.pose2d.training, label: "Training" },
];
