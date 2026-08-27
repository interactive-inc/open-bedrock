import { EmployeeEventEntity } from "@/contexts/company/domain/entities/employee-event.entity"
import {
  CompanyForbiddenError,
  CompanyOperationError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { EmployeeEventRepository } from "@/contexts/company/infrastructure/repositories/employee-history/employee-event.repository"

type Context = Readonly<{ actor: CompanyActorValue; repository: EmployeeEventRepository }>

export class CreateEmployeeEvent {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    input: Omit<ReturnType<EmployeeEventEntity["toProps"]>, "id">,
  ): Promise<EmployeeEventEntity | CompanyOperationError> {
    if (!this.c.actor.hasPermission("employee:write:attributes")) return new CompanyForbiddenError()
    const created = await this.c.repository.create(EmployeeEventEntity.create(input))
    return created instanceof Error
      ? new CompanyUnexpectedError("failed to create Company employee event", { cause: created })
      : created
  }
}
