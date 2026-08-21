import type { Context } from "@/env"
import {
  loadLegacyLifecycleSnapshot,
  type LifecycleMigrationIssue,
} from "@/contexts/company/infrastructure/employee-lifecycle/load-legacy-lifecycle-snapshot.repository"
import { validateMigrationInput } from "@/contexts/company/domain/employee-lifecycle/validate-migration-input"
import { ApplicationError } from "@/lib/errors"

export type LifecycleMigrationPreflight = {
  baselineOn: string
  timeZone: string
  legacySourceFingerprint: string
  employeeCount: number
  departmentCount: number
  issues: ReadonlyArray<LifecycleMigrationIssue>
}

export class PreflightLifecycleMigration {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(props: {
    baselineOn: string
    timeZone: string
  }): Promise<LifecycleMigrationPreflight | ApplicationError> {
    const inputError = validateMigrationInput(this.c, props)
    if (inputError !== undefined) return inputError

    const snapshot = await loadLegacyLifecycleSnapshot(this.c)
    if (snapshot instanceof ApplicationError) return snapshot

    return {
      baselineOn: props.baselineOn,
      timeZone: props.timeZone,
      legacySourceFingerprint: snapshot.fingerprint,
      employeeCount: snapshot.employees.length,
      departmentCount: snapshot.departments.length,
      issues: snapshot.issues,
    }
  }
}
