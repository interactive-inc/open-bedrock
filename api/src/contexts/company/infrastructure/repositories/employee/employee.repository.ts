import { AlignAccountDisplayNameToEmployeeAdapter } from "@/contexts/company/infrastructure/adapters/account-profile/align-account-display-name-to-employee.adapter"
import { EmployeeEntity } from "@/contexts/company/domain/entities/employee.entity"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import { eq } from "drizzle-orm"

type Context = CompanyContext

type FindEmployeeProps =
  | Readonly<{ id: EmployeeId; code?: never }>
  | Readonly<{ code: string; id?: never }>

export class EmployeeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(props: FindEmployeeProps): Promise<EmployeeEntity | null | Error> {
    if (props.id !== undefined) {
      try {
        const row = (
          await this.c.var.database
            .select()
            .from(employees)
            .where(eq(employees.id, props.id))
            .limit(1)
        )[0]
        if (row === undefined) return null
        return EmployeeEntity.restore(row)
      } catch (cause) {
        return cause instanceof Error ? cause : new Error("failed to find Company employee")
      }
    }

    try {
      const row = (
        await this.c.var.database
          .select()
          .from(employees)
          .where(eq(employees.employeeCode, props.code))
          .limit(1)
      )[0]
      if (row === undefined) return null
      return EmployeeEntity.restore(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to find Company employee")
    }
  }

  async update(entity: EmployeeEntity, updatedAt: Date): Promise<EmployeeEntity | null | Error> {
    try {
      const props = entity.toProps()
      const database = this.c.var.database
      /**
       * 従業員に紐付いたアカウントは従業員氏名を正本にする。氏名の UPDATE と表示名の
       * 同期を同じ batch で確定させ、片方だけ新姓という中間状態を作らない。
       */
      const batchResults = await database.batch([
        database
          .update(employees)
          .set({
            officialName: props.officialName,
            email: props.email,
            phone: props.phone,
            updatedAt,
          })
          .where(eq(employees.id, props.id))
          .returning(),
        new AlignAccountDisplayNameToEmployeeAdapter(database).buildAlignment({
          employeeId: props.id,
          officialName: props.officialName,
          now: updatedAt,
        }),
      ])
      const row = batchResults[0][0]
      if (row === undefined) return null
      return EmployeeEntity.restore(row)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to update Company employee")
    }
  }
}
