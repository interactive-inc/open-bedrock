import { FileCheck2, Search, Settings2 } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getGovernanceDocuments } from "@/lib/api/get-governance-documents"
import { requireAuth } from "@/lib/auth/require-auth"

export const metadata = { title: "規程・手続き" }

type Props = { searchParams: Promise<{ q?: string; kind?: string }> }

const kindLabels: Record<string, string> = {
  policy: "規程",
  procedure: "手続き",
  guideline: "ガイドライン",
  control: "統制",
}

const versionStateLabels: Record<string, string> = {
  draft: "下書き",
  in_review: "レビュー中",
  published: "公開中",
  superseded: "旧版",
  rejected: "差し戻し",
}

export default async function GovernancePage(props: Props) {
  const params = await props.searchParams
  const [me, result] = await Promise.all([
    requireAuth(),
    getGovernanceDocuments({ q: params.q, kind: params.kind }),
  ])
  if (result instanceof Error) throw result
  const canManage = me.permissions.includes("governance:manage")

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="規程・手続き"
        description="文章、責任者、適用対象、実行手順をひとつの原本として管理します。"
        actions={
          canManage ? (
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/governance/manage" />}
            >
              <Settings2 />
              整合性と組織ロール
            </Button>
          ) : undefined
        }
      />

      <form
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_12rem_auto]"
        role="search"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={params.q}
            placeholder="タイトル・本文を検索"
            className="pl-9"
            aria-label="規程・手続きを検索"
          />
        </div>
        <select
          name="kind"
          defaultValue={params.kind ?? ""}
          className="h-9 rounded-4xl border border-input bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="文書種別"
        >
          <option value="">すべての種別</option>
          <option value="policy">規程</option>
          <option value="procedure">手続き</option>
          <option value="guideline">ガイドライン</option>
          <option value="control">統制</option>
        </select>
        <Button type="submit">絞り込む</Button>
      </form>

      {result.data.length === 0 ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
          <FileCheck2 className="size-8 text-muted-foreground" />
          <p className="font-medium">表示できる文書がありません</p>
          <p className="text-sm text-muted-foreground">
            検索条件または公開状態・適用対象を確認してください。
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {result.data.map((document) => (
            <Card key={document.code} size="sm">
              <CardHeader>
                <CardTitle>
                  <Link
                    href={`/governance/${document.code}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {document.title}
                  </Link>
                </CardTitle>
                <CardDescription>{document.code}</CardDescription>
                <CardAction className="flex gap-1">
                  <Badge variant="outline">{kindLabels[document.kind] ?? document.kind}</Badge>
                  <VersionStateBadge state={document.version_state} />
                </CardAction>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Meta label="版" value={document.version} />
                <Meta label="主管能力" value={document.owner_capability} />
                <Meta label="見直し期限" value={document.review_due_on ?? "未設定"} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Meta(props: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className="mt-0.5 truncate font-medium">{props.value}</p>
    </div>
  )
}

function VersionStateBadge(props: { state: string }) {
  return (
    <Badge variant={props.state === "published" ? "default" : "secondary"}>
      {versionStateLabels[props.state] ?? props.state}
    </Badge>
  )
}
