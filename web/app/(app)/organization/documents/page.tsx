import { notFound } from "next/navigation"
import { FetchError } from "@/components/fetch-error"
import { Suspense } from "react"
import { DocumentRegisterForm } from "@/app/(app)/organization/documents/_components/document-register-form"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getMe } from "@/lib/api/get-me"
import { getDocumentList } from "@/lib/api/get-document-list"
import { canReadDocuments } from "@/lib/document/can-read-documents"
import { canManageDocuments } from "@/lib/document/can-manage-documents"

export const metadata = { title: "文書台帳" }

/** 文書台帳一覧画面。document:read:all が無い場合は notFound で存在を隠す。 */
export default async function DocumentsPage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canReadDocuments(currentUser.permissions) === false) {
    notFound()
  }

  const canManage = canManageDocuments(currentUser.permissions)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="文書台帳"
        description="契約書・許認可などの所在と期限を管理します（期限の近い順）。"
      />

      {canManage ? <DocumentRegisterForm /> : null}

      <Suspense fallback={<ListSkeleton rows={5} />}>
        <DocumentsTable />
      </Suspense>
    </div>
  )
}

/** /documents を取得して一覧テーブルを描画する非同期 RSC。 */
async function DocumentsTable() {
  const documents = await getDocumentList({ category: null })

  if (documents instanceof Error) {
    return <FetchError message="文書台帳の取得に失敗しました" />
  }

  if (documents.length === 0) {
    return <EmptyState title="文書はありません" />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="文書台帳一覧">
        <TableHeader>
          <TableRow>
            <TableHead>タイトル</TableHead>
            <TableHead>分類</TableHead>
            <TableHead>所在</TableHead>
            <TableHead>期限</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {documents.map((document) => (
            <TableRow key={document.id}>
              <TableCell className="font-medium">{document.title}</TableCell>

              <TableCell className="text-muted-foreground">{document.category ?? "-"}</TableCell>

              <TableCell className="text-muted-foreground">{document.location}</TableCell>

              <TableCell className="text-muted-foreground">{document.expires_on ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
