import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedAsset = {
  code: string
  name: string
  kind: string
  serial: string | null
  purchasedOn: string | null
  status: string
  holderEmployeeId: EmployeeId | null
  disposedOn: string | null
  disposalReason: string | null
}

export const seedAssets: ReadonlyArray<SeedAsset> = [
  {
    code: "A0001",
    name: "標準ノートPC 14インチ",
    kind: "pc",
    serial: "PF-X1-0001",
    purchasedOn: "2024-04-01",
    status: "lent",
    holderEmployeeId: toWorkforceEmployeeId(5),
    disposedOn: null,
    disposalReason: null,
  },
  {
    code: "A0002",
    name: "外付けモニター 27インチ",
    kind: "monitor",
    serial: "CN-D27-0002",
    purchasedOn: "2024-04-01",
    status: "lent",
    holderEmployeeId: toWorkforceEmployeeId(9),
    disposedOn: null,
    disposalReason: null,
  },
  {
    code: "A0003",
    name: "高性能ノートPC 14インチ",
    kind: "pc",
    serial: "C02-MBP-0003",
    purchasedOn: "2024-06-15",
    status: "in_stock",
    holderEmployeeId: null,
    disposedOn: null,
    disposalReason: null,
  },
  {
    code: "A0004",
    name: "貸与スマートフォン",
    kind: "mobile",
    serial: "IP-15-0004",
    purchasedOn: "2024-09-01",
    status: "in_stock",
    holderEmployeeId: null,
    disposedOn: null,
    disposalReason: null,
  },
  {
    code: "A0010",
    name: "メッシュオフィスチェア",
    kind: "furniture",
    serial: null,
    purchasedOn: null,
    status: "in_stock",
    holderEmployeeId: null,
    disposedOn: null,
    disposalReason: null,
  },
  {
    code: "A0011",
    name: "旧標準ノートPC 13インチ",
    kind: "pc",
    serial: "PF-X0-0011",
    purchasedOn: "2020-04-01",
    status: "disposed",
    holderEmployeeId: null,
    disposedOn: "2026-03-31",
    disposalReason: "経年劣化のため廃棄",
  },
]
