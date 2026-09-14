import type {
  FeatureDefinition,
  FeatureGroup,
  FeatureNavigationVisibility,
  FeatureStatus,
  FeatureTier,
} from "@/lib/feature/feature-types"
import {
  Activity,
  ArrowLeftRight,
  Award,
  Bell,
  BookOpen,
  BookOpenCheck,
  Bot,
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
  MailWarning,
  MessagesSquare,
  Package,
  PartyPopper,
  Plane,
  Plug,
  ScrollText,
  Send,
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
} from "lucide-react"

const everyone: FeatureNavigationVisibility = { kind: "everyone" }

/**
 * Company の読み取り route が要求する権限。
 * api の companyActor middleware がこの 3 つの OR から company:read capability を導出するので、
 * nav もそれに合わせる（片方だけを条件にすると web と api で見え方が食い違う）。
 */
const companyReadVisibility: FeatureNavigationVisibility = {
  kind: "any-permission",
  permissions: ["employee:read", "org:manage", "system:admin"],
}

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
    routes: [],
  },
  {
    slug: "inbox",
    tier: "system",
    status: "available",
    group: "overview",
    icon: Inbox,
    prefetch: null,
    routes: [{ label: "承認・確認待ち", href: "/inbox", visibility: everyone }],
  },
  {
    slug: "notifications",
    tier: "system",
    status: "available",
    group: "overview",
    icon: Bell,
    prefetch: null,
    routes: [
      {
        label: "通知送信",
        href: "/notifications/new",
        visibility: { kind: "permission", permission: "notification:send" },
      },
    ],
  },
  {
    slug: "attendance",
    tier: "app-default",
    status: "development",
    group: "time",
    icon: TimerReset,
    prefetch: null,
    routes: [
      {
        label: "勤怠記録",
        href: "/attendance/attendances",
        visibility: { kind: "permission", permission: "attendance:read:all" },
      },
      {
        label: "時間外労働集計",
        href: "/overtime-summary",
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
      {
        label: "休暇申請",
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
        label: "シフト交代申請",
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
        label: "会社カレンダー",
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
      {
        label: "申請一覧",
        href: "/applications",
        visibility: { kind: "permission", permission: "application:read:all" },
      },
      {
        label: "申請テンプレート",
        href: "/application-templates",
        visibility: { kind: "permission", permission: "application_template:manage" },
      },
      {
        label: "承認経路の修復",
        href: "/workflow-repairs",
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
      {
        label: "経費申請",
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
      {
        label: "出張申請",
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
        label: "証明書発行申請",
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
      {
        label: "身上変更届",
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
        label: "休業申請",
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
      {
        label: "退職届",
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
      {
        label: "稟議申請",
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
    routes: [],
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
        label: "承認の委任",
        href: "/approval-delegations",
        visibility: {
          kind: "any-permission",
          permissions: ["goal:read:reports", "attendance:read:reports", "leave:read:reports"],
        },
      },
    ],
  },
  {
    slug: "company-profile",
    tier: "company",
    status: "development",
    group: "company-legal-entity",
    icon: Building2,
    prefetch: null,
    routes: [
      {
        label: "会社と法人",
        href: "/company/profile",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "employees",
    tier: "company",
    status: "available",
    group: "company-people",
    icon: Users,
    prefetch: null,
    routes: [
      {
        label: "従業員一覧",
        href: "/company/employee-directory",
        visibility: everyone,
      },
    ],
  },
  {
    slug: "company-people",
    tier: "company",
    status: "development",
    group: "company-people",
    icon: Users,
    prefetch: null,
    routes: [
      {
        label: "人物台帳",
        href: "/company/people",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "company-employments",
    tier: "company",
    status: "development",
    group: "company-people",
    icon: BookOpenCheck,
    prefetch: null,
    routes: [
      {
        label: "雇用情報",
        href: "/company/employments",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "departments",
    tier: "company",
    status: "available",
    group: "company-organization",
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
    slug: "company-organization-snapshots",
    tier: "company",
    status: "development",
    group: "company-organization",
    icon: FileClock,
    prefetch: null,
    routes: [
      {
        label: "所属・報告関係・責任割当",
        href: "/company/organization-snapshots",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "company-definitions",
    tier: "company",
    status: "development",
    group: "company-responsibility",
    icon: ScrollText,
    prefetch: null,
    routes: [
      {
        label: "職務・責任の定義",
        href: "/company/definitions",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "company-account-employee-links",
    tier: "company",
    status: "development",
    group: "company-system-link",
    icon: KeyRound,
    prefetch: null,
    routes: [
      {
        label: "アカウントと従業員の紐付け",
        href: "/company/account-employee-links",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "company-personnel-actions",
    tier: "company",
    status: "development",
    group: "company-employment-fact",
    icon: UserCog,
    prefetch: null,
    routes: [
      {
        label: "人事発令",
        href: "/company/personnel-actions",
        visibility: { kind: "any-permission", permissions: ["employee:read", "system:admin"] },
      },
    ],
  },
  {
    slug: "company-employee-events",
    tier: "company",
    status: "development",
    group: "company-employment-fact",
    icon: FileClock,
    prefetch: null,
    routes: [
      {
        label: "雇用の変更履歴",
        href: "/company/employee-events",
        visibility: companyReadVisibility,
      },
    ],
  },
  {
    slug: "direct-reports",
    tier: "company",
    status: "development",
    group: "team",
    icon: Users,
    prefetch: null,
    routes: [],
  },
  {
    slug: "team-management",
    tier: "company",
    status: "development",
    group: "people",
    icon: Users,
    prefetch: null,
    routes: [],
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
        label: "入社手続きテンプレート",
        href: "/onboarding/onboarding-templates",
        visibility: { kind: "permission", permission: "onboarding:manage" },
      },
      {
        label: "入社手続きの進捗",
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
        label: "採用選考",
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
        label: "健康診断記録",
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
        label: "労災・事故報告",
        href: "/work-accident/work-accidents",
        visibility: { kind: "permission", permission: "work_accident:read:all" },
      },
    ],
  },
  {
    slug: "grades",
    tier: "company",
    status: "development",
    group: "company-responsibility",
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
    group: "company-responsibility",
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
        label: "目標管理",
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
      {
        label: "スキル",
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
    routes: [],
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
        label: "サンクス",
        href: "/thanks/thanks",
        visibility: everyone,
      },
      {
        label: "交換景品",
        href: "/thanks/rewards/manage",
        visibility: { kind: "permission", permission: "thanks_reward:manage" },
      },
      {
        label: "ポイント交換申請",
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
        label: "アンケート",
        href: "/survey/surveys",
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
        label: "ナレッジ記事",
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
        label: "お知らせ",
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
      {
        label: "備品台帳",
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
        label: "会議室予約",
        href: "/room/rooms",
        visibility: everyone,
      },
      {
        label: "会議室設定",
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
      {
        label: "貸出予約",
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
        label: "会議",
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
        label: "予算管理",
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
    group: "system-authorization",
    icon: KeyRound,
    prefetch: null,
    routes: [
      {
        label: "権限ロール",
        href: "/system/roles",
        visibility: { kind: "permission", permission: "iam:read" },
      },
    ],
  },
  {
    slug: "permission-definitions",
    tier: "system",
    status: "available",
    group: "system-authorization",
    icon: ShieldCheck,
    prefetch: null,
    routes: [
      {
        label: "権限カタログ",
        href: "/permission-definitions",
        // api の handler は system:admin か iam:write のどちらかを要求する。
        // iam:read では 403 になるので、nav もこの 2 キーの OR に合わせる。
        visibility: { kind: "any-permission", permissions: ["iam:write", "system:admin"] },
      },
    ],
  },
  {
    slug: "accounts",
    tier: "system",
    status: "available",
    group: "system-principal",
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
    slug: "principals",
    tier: "system",
    status: "available",
    group: "system-principal",
    icon: Bot,
    prefetch: null,
    routes: [
      {
        label: "認証主体",
        href: "/system/principals",
        visibility: { kind: "permission", permission: "iam:read" },
      },
    ],
  },
  {
    slug: "audit",
    tier: "system",
    status: "available",
    group: "system-record",
    icon: FileClock,
    prefetch: false,
    routes: [
      {
        label: "監査ログ",
        href: "/audit-events",
        visibility: { kind: "permission", permission: "audit:read" },
      },
    ],
  },
  {
    slug: "deliveries",
    tier: "system",
    status: "available",
    group: "system-async",
    icon: Send,
    prefetch: null,
    routes: [
      {
        label: "ジョブと送信キュー",
        href: "/system/deliveries",
        visibility: { kind: "permission", permission: "batch:view" },
      },
    ],
  },
  {
    slug: "dead-letters",
    tier: "system",
    status: "available",
    group: "system-async",
    icon: MailWarning,
    prefetch: null,
    routes: [
      {
        label: "配信失敗",
        href: "/system/dead-letters",
        visibility: { kind: "permission", permission: "batch:view" },
      },
    ],
  },
  {
    slug: "connectors",
    tier: "system",
    status: "available",
    group: "system-integration",
    icon: Plug,
    prefetch: null,
    routes: [
      {
        // api の route は integration:read を要求するが、このキーは権限カタログに無く
        // ロールから付与できない。実際に到達できるのは system:admin だけなので、
        // nav も system:admin にする（integration:read だと誰にも出ない）。
        label: "外部接続設定",
        href: "/system/connectors",
        visibility: { kind: "permission", permission: "system:admin" },
      },
    ],
  },
  {
    slug: "integration-exchanges",
    tier: "system",
    status: "available",
    group: "system-integration",
    icon: ArrowLeftRight,
    prefetch: null,
    routes: [
      {
        label: "外部連携記録",
        href: "/system/integration-exchanges",
        visibility: { kind: "permission", permission: "system:admin" },
      },
    ],
  },
  {
    slug: "health",
    tier: "system",
    status: "available",
    group: "system-operation",
    icon: Activity,
    prefetch: null,
    routes: [
      {
        // api の route は未認証で到達できるが、システムタブは運用者の空間なので
        // 画面と nav は system:admin に絞る。
        label: "稼働状況",
        href: "/system/health",
        visibility: { kind: "permission", permission: "system:admin" },
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
        label: "ソフトウェアライセンス",
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
        label: "IT障害・事故",
        href: "/it-incident/it-incidents",
        visibility: { kind: "permission", permission: "it_incident:read:all" },
      },
    ],
  },
  {
    slug: "batches",
    tier: "system",
    status: "available",
    group: "system-async",
    icon: Wrench,
    prefetch: null,
    routes: [
      {
        label: "バッチ実行履歴",
        href: "/system/batches",
        visibility: { kind: "permission", permission: "batch:view" },
      },
    ],
  },
]

export const featureGroupOrder: ReadonlyArray<FeatureGroup> = [
  "overview",
  "team",
  "system-principal",
  "system-authorization",
  "system-case",
  "cross-context",
  "system-record",
  "system-async",
  "system-integration",
  "system-operation",
  "company-legal-entity",
  "company-people",
  "company-organization",
  "company-responsibility",
  "company-system-link",
  "company-employment-fact",
  "company-data-transition",
  "company-operation",
  "people",
  "time",
  "requests",
  "growth",
  "communication",
  "workplace",
  "governance",
  "system",
]

export const featureGroupLabels: Record<FeatureGroup, string> = {
  overview: "ホーム",
  "company-data-transition": "データ移行",
  "company-operation": "会社の運用",
  team: "部署",
  "system-principal": "アカウントと認証",
  "system-authorization": "権限と認可",
  "system-case": "作業と承認",
  "cross-context": "横断管理",
  "system-record": "監査と証拠",
  "system-async": "通知とバックグラウンド処理",
  "system-integration": "外部接続",
  "system-operation": "運用",
  "company-legal-entity": "会社と法人",
  "company-people": "人と雇用",
  "company-organization": "組織",
  "company-responsibility": "職務と責任",
  "company-system-link": "アカウントとの連携",
  "company-employment-fact": "雇用事実と人事発令",
  people: "人と組織",
  time: "時間と予定",
  requests: "申請と手続き",
  growth: "成長と評価",
  communication: "情報共有",
  workplace: "資産と施設",
  governance: "経営と統制",
  system: "システム運用",
}

export const featureTierLabels: Record<FeatureTier, string> = {
  system: "システム層",
  company: "company",
  "app-default": "app-default",
  "app-opt-in": "app-opt-in",
}

export const featureStatusLabels: Record<FeatureStatus, string> = {
  available: "使用可能",
  development: "開発中",
  "retirement-candidate": "廃止候補",
}
