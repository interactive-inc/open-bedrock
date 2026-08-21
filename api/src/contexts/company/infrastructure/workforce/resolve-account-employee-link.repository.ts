import type { AccountEmployeeLink } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type {
  EmployeeId,
  SystemAccountId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { AccountEmployeeLinkResolutionError } from "@/contexts/company/domain/errors"

export type AccountEmployeeLinkQuery =
  | Readonly<{ kind: "by_account"; accountId: SystemAccountId }>
  | Readonly<{ kind: "by_employee"; employeeId: EmployeeId }>

export type AccountEmployeeLinkRecord = Readonly<{
  link: AccountEmployeeLink
  accountEligible: boolean
}>

export type AccountEmployeeLinkReadPortResult =
  | Readonly<{ ok: true; records: ReadonlyArray<AccountEmployeeLinkRecord> }>
  | Readonly<{ ok: false; cause: unknown }>

export type AccountEmployeeLinkReadPort = {
  find(query: AccountEmployeeLinkQuery): Promise<AccountEmployeeLinkReadPortResult>
}

export type ResolveAccountEmployeeLinkResult =
  | Readonly<{ kind: "found"; link: AccountEmployeeLink }>
  | Readonly<{ kind: "not_found" }>
  | Readonly<{ kind: "ineligible" }>
  | Readonly<{ kind: "invalid_link"; error: AccountEmployeeLinkResolutionError }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

/**
 * Company が所有する Account と Employee の対応を一意に解決し、System が提供する
 * Account eligibility も同じ読取境界で検査する。評価不能時は対応を推測しない。
 */
export class ResolveAccountEmployeeLink {
  constructor(private readonly port: AccountEmployeeLinkReadPort) {
    Object.freeze(this)
  }

  async execute(query: AccountEmployeeLinkQuery): Promise<ResolveAccountEmployeeLinkResult> {
    let loaded: AccountEmployeeLinkReadPortResult
    try {
      loaded = await this.port.find(query)
    } catch (cause) {
      return { kind: "unavailable", cause }
    }

    if (!loaded.ok) return { kind: "unavailable", cause: loaded.cause }
    if (loaded.records.length === 0) return { kind: "not_found" }
    if (loaded.records.length !== 1) {
      return {
        kind: "invalid_link",
        error: new AccountEmployeeLinkResolutionError("account_link_ambiguous"),
      }
    }

    const record = loaded.records[0]!
    if (query.kind === "by_account" && record.link.accountId !== query.accountId) {
      return {
        kind: "invalid_link",
        error: new AccountEmployeeLinkResolutionError("account_link_account_mismatch"),
      }
    }
    if (query.kind === "by_employee" && record.link.employeeId !== query.employeeId) {
      return {
        kind: "invalid_link",
        error: new AccountEmployeeLinkResolutionError("account_link_employee_mismatch"),
      }
    }
    if (!record.accountEligible) return { kind: "ineligible" }

    return { kind: "found", link: record.link }
  }
}
