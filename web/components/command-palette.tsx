"use client"

import type { PermissionKey } from "@/lib/api/types/permission-key"
import {
  BookOpen,
  Boxes,
  Briefcase,
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
  LayoutDashboard,
  type LucideIcon,
  MessagesSquare,
  Package,
  PartyPopper,
  Plane,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  UserCog,
  UserMinus,
  Users,
  Wallet,
  Workflow,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import {
  CommandDialog,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { canManageWorkflowRepairs } from "@/lib/application/can-manage-workflow-repairs"
import { canShowApplicationInboxCommand } from "@/lib/application/can-show-application-inbox-command"
import type { InboxCounts } from "@/lib/api/types/inbox-types"

type CommandEntry = {
  label: string
  href: string
  icon: LucideIcon
  group: string
  requiredPermission?: PermissionKey
  requiresWorkflowRepairAccess?: boolean
  workflowApplicationInbox?: boolean
}

/**
 * サイドバーと同じメニュー構造をフラットリストに展開したもの。
 * ⌘K で表示するコマンド候補として使う。
 */
const commands: ReadonlyArray<CommandEntry> = [
  { label: "ホーム", href: "/", icon: LayoutDashboard, group: "ナビゲーション" },
  {
    label: "申請の承認",
    href: "/inbox/applications",
    icon: Inbox,
    group: "受信箱",
    workflowApplicationInbox: true,
  },
  {
    label: "経費の承認",
    href: "/inbox/expenses",
    icon: Inbox,
    group: "受信箱",
    requiredPermission: "expense:approve",
  },
  {
    label: "休暇の承認",
    href: "/inbox/leaves",
    icon: Inbox,
    group: "受信箱",
    requiredPermission: "leave:approve",
  },
  { label: "従業員一覧", href: "/company/employees", icon: Users, group: "人材" },
  {
    label: "従業員 新規登録",
    href: "/company/employees/new",
    icon: Users,
    group: "人材",
    requiredPermission: "employee:create",
  },
  { label: "部署・組織図", href: "/company/departments", icon: GitBranch, group: "人材" },
  { label: "スキル一覧", href: "/skill/skills", icon: Sparkles, group: "人材" },
  { label: "自分のスキル", href: "/my/skills", icon: Sparkles, group: "人材" },
  { label: "研修コース", href: "/training/trainings", icon: GraduationCap, group: "人材" },
  { label: "自分の受講", href: "/my/trainings", icon: GraduationCap, group: "人材" },
  { label: "マイキャリア", href: "/my/career", icon: Briefcase, group: "人材" },
  { label: "社内公募", href: "/career/job-postings", icon: Briefcase, group: "人材" },
  {
    label: "オンボーディング",
    href: "/onboarding/onboarding-assignments",
    icon: ClipboardList,
    group: "人材",
    requiredPermission: "onboarding:manage",
  },
  {
    label: "自分のオンボーディング",
    href: "/my/onboarding-tasks",
    icon: ClipboardList,
    group: "人材",
  },
  { label: "目標一覧", href: "/performance-review/goals", icon: Target, group: "業務" },
  { label: "目標 新規", href: "/performance-review/goals/new", icon: Target, group: "業務" },
  { label: "評価サイクル", href: "/my/reviews", icon: ClipboardCheck, group: "業務" },
  { label: "自分の申請", href: "/my/applications", icon: FileText, group: "業務" },
  { label: "経費一覧", href: "/my/expenses", icon: Coins, group: "業務" },
  { label: "経費 新規", href: "/my/expenses/new", icon: Coins, group: "業務" },
  {
    label: "予算一覧",
    href: "/expense/budgets",
    icon: Wallet,
    group: "業務",
    requiredPermission: "budget:manage",
  },
  { label: "休暇一覧", href: "/my/leaves", icon: CalendarOff, group: "業務" },
  { label: "休暇 新規", href: "/my/leaves/new", icon: CalendarOff, group: "業務" },
  { label: "自分の勤怠", href: "/my/attendances", icon: TimerReset, group: "業務" },
  {
    label: "全員の勤怠",
    href: "/attendance/attendances",
    icon: TimerReset,
    group: "業務",
    requiredPermission: "attendance:read:all",
  },
  {
    label: "時間外の集計",
    href: "/attendance/attendances/overtime",
    icon: TimerReset,
    group: "業務",
  },
  { label: "自分のシフト", href: "/my/shifts", icon: CalendarDays, group: "業務" },
  {
    label: "ナレッジ一覧",
    href: "/knowledge/knowledge-articles",
    icon: BookOpen,
    group: "コミュニケーション",
  },
  {
    label: "ナレッジ 新規",
    href: "/knowledge/knowledge-articles/new",
    icon: BookOpen,
    group: "コミュニケーション",
  },
  {
    label: "サーベイ",
    href: "/survey/surveys",
    icon: MessagesSquare,
    group: "コミュニケーション",
  },
  {
    label: "自分の回答",
    href: "/my/survey-responses",
    icon: MessagesSquare,
    group: "コミュニケーション",
  },
  { label: "1on1 履歴", href: "/my/oneonones", icon: CalendarClock, group: "コミュニケーション" },
  {
    label: "1on1 記録を追加",
    href: "/my/oneonones/new",
    icon: CalendarClock,
    group: "コミュニケーション",
  },
  {
    label: "感謝タイムライン",
    href: "/thanks/thanks",
    icon: HeartHandshake,
    group: "コミュニケーション",
  },
  {
    label: "感謝を送る",
    href: "/thanks/thanks/send",
    icon: HeartHandshake,
    group: "コミュニケーション",
  },
  {
    label: "サンクス履歴",
    href: "/my/thanks",
    icon: HeartHandshake,
    group: "コミュニケーション",
  },
  {
    label: "規程・手続き",
    href: "/governance/governance-documents",
    icon: ShieldCheck,
    group: "ガバナンス",
    requiredPermission: "governance:read",
  },
  {
    label: "規程の整合性と組織ロール",
    href: "/governance/governance-documents/manage",
    icon: ShieldCheck,
    group: "ガバナンス",
    requiredPermission: "governance:manage",
  },
  { label: "会議室 空き状況", href: "/room/rooms", icon: DoorOpen, group: "リソース" },
  {
    label: "会議室マスタ",
    href: "/room/rooms/manage",
    icon: DoorOpen,
    group: "リソース",
    requiredPermission: "room:manage",
  },
  { label: "レンタル", href: "/my/rentals", icon: Package, group: "リソース" },
  { label: "備品一覧", href: "/asset/assets", icon: Boxes, group: "リソース" },
  {
    label: "棚卸し",
    href: "/asset/stocktakes",
    icon: Boxes,
    group: "リソース",
    requiredPermission: "asset:manage",
  },
  { label: "証明書依頼", href: "/my/certificate-requests", icon: ScrollText, group: "依頼" },
  { label: "出張一覧", href: "/my/business-trips", icon: Plane, group: "依頼" },
  { label: "出張 新規", href: "/my/business-trips/new", icon: Plane, group: "依頼" },
  { label: "休業", href: "/my/family-care-leaves", icon: HandHelping, group: "依頼" },
  { label: "ライフイベント", href: "/my/life-events", icon: PartyPopper, group: "依頼" },
  { label: "退職届", href: "/my/resignations", icon: UserMinus, group: "依頼" },
  { label: "反社チェック", href: "/my/antisocial-checks", icon: ShieldCheck, group: "依頼" },
  {
    label: "監査ログ",
    href: "/system/audit-events",
    icon: FileClock,
    group: "システム",
    requiredPermission: "audit:read",
  },
  {
    label: "承認フロー修復",
    href: "/system/workflow-repairs",
    icon: Workflow,
    group: "システム",
    requiresWorkflowRepairAccess: true,
  },
  {
    label: "バッチ",
    href: "/system/batches",
    icon: Workflow,
    group: "システム",
    requiredPermission: "batch:view",
  },
  {
    label: "ロール管理",
    href: "/system/roles",
    icon: KeyRound,
    group: "システム",
    requiredPermission: "iam:read",
  },
  {
    label: "アカウント管理",
    href: "/system/accounts",
    icon: UserCog,
    group: "システム",
    requiredPermission: "iam:read",
  },
]

type Props = {
  inboxCounts: InboxCounts
  permissions: ReadonlyArray<PermissionKey>
}

/**
 * ⌘K（Ctrl+K）でどこからでも開けるグローバルコマンドパレット。
 * サイドバーと同じメニュー構造を検索し、Enter でページ遷移する。
 */
export function CommandPalette(props: Props) {
  const [open, setOpen] = useState(false)

  const router = useRouter()

  const permissionSet = new Set(props.permissions)

  const visibleCommands = commands.filter((command) => {
    if (
      command.workflowApplicationInbox === true &&
      canShowApplicationInboxCommand(props.permissions, props.inboxCounts.applications) === false
    ) {
      return false
    }

    if (
      command.requiresWorkflowRepairAccess === true &&
      canManageWorkflowRepairs(props.permissions) === false
    ) {
      return false
    }

    return command.requiredPermission === undefined || permissionSet.has(command.requiredPermission)
  })

  // グループ名とコマンドの順序を維持しつつ、描画時の再フィルタを避ける。
  const commandsByGroup = new Map<string, Array<CommandEntry>>()

  for (const command of visibleCommands) {
    const grouped = commandsByGroup.get(command.group)

    if (grouped === undefined) {
      commandsByGroup.set(command.group, [command])
    } else {
      grouped.push(command)
    }
  }

  const groups = [...commandsByGroup.keys()]

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="コマンドパレット"
      description="メニューを検索してページに移動"
    >
      <Command>
        <CommandInput placeholder="ページを検索…" />

        <CommandList>
          <CommandEmpty>見つかりません</CommandEmpty>

          {groups.map((group, index) => (
            <div key={group}>
              {index > 0 ? <CommandSeparator /> : null}

              <CommandGroup heading={group}>
                {commandsByGroup.get(group)?.map((command) => {
                  const Icon = command.icon

                  return (
                    <CommandItem key={command.href} onSelect={() => handleSelect(command.href)}>
                      <Icon aria-hidden="true" />
                      <span>{command.label}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
