import { Activity, Bot, Building2, CheckSquare, FileText, Home, ListTodo, Plug, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  en: string;
  icon: LucideIcon;
  badge?: "approvals";
}

export const NAV: NavItem[] = [
  { href: "/app", label: "ホーム", en: "Overview", icon: Home },
  { href: "/app/employees", label: "AI社員", en: "AI Employees", icon: Bot },
  { href: "/app/tasks", label: "タスク", en: "Tasks", icon: ListTodo },
  { href: "/app/approvals", label: "承認", en: "Approvals", icon: CheckSquare, badge: "approvals" },
  { href: "/app/reports", label: "レポート", en: "Reports", icon: FileText },
  { href: "/app/connections", label: "ツール連携", en: "Connections", icon: Plug },
  { href: "/app/activity", label: "アクティビティ", en: "Activity", icon: Activity },
  { href: "/app/company", label: "会社", en: "Company", icon: Building2 },
  { href: "/app/settings", label: "設定", en: "Settings", icon: Settings },
];

export const MOBILE_NAV = ["/app", "/app/employees", "/app/tasks", "/app/approvals"];
