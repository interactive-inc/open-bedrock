import { HealthCheckupRepository } from "@/contexts/health-checkup/infrastructure/health-checkup-repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { HealthCheckup } from "@/contexts/health-checkup/domain/health-checkup.entity"
import type { Context } from "@/env"

/**
 * 健診・ストレスチェックの実施記録を作成する。結果は持たず実施情報のみ記録する。
 */
export class CreateHealthCheckup {
  constructor(private readonly c: Context) {}

  async run(props: {
    employeeId: number
    fiscalYear: number
    checkupKind: "regular" | "stress_check"
    conductedOn: string | null
    status: "scheduled" | "completed" | "declined"
    note: string | null
    createdAt: string
  }): Promise<HealthCheckup | ApplicationError> {
    const repository = new HealthCheckupRepository(this.c)

    const created = await repository.create(props)

    if (created instanceof Error) {
      return new UnexpectedError("failed to save health_checkup", { cause: created })
    }

    return created
  }
}
