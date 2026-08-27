import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedAnnouncement = {
  id: number
  title: string
  bodyMd: string
  publishedOn: string | null
  authorEmployeeId: EmployeeId
  status: string
  createdAt: string
}

export const seedAnnouncements: ReadonlyArray<SeedAnnouncement> = [
  {
    id: 1,
    title: "オフィス移転のお知らせ",
    bodyMd: "10階の新オフィスへ移転します。",
    publishedOn: "2026-02-01",
    authorEmployeeId: toWorkforceEmployeeId(1),
    status: "published",
    createdAt: "2026-02-01T09:00:00Z",
  },
  {
    id: 2,
    title: "夏季休暇のスケジュール",
    bodyMd: "夏季休暇は8月12日から16日までです。",
    publishedOn: "2026-06-15",
    authorEmployeeId: toWorkforceEmployeeId(1),
    status: "published",
    createdAt: "2026-06-15T09:00:00Z",
  },
  {
    id: 3,
    title: "下書き: 新経費規程",
    bodyMd: "近日改定予定の経費規程の詳細です。",
    publishedOn: null,
    authorEmployeeId: toWorkforceEmployeeId(1),
    status: "draft",
    createdAt: "2026-06-20T09:00:00Z",
  },
  {
    id: 4,
    title: "アーカイブ: 旧駐車場ルール",
    bodyMd: "現在は適用されない旧駐車場ルールです。",
    publishedOn: "2025-01-10",
    authorEmployeeId: toWorkforceEmployeeId(1),
    status: "archived",
    createdAt: "2025-01-10T09:00:00Z",
  },
]
