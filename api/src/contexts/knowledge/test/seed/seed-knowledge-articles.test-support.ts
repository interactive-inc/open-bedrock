import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type SeedKnowledgeArticle = {
  id: number
  title: string
  category: string
  tags: string | null
  bodyMd: string
  authorId: EmployeeId
  createdAt: string
}

export const seedKnowledgeArticles: ReadonlyArray<SeedKnowledgeArticle> = [
  {
    id: 1,
    title: "リモートワーク規程",
    category: "規程",
    tags: "リモートワーク,勤怠,在宅勤務",
    bodyMd:
      "## リモートワーク規程\n\n週3日までリモートワークが可能です。事前にリモートワーク申請を提出してください。",
    authorId: toWorkforceEmployeeId(2),
    createdAt: "2026-01-05T00:00:00Z",
  },
  {
    id: 2,
    title: "経費精算手続き",
    category: "経理",
    tags: "経費,精算,立替",
    bodyMd:
      "## 経費精算\n\n領収書を添付し、立替経費は経費申請から提出してください。締め切りは毎月末日です。",
    authorId: toWorkforceEmployeeId(16),
    createdAt: "2026-01-10T00:00:00Z",
  },
  {
    id: 3,
    title: "オンボーディングガイド",
    category: "オンボーディング",
    tags: "オンボーディング,研修,新入社員",
    bodyMd:
      "## オンボーディング\n\n初日にアカウントを発行し、1週目に部署研修を行い、初月に1on1を実施します。",
    authorId: toWorkforceEmployeeId(3),
    createdAt: "2026-02-01T00:00:00Z",
  },
  {
    id: 4,
    title: "目標設定と評価",
    category: "評価",
    tags: "目標,評価,MBO",
    bodyMd:
      "## 目標設定\n\n半期ごとに目標を設定し、自己評価・上長評価・最終評価の3段階で評価します。",
    authorId: toWorkforceEmployeeId(2),
    createdAt: "2026-02-15T00:00:00Z",
  },
  {
    id: 5,
    title: "会議室予約ルール",
    category: "総務",
    tags: "会議室,予約,設備",
    bodyMd: "## 会議室予約\n\n会議室予約機能から予約してください。使用後は原状回復してください。",
    authorId: toWorkforceEmployeeId(16),
    createdAt: "2026-03-01T00:00:00Z",
  },
  {
    id: 6,
    title: "情報セキュリティ規程",
    category: "セキュリティ",
    tags: "セキュリティ,情報管理,コンプライアンス",
    bodyMd:
      "## 情報セキュリティ\n\n機密情報を社外に持ち出さず、パスワードは定期的に変更してください。",
    authorId: toWorkforceEmployeeId(1),
    createdAt: "2026-03-10T00:00:00Z",
  },
]
