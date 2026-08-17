import type {
  CompanyResource,
  CompanyResourceChange,
  CompanyResourceType,
} from "@/contexts/company/domain/core/company-resource"
import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"

export type CompanyResourceQuery = Readonly<{
  organizationId: string
  types: ReadonlyArray<CompanyResourceType>
  ids?: ReadonlyArray<string>
  effectiveOn?: CalendarDate
}>

export type CompanyResourceReadResult =
  | Readonly<{ ok: true; organizationRevision: number; resources: ReadonlyArray<CompanyResource> }>
  | Readonly<{ ok: false; cause: unknown }>

export type CompanyResourceWriteResult =
  | Readonly<{ kind: "applied"; organizationRevision: number; replayed: boolean }>
  | Readonly<{ kind: "conflict"; actualRevision: number }>
  | Readonly<{ kind: "command_conflict" }>
  | Readonly<{
      kind: "resource_conflict"
      type: CompanyResourceType
      id: string
      actualRevision: number
    }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

export interface CompanyResourceRepository {
  read(query: CompanyResourceQuery): Promise<CompanyResourceReadResult>
  write(change: CompanyResourceChange): Promise<CompanyResourceWriteResult>
}
