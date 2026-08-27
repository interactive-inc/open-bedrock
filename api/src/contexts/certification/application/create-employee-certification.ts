import { CertificationRepository } from "@/contexts/certification/infrastructure/repositories/certification.repository"
import { EmployeeCertificationRepository } from "@/contexts/certification/infrastructure/repositories/employee-certification.repository"
import { ConflictError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { EmployeeCertification } from "@/contexts/certification/domain/entities/employee-certification.entity"
import type { Context } from "@/env"

/**
 * 従業員の資格保有記録を作成する。資格マスタが存在しない場合は not found、
 * 同一従業員・資格・取得日の重複は conflict を返す。
 */
export class CreateEmployeeCertification {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(props: {
    employeeId: number
    certificationId: number
    acquiredOn: string
    expiresOn: string | null
    note: string | null
    createdAt: string
  }): Promise<EmployeeCertification | ApplicationError> {
    const certificationRepository = new CertificationRepository(this.c)

    const certification = await certificationRepository.findById(props.certificationId)

    if (certification instanceof Error) {
      return new UnexpectedError("failed to load certification", { cause: certification })
    }

    if (certification === null) {
      return new NotFoundError("certification not found", "certification_not_found")
    }

    const repository = new EmployeeCertificationRepository(this.c)

    const created = await repository.create(props)

    if (created instanceof Error) {
      return new UnexpectedError("failed to save employee_certification", { cause: created })
    }

    if (created === null) {
      return new ConflictError(
        "employee certification already recorded",
        "employee_certification_conflict",
      )
    }

    return created
  }
}
