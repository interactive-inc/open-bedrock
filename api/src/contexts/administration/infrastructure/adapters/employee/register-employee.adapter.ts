import type { Context } from "@/env"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { SystemRoleAdministrationRepository } from "@system/infrastructure/iam/system-role-administration.repository"

/** Employee登録時のSystem role参照とD1 transactionを隔離する。 */
export class RegisterEmployeeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findRole(key: string) {
    const roles = await new SystemRoleAdministrationRepository({
      env: { DB: this.c.env.DB },
    }).list()
    if (roles instanceof Error) return roles
    return roles.find((candidate) => candidate.key === key) ?? null
  }

  async organizationRevision(): Promise<number | Error> {
    try {
      return (
        (await this.c.env.DB.prepare(
          "SELECT revision FROM organization_lifecycle_states WHERE id = 1",
        ).first<number>("revision")) ?? 0
      )
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to load organization revision")
    }
  }

  async commit(
    statements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"created" | "forbidden" | "conflict" | Error> {
    try {
      await this.c.env.DB.batch([...statements])
      return "created"
    } catch (cause) {
      if (
        (cause instanceof Error && cause.message.includes("integer overflow")) ||
        isAbortedByGuard(cause)
      ) {
        return "forbidden"
      }
      if (cause instanceof Error && cause.message.includes("UNIQUE constraint")) {
        return "conflict"
      }
      return cause instanceof Error ? cause : new Error("failed to register employee")
    }
  }
}
