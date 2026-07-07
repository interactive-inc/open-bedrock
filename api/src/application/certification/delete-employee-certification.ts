import { EmployeeCertificationRepository } from "@/infrastructure/certification/employee-certification-repository"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"

/**
 * 従業員の資格保有記録を削除する。対象が無ければ not found を返す。
 */
export class DeleteEmployeeCertification {
  constructor(private readonly c: Context) {}

  async run(props: { id: number }): Promise<true | ApplicationError> {
    const repository = new EmployeeCertificationRepository(this.c)

    const deleted = await repository.delete(props.id)

    if (deleted instanceof Error) {
      return new UnexpectedError("failed to delete employee_certification", { cause: deleted })
    }

    if (deleted === null) {
      return new NotFoundError(
        "employee certification not found",
        "employee_certification_not_found",
      )
    }

    return true
  }
}
