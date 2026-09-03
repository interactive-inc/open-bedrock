import Link from "next/link"
import { Suspense } from "react"
import { SystemPermissionDefinitionSection } from "@/app/(app)/system/permission-definitions/_components/system-permission-definition-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { ReadOnlyNotice } from "@/components/read-only-notice"
import { requireAnyPermission } from "@/lib/auth/require-any-permission"

export const metadata = { title: "権限定義" }

/**
 * 権限キーのカタログ。ロールに割り当てられる技術的 permission の正本はコードの
 * PERMISSION_CATALOG で、ここはその読み取り。
 */
export default async function SystemPermissionDefinitionsPage() {
  // api の handler は system:admin か iam:write のどちらかを要求する。
  // iam:read では 403 になるので、nav と画面もこの 2 キーの OR に合わせる。
  await requireAnyPermission(["iam:write", "system:admin"])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="権限定義"
        description="ロールに割り当てられる権限キーの一覧です。無効な App の権限は出ません。"
      />

      <Link className="text-sm underline" href="/system/roles">
        ロールの一覧へ
      </Link>

      <Suspense fallback={<ListSkeleton rows={8} />}>
        <SystemPermissionDefinitionSection />
      </Suspense>

      <ReadOnlyNotice command={null} />
    </div>
  )
}
