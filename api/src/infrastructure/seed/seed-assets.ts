type SeedAsset = {
  code: string
  name: string
  kind: string
  serial: string | null
  purchasedOn: string | null
  status: string
  holderEmployeeId: number | null
}

export const seedAssets: ReadonlyArray<SeedAsset> = [
  {
    code: "A0001",
    name: "Standard Laptop 14",
    kind: "pc",
    serial: "PF-X1-0001",
    purchasedOn: "2024-04-01",
    status: "lent",
    holderEmployeeId: 5,
  },
  {
    code: "A0002",
    name: "External Monitor 27inch",
    kind: "monitor",
    serial: "CN-D27-0002",
    purchasedOn: "2024-04-01",
    status: "lent",
    holderEmployeeId: 9,
  },
  {
    code: "A0003",
    name: "Performance Laptop 14",
    kind: "pc",
    serial: "C02-MBP-0003",
    purchasedOn: "2024-06-15",
    status: "in_stock",
    holderEmployeeId: null,
  },
  {
    code: "A0004",
    name: "Company Smartphone",
    kind: "mobile",
    serial: "IP-15-0004",
    purchasedOn: "2024-09-01",
    status: "in_stock",
    holderEmployeeId: null,
  },
  {
    code: "A0010",
    name: "Mesh Office Chair",
    kind: "furniture",
    serial: null,
    purchasedOn: null,
    status: "in_stock",
    holderEmployeeId: null,
  },
]
