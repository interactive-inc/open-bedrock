type SeedContract = {
  id: string
  partnerId: string
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
    id: "0190001e-0000-7000-8000-000000000001",
    partnerId: "0190001d-0000-7000-8000-000000000001",
    title: "供給契約",
    contractDate: "2026-01-10",
    startsOn: "2026-02-01",
    endsOn: "2027-01-31",
    renewalDeadline: "2026-12-01",
    note: null,
    createdAt: "2026-01-10T09:00:00Z",
  },
  {
    id: "0190001e-0000-7000-8000-000000000002",
    partnerId: "0190001d-0000-7000-8000-000000000002",
    title: "基本売買契約",
    contractDate: "2026-01-12",
    startsOn: "2026-01-12",
    endsOn: null,
    renewalDeadline: null,
    note: null,
    createdAt: "2026-01-12T09:00:00Z",
  },
]
