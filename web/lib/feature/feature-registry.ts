import {
  Award,
  Bell,
  BookOpen,
  BookOpenCheck,
  Boxes,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  ClipboardCheck,
  ClipboardList,
  Coins,
  DoorOpen,
  FileClock,
  FileText,
  GitBranch,
  GraduationCap,
  HandHelping,
  HeartHandshake,
  Inbox,
  KeyRound,
  Laptop,
  LayoutDashboard,
  MessagesSquare,
  Package,
  PartyPopper,
  Plane,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  TriangleAlert,
  UserCog,
  UserMinus,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import type {
  FeatureDefinition,
  FeatureGroup,
  FeatureNavigationVisibility,
  FeatureStatus,
  FeatureTier,
} from "@/lib/feature/feature-types";

const everyone: FeatureNavigationVisibility = { kind: "everyone" };

/**
 * 開発中はユーザ視点の利用レビューが完了していない機能を含む。
 */
export const featureRegistry: ReadonlyArray<FeatureDefinition> = [
  {
    slug: "dashboard",
    tier: "company",
    status: "available",
    group: "overview",
    icon: LayoutDashboard,
    prefetch: null,
    routes: [{ label: "ホーム", href: "/", visibility: everyone }],
  },
  {
    slug: "inbox",
    tier: "company",
    status: "available",
    group: "overview",
    icon: Inbox,
    prefetch: null,
    routes: [{ label: "受信箱", href: "/inbox", visibility: everyone }],
  },
  {
    slug: "notifications",
    tier: "system",
    status: "available",
    group: "overview",
    icon: Bell,
    prefetch: null,
    routes: [{ label: "通知", href: "/system/notifications", visibility: everyone }],
  },
  {
    slug: "attendance",
    tier: "app-default",
    status: "development",
    group: "time",
    icon: TimerReset,
    prefetch: null,
    routes: [
      { label: "勤怠", href: "/my/attendances", visibility: everyone },
      {
        label: "部署の勤怠",
        href: "/teams/:team/attendances",
        visibility: {
          kind: "any-permission",
          permissions: ["attendance:read:department", "attendance:read:all"],
        },
      },
      {
        label: "全社の勤怠",
        href: "/attendance/attendances",
        visibility: { kind: "permission", permission: "attendance:read:all" },
      },
      {
        label: "時間外の集計",
        href: "/attendance/attendances/overtime",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "leave",
    tier: "app-default",
    status: "development",
    group: "time",
    icon: CalendarOff,
    prefetch: null,
    routes: [
      { label: "休暇", href: "/my/leaves", visibility: everyone },
      {
        label: "部署の休暇",
        href: "/teams/:team/leaves",
        visibility: {
          kind: "any-permission",
          permissions: ["leave:read:department", "leave:read:all"],
        },
      },
      {
        label: "全社の休暇",
        href: "/leave/leaves",
        visibility: { kind: "permission", permission: "leave:read:all" },
      },
    ],
  },
  {
    slug: "shifts",
    tier: "app-default",
    status: "development",
    group: "time",
    icon: CalendarDays,
    prefetch: null,
    routes: [
      { label: "シフト", href: "/my/shifts", visibility: everyone },
      {
        label: "シフト割当",
        href: "/shift/shift-assignments",
        visibility: { kind: "permission", permission: "shift:manage" },
      },
      {
        label: "シフトパターン",
        href: "/shift/shift-patterns",
        visibility: { kind: "permission", permission: "shift:manage" },
      },
      {
        label: "シフト交代の横断",
        href: "/shift/shift-swaps",
        visibility: { kind: "permission", permission: "shift_swap:read:all" },
      },
    ],
  },
  {
    slug: "company-calendar",
    tier: "app-default",
    status: "development",
    group: "time",
    icon: CalendarDays,
    prefetch: null,
    routes: [
      {
        label: "カレンダー",
        href: "/company-calendar/calendars",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "applications",
    tier: "system",
    status: "available",
    group: "requests",
    icon: FileText,
    prefetch: null,
    routes: [
      { label: "申請", href: "/my/applications", visibility: everyone },
      {
        label: "部署の申請",
        href: "/teams/:team/applications",
        visibility: {
          kind: "any-permission",
          permissions: ["application:read:department", "application:read:all"],
        },
      },
      {
        label: "全社の申請",
        href: "/system/applications",
        visibility: { kind: "permission", permission: "application:read:all" },
      },
      {
        label: "申請テンプレート",
        href: "/system/application-templates",
        visibility: { kind: "permission", permission: "application_template:manage" },
      },
      {
        label: "ワークフロー修復",
        href: "/system/workflow-repairs",
        visibility: {
          kind: "all-permissions",
          permissions: ["application:read:all", "application_template:manage"],
        },
      },
    ],
  },
  {
    slug: "expenses",
    tier: "app-default",
    status: "development",
    group: "requests",
    icon: Coins,
    prefetch: null,
    routes: [
      { label: "経費", href: "/my/expenses", visibility: everyone },
      {
        label: "全社の経費",
        href: "/expense/expenses",
        visibility: { kind: "permission", permission: "expense:read:all" },
      },
    ],
  },
  {
    slug: "business-trips",
    tier: "app-default",
    status: "development",
    group: "requests",
    icon: Plane,
    prefetch: null,
    routes: [
      { label: "出張", href: "/my/business-trips", visibility: everyone },
      {
        label: "出張の横断",
        href: "/business-trip/business-trips",
        visibility: { kind: "permission", permission: "business_trip:read:all" },
      },
    ],
  },
  {
    slug: "certificate-requests",
    tier: "app-opt-in",
    status: "development",
    group: "requests",
    icon: ScrollText,
    prefetch: null,
    routes: [
      {
        label: "証明書",
        href: "/my/certificate-requests",
        visibility: everyone,
      },
      {
        label: "証明書の横断",
        href: "/certificate-request/certificate-requests",
        visibility: { kind: "permission", permission: "certificate_request:read:all" },
      },
    ],
  },
  {
    slug: "life-events",
    tier: "app-default",
    status: "development",
    group: "requests",
    icon: PartyPopper,
    prefetch: null,
    routes: [
      { label: "ライフイベント", href: "/my/life-events", visibility: everyone },
      {
        label: "ライフイベントの横断",
        href: "/life-event/life-events",
        visibility: { kind: "permission", permission: "life_event:read:all" },
      },
    ],
  },
  {
    slug: "family-care-leave",
    tier: "app-default",
    status: "development",
    group: "requests",
    icon: HandHelping,
    prefetch: null,
    routes: [
      {
        label: "休業",
        href: "/my/family-care-leaves",
        visibility: everyone,
      },
      {
        label: "休業の横断",
        href: "/family-care-leave/family-care-leaves",
        visibility: { kind: "permission", permission: "family_care_leave:read:all" },
      },
    ],
  },
  {
    slug: "resignations",
    tier: "app-opt-in",
    status: "development",
    group: "requests",
    icon: UserMinus,
    prefetch: null,
    routes: [
      { label: "退職", href: "/my/resignations", visibility: everyone },
      {
        label: "退職の横断",
        href: "/resignation/resignations",
        visibility: { kind: "permission", permission: "resignation:read:all" },
      },
    ],
  },
  {
    slug: "ringi",
    tier: "app-default",
    status: "development",
    group: "requests",
    icon: FileText,
    prefetch: null,
    routes: [
      { label: "稟議", href: "/my/ringis", visibility: everyone },
      {
        label: "稟議の横断",
        href: "/ringi/ringis",
        visibility: { kind: "permission", permission: "ringi:read:all" },
      },
    ],
  },
  {
    slug: "antisocial-checks",
    tier: "app-default",
    status: "development",
    group: "requests",
    icon: ShieldCheck,
    prefetch: null,
    routes: [
      {
        label: "反社チェック",
        href: "/my/antisocial-checks",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "approval-delegations",
    tier: "system",
    status: "development",
    group: "requests",
    icon: ClipboardCheck,
    prefetch: null,
    routes: [
      {
        label: "代理承認の設定",
        href: "/teams/approval-delegations",
        visibility: {
          kind: "any-permission",
          permissions: ["goal:read:reports", "attendance:read:reports", "leave:read:reports"],
        },
      },
    ],
  },
  {
    slug: "employees",
    tier: "company",
    status: "available",
    group: "people",
    icon: Users,
    prefetch: null,
    routes: [
      {
        label: "従業員",
        href: "/company/employees",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "departments",
    tier: "company",
    status: "available",
    group: "people",
    icon: GitBranch,
    prefetch: null,
    routes: [
      {
        label: "組織図",
        href: "/company/departments",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "team-management",
    tier: "company",
    status: "development",
    group: "people",
    icon: Users,
    prefetch: null,
    routes: [
      {
        label: "マイチーム",
        href: "/company/reports",
        visibility: {
          kind: "any-permission",
          permissions: ["goal:read:reports", "attendance:read:reports", "leave:read:reports"],
        },
      },
      {
        label: "メンバー",
        href: "/teams/:team/members",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "onboarding",
    tier: "app-opt-in",
    status: "development",
    group: "people",
    icon: ClipboardList,
    prefetch: null,
    routes: [
      {
        label: "オンボーディング",
        href: "/my/onboarding-tasks",
        visibility: everyone,
      },
      {
        label: "オンボーディング設計",
        href: "/onboarding/onboarding-templates",
        visibility: { kind: "permission", permission: "onboarding:manage" },
      },
      {
        label: "オンボーディング進捗",
        href: "/onboarding/onboarding-assignments",
        visibility: { kind: "permission", permission: "onboarding:view:all" },
      },
    ],
  },
  {
    slug: "recruitment",
    tier: "app-default",
    status: "development",
    group: "people",
    icon: Users,
    prefetch: null,
    routes: [
      {
        label: "採用",
        href: "/recruitment/recruitments",
        visibility: { kind: "permission", permission: "recruitment:manage" },
      },
    ],
  },
  {
    slug: "headcount-plans",
    tier: "app-default",
    status: "development",
    group: "people",
    icon: Users,
    prefetch: null,
    routes: [
      {
        label: "人員計画",
        href: "/headcount-plan/headcount-plans",
        visibility: { kind: "permission", permission: "headcount_plan:read:all" },
      },
    ],
  },
  {
    slug: "health-checkups",
    tier: "app-default",
    status: "development",
    group: "people",
    icon: ClipboardCheck,
    prefetch: null,
    routes: [
      {
        label: "健診の実施記録",
        href: "/health-checkup/health-checkups",
        visibility: { kind: "permission", permission: "health_checkup:read:all" },
      },
    ],
  },
  {
    slug: "work-accidents",
    tier: "app-default",
    status: "development",
    group: "people",
    icon: TriangleAlert,
    prefetch: null,
    routes: [
      {
        label: "労災・事故",
        href: "/work-accident/work-accidents",
        visibility: { kind: "permission", permission: "work_accident:read:all" },
      },
    ],
  },
  {
    slug: "grades",
    tier: "company",
    status: "development",
    group: "people",
    icon: Award,
    prefetch: null,
    routes: [
      {
        label: "等級",
        href: "/company/grades",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "positions",
    tier: "company",
    status: "development",
    group: "people",
    icon: Briefcase,
    prefetch: null,
    routes: [
      {
        label: "役職",
        href: "/company/positions",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "certifications",
    tier: "app-default",
    status: "development",
    group: "people",
    icon: Award,
    prefetch: null,
    routes: [
      {
        label: "資格・免許",
        href: "/certification/certifications",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "performance-reviews",
    tier: "app-opt-in",
    status: "development",
    group: "growth",
    icon: ClipboardCheck,
    prefetch: null,
    routes: [
      { label: "評価", href: "/my/reviews", visibility: everyone },
      {
        label: "評価サイクル",
        href: "/performance-review/review-cycles",
        visibility: { kind: "permission", permission: "review:administer" },
      },
      {
        label: "評価結果",
        href: "/performance-review/reviews",
        visibility: { kind: "permission", permission: "review:administer" },
      },
    ],
  },
  {
    slug: "goals",
    tier: "app-opt-in",
    status: "development",
    group: "growth",
    icon: Target,
    prefetch: null,
    routes: [
      {
        label: "部署の目標",
        href: "/teams/:team/goals",
        visibility: {
          kind: "any-permission",
          permissions: ["goal:read:department", "goal:read:all"],
        },
      },
      {
        label: "全社の目標",
        href: "/performance-review/goals",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "skills",
    tier: "app-opt-in",
    status: "development",
    group: "growth",
    icon: Sparkles,
    prefetch: null,
    routes: [
      { label: "スキル", href: "/my/skills", visibility: everyone },
      {
        label: "スキル一覧",
        href: "/skill/skills",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "career",
    tier: "app-opt-in",
    status: "development",
    group: "growth",
    icon: Briefcase,
    prefetch: null,
    routes: [
      { label: "キャリア", href: "/my/career", visibility: everyone },
      {
        label: "社内公募",
        href: "/career/job-postings",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "training",
    tier: "app-opt-in",
    status: "development",
    group: "growth",
    icon: GraduationCap,
    prefetch: null,
    routes: [
      { label: "研修", href: "/my/trainings", visibility: everyone },
      {
        label: "研修コース",
        href: "/training/trainings",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "one-on-ones",
    tier: "app-opt-in",
    status: "development",
    group: "growth",
    icon: CalendarClock,
    prefetch: null,
    routes: [
      { label: "1on1", href: "/my/oneonones", visibility: everyone },
      {
        label: "部署の1on1",
        href: "/teams/:team/oneonones",
        visibility: {
          kind: "any-permission",
          permissions: ["oneonone:read:department"],
        },
      },
    ],
  },
  {
    slug: "thanks",
    tier: "app-opt-in",
    status: "development",
    group: "growth",
    icon: HeartHandshake,
    prefetch: null,
    routes: [
      {
        label: "サンクス履歴",
        href: "/my/thanks",
        visibility: everyone,
      },
      {
        label: "サンクス",
        href: "/thanks/thanks",
        visibility: everyone,
      },
      {
        label: "景品",
        href: "/thanks/rewards",
        visibility: everyone,
      },
      {
        label: "サンクス交換の横断",
        href: "/thanks/thanks-redemptions",
        visibility: { kind: "permission", permission: "thanks_redemption:read:all" },
      },
    ],
  },
  {
    slug: "surveys",
    tier: "app-opt-in",
    status: "development",
    group: "growth",
    icon: MessagesSquare,
    prefetch: null,
    routes: [
      {
        label: "サーベイ",
        href: "/survey/surveys",
        visibility: everyone,
      },
      {
        label: "自分の回答",
        href: "/my/survey-responses",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "commendations",
    tier: "app-default",
    status: "development",
    group: "growth",
    icon: Award,
    prefetch: null,
    routes: [
      {
        label: "表彰",
        href: "/commendation/commendations",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "knowledge",
    tier: "app-opt-in",
    status: "development",
    group: "communication",
    icon: BookOpen,
    prefetch: null,
    routes: [
      {
        label: "ナレッジ",
        href: "/knowledge/knowledge-articles",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "announcements",
    tier: "app-opt-in",
    status: "development",
    group: "communication",
    icon: Bell,
    prefetch: null,
    routes: [
      {
        label: "アナウンス",
        href: "/announcement/announcements",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "regulations",
    tier: "app-opt-in",
    status: "development",
    group: "governance",
    icon: BookOpenCheck,
    prefetch: null,
    routes: [
      {
        label: "規程集",
        href: "/regulation/regulations",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "assets",
    tier: "app-default",
    status: "development",
    group: "workplace",
    icon: Boxes,
    prefetch: null,
    routes: [
      { label: "貸与品", href: "/my/assets", visibility: everyone },
      {
        label: "備品",
        href: "/asset/assets",
        visibility: everyone,
      },
      {
        label: "棚卸し",
        href: "/asset/stocktakes",
        visibility: { kind: "permission", permission: "asset:manage" },
      },
    ],
  },
  {
    slug: "rooms",
    tier: "app-default",
    status: "development",
    group: "workplace",
    icon: DoorOpen,
    prefetch: null,
    routes: [
      {
        label: "会議室の予約",
        href: "/my/room-reservations",
        visibility: everyone,
      },
      {
        label: "会議室",
        href: "/room/rooms",
        visibility: everyone,
      },
      {
        label: "会議室マスタ",
        href: "/room/rooms/manage",
        visibility: { kind: "permission", permission: "room:manage" },
      },
    ],
  },
  {
    slug: "rentals",
    tier: "app-default",
    status: "development",
    group: "workplace",
    icon: Package,
    prefetch: null,
    routes: [
      { label: "レンタル", href: "/my/rentals", visibility: everyone },
      {
        label: "レンタルの横断",
        href: "/rental/rentals",
        visibility: { kind: "permission", permission: "rental:read:all" },
      },
    ],
  },
  {
    slug: "meetings",
    tier: "app-default",
    status: "development",
    group: "governance",
    icon: CalendarDays,
    prefetch: null,
    routes: [
      {
        label: "会議体",
        href: "/meeting/meetings",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "decisions",
    tier: "app-default",
    status: "development",
    group: "governance",
    icon: BookOpenCheck,
    prefetch: null,
    routes: [
      {
        label: "意思決定記録",
        href: "/meeting/decisions",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "partners",
    tier: "app-default",
    status: "development",
    group: "governance",
    icon: Building2,
    prefetch: null,
    routes: [
      {
        label: "取引先",
        href: "/partner/partners",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "management-dashboard",
    tier: "app-opt-in",
    status: "retirement-candidate",
    group: "governance",
    icon: LayoutDashboard,
    prefetch: null,
    routes: [
      {
        label: "経営ダッシュボード",
        href: "/dashboards/management",
        visibility: { kind: "permission", permission: "management_dashboard:view" },
      },
    ],
  },
  {
    slug: "budgets",
    tier: "app-default",
    status: "development",
    group: "governance",
    icon: Wallet,
    prefetch: null,
    routes: [
      {
        label: "予算",
        href: "/expense/budgets",
        visibility: { kind: "permission", permission: "budget:manage" },
      },
    ],
  },
  {
    slug: "document-ledger",
    tier: "app-default",
    status: "development",
    group: "governance",
    icon: FileText,
    prefetch: null,
    routes: [
      {
        label: "文書台帳",
        href: "/document/documents",
        visibility: { kind: "permission", permission: "document:read:all" },
      },
    ],
  },
  {
    slug: "governance",
    tier: "app-opt-in",
    status: "development",
    group: "governance",
    icon: ShieldCheck,
    prefetch: null,
    routes: [
      {
        label: "規程・手続き",
        href: "/governance/governance-documents",
        visibility: { kind: "permission", permission: "governance:read" },
      },
    ],
  },
  {
    slug: "roles",
    tier: "system",
    status: "available",
    group: "system",
    icon: KeyRound,
    prefetch: null,
    routes: [
      {
        label: "ロール",
        href: "/system/roles",
        visibility: { kind: "permission", permission: "iam:read" },
      },
    ],
  },
  {
    slug: "accounts",
    tier: "system",
    status: "available",
    group: "system",
    icon: UserCog,
    prefetch: null,
    routes: [
      {
        label: "アカウント",
        href: "/system/accounts",
        visibility: { kind: "permission", permission: "iam:read" },
      },
    ],
  },
  {
    slug: "audit",
    tier: "system",
    status: "available",
    group: "system",
    icon: FileClock,
    prefetch: false,
    routes: [
      {
        label: "監査ログ",
        href: "/system/audit-events",
        visibility: { kind: "permission", permission: "audit:read" },
      },
    ],
  },
  {
    slug: "software-licenses",
    tier: "app-default",
    status: "development",
    group: "system",
    icon: Laptop,
    prefetch: null,
    routes: [
      {
        label: "ライセンス",
        href: "/software-license/licenses",
        visibility: { kind: "permission", permission: "license:read:all" },
      },
    ],
  },
  {
    slug: "it-incidents",
    tier: "app-default",
    status: "development",
    group: "system",
    icon: TriangleAlert,
    prefetch: null,
    routes: [
      {
        label: "IT インシデント",
        href: "/it-incident/it-incidents",
        visibility: { kind: "permission", permission: "it_incident:read:all" },
      },
    ],
  },
  {
    slug: "batches",
    tier: "system",
    status: "available",
    group: "system",
    icon: Wrench,
    prefetch: null,
    routes: [
      {
        label: "バッチ",
        href: "/system/batches",
        visibility: { kind: "permission", permission: "batch:view" },
      },
    ],
  },
];

export const featureGroupOrder: ReadonlyArray<FeatureGroup> = [
  "overview",
  "people",
  "time",
  "requests",
  "growth",
  "communication",
  "workplace",
  "governance",
  "system",
];

export const featureGroupLabels: Record<FeatureGroup, string> = {
  overview: "概要",
  people: "人と組織",
  time: "時間と予定",
  requests: "申請と手続き",
  growth: "成長と評価",
  communication: "情報共有",
  workplace: "資産と施設",
  governance: "経営と統制",
  system: "システム運用",
};

export const featureTierLabels: Record<FeatureTier, string> = {
  system: "システム層",
  company: "company",
  "app-default": "app-default",
  "app-opt-in": "app-opt-in",
};

export const featureStatusLabels: Record<FeatureStatus, string> = {
  available: "使用可能",
  development: "開発中",
  "retirement-candidate": "廃止候補",
};
