"use client"

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

type CommandEntry = {
  label: string
  href: string
  icon: LucideIcon
  group: string
  requiredPermission?: string
}

/**
 * サイドバーと同じメニュー構造をフラットリストに展開したもの。
 * ⌘K で表示するコマンド候補として使う。
 */
const commands: ReadonlyArray<CommandEntry> = [
  { label: "ホーム", href: "/", icon: LayoutDashboard, group: "ナビゲーション" },
  {
    label: "申請の承認",
    href: "/applications/inbox",
    icon: Inbox,
    group: "受信箱",
    requiredPermission: "application:approve",
  },
  {
    label: "経費の承認",
    href: "/expense/inbox",
    icon: Inbox,
    group: "受信箱",
    requiredPermission: "expense:approve",
  },
  {
    label: "休暇の承認",
    href: "/leave/inbox",
    icon: Inbox,
    group: "受信箱",
    requiredPermission: "leave:approve",
  },
  { label: "従業員一覧", href: "/employees", icon: Users, group: "人材" },
  {
    label: "従業員 新規登録",
    href: "/employees/new",
    icon: Users,
    group: "人材",
    requiredPermission: "employee:create",
  },
  { label: "組織", href: "/org", icon: GitBranch, group: "人材" },
  { label: "部署", href: "/org/departments", icon: GitBranch, group: "人材" },
  { label: "スキル一覧", href: "/skills", icon: Sparkles, group: "人材" },
  { label: "自分のスキル", href: "/skills/me", icon: Sparkles, group: "人材" },
  { label: "研修コース", href: "/training", icon: GraduationCap, group: "人材" },
  { label: "自分の受講", href: "/training/me", icon: GraduationCap, group: "人材" },
  { label: "マイキャリア", href: "/career", icon: Briefcase, group: "人材" },
  { label: "社内公募", href: "/career/postings", icon: Briefcase, group: "人材" },
  {
    label: "オンボーディング",
    href: "/onboarding",
    icon: ClipboardList,
    group: "人材",
    requiredPermission: "onboarding:manage",
  },
  { label: "自分のオンボーディング", href: "/onboarding/me", icon: ClipboardList, group: "人材" },
  { label: "目標一覧", href: "/goals", icon: Target, group: "業務" },
  { label: "目標 新規", href: "/goals/new", icon: Target, group: "業務" },
  { label: "評価サイクル", href: "/review", icon: ClipboardCheck, group: "業務" },
  { label: "自分の申請", href: "/applications", icon: FileText, group: "業務" },
  { label: "経費一覧", href: "/expense", icon: Coins, group: "業務" },
  { label: "経費 新規", href: "/expense/new", icon: Coins, group: "業務" },
  {
    label: "予算一覧",
    href: "/budgets",
    icon: Wallet,
    group: "業務",
    requiredPermission: "budget:manage",
  },
  { label: "休暇一覧", href: "/leave", icon: CalendarOff, group: "業務" },
  { label: "休暇 新規", href: "/leave/new", icon: CalendarOff, group: "業務" },
  { label: "自分の勤怠", href: "/attendance", icon: TimerReset, group: "業務" },
  {
    label: "全員の勤怠",
    href: "/attendance/all",
    icon: TimerReset,
    group: "業務",
    requiredPermission: "attendance:read:all",
  },
  { label: "自分のシフト", href: "/shift", icon: CalendarDays, group: "業務" },
  { label: "ナレッジ一覧", href: "/knowledge", icon: BookOpen, group: "コミュニケーション" },
  { label: "ナレッジ 新規", href: "/knowledge/new", icon: BookOpen, group: "コミュニケーション" },
  { label: "サーベイ", href: "/surveys", icon: MessagesSquare, group: "コミュニケーション" },
  { label: "1on1 履歴", href: "/oneonone", icon: CalendarClock, group: "コミュニケーション" },
  {
    label: "1on1 記録を追加",
    href: "/oneonone/new",
    icon: CalendarClock,
    group: "コミュニケーション",
  },
  {
    label: "感謝タイムライン",
    href: "/thanks",
    icon: HeartHandshake,
    group: "コミュニケーション",
  },
  { label: "感謝を送る", href: "/thanks/send", icon: HeartHandshake, group: "コミュニケーション" },
  { label: "会議室 空き状況", href: "/rooms", icon: DoorOpen, group: "リソース" },
  { label: "レンタル", href: "/rentals", icon: Package, group: "リソース" },
  { label: "備品一覧", href: "/assets", icon: Boxes, group: "リソース" },
  { label: "証明書依頼", href: "/certificate-requests", icon: ScrollText, group: "依頼" },
  { label: "出張一覧", href: "/business-trips", icon: Plane, group: "依頼" },
  { label: "出張 新規", href: "/business-trips/new", icon: Plane, group: "依頼" },
  { label: "介護休業", href: "/family-care-leaves", icon: HandHelping, group: "依頼" },
  { label: "ライフイベント", href: "/life-events", icon: PartyPopper, group: "依頼" },
  { label: "退職届", href: "/resignations", icon: UserMinus, group: "依頼" },
  { label: "反社チェック", href: "/antisocial-checks", icon: ShieldCheck, group: "依頼" },
  {
    label: "バッチ",
    href: "/batch",
    icon: Workflow,
    group: "システム",
    requiredPermission: "batch:view",
  },
  {
    label: "ロール管理",
    href: "/admin/roles",
    icon: KeyRound,
    group: "システム",
    requiredPermission: "iam:manage_roles",
  },
  {
    label: "アカウント管理",
    href: "/admin/accounts",
    icon: UserCog,
    group: "システム",
    requiredPermission: "account:manage",
  },
]

type Props = {
  permissions: ReadonlyArray<string>
}

/**
 * ⌘K（Ctrl+K）でどこからでも開けるグローバルコマンドパレット。
 * サイドバーと同じメニュー構造を検索し、Enter でページ遷移する。
 */
export function CommandPalette(props: Props) {
  const [open, setOpen] = useState(false)

  const router = useRouter()

  const permissionSet = new Set(props.permissions)

  const visibleCommands = commands.filter(
    (cmd) => cmd.requiredPermission === undefined || permissionSet.has(cmd.requiredPermission),
  )

  // グループ名の順序を維持しつつ重複排除
  const groups = [...new Set(visibleCommands.map((cmd) => cmd.group))]

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
                {visibleCommands
                  .filter((cmd) => cmd.group === group)
                  .map((cmd) => {
                    const Icon = cmd.icon

                    return (
                      <CommandItem key={cmd.href} onSelect={() => handleSelect(cmd.href)}>
                        <Icon className="mr-2 size-4 shrink-0" />
                        <span>{cmd.label}</span>
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
