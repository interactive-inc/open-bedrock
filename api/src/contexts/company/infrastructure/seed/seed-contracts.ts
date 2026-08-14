type SeedContract = {
  id: number
  partnerId: number
  title: string
  contractDate: string
  startsOn: string | null
  endsOn: string | null
  renewalDeadline: string | null
  note: string | null
  createdAt: string
}

export const seedContracts: ReadonlyArray<SeedContract> = [
  {
    id: 1,
    partnerId: 1,
    title: "供給契約",
    contractDate: "2026-01-10",
    startsOn: "2026-02-01",
    endsOn: "2027-01-31",
    renewalDeadline: "2026-12-01",
    note: null,
    createdAt: "2026-01-10T09:00:00Z",
  },
  {
    id: 2,
    partnerId: 2,
    title: "基本売買契約",
    contractDate: "2026-01-12",
    startsOn: "2026-01-12",
    endsOn: null,
    renewalDeadline: null,
    note: null,
    createdAt: "2026-01-12T09:00:00Z",
  },
]
