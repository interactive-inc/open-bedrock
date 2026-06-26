import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ThanksRedemptionRepository } from "@/infrastructure/thanks-points/thanks-redemption-repository"

/**
 * 受領残高（受領 thanks の合計 − 確定交換の合計）を参照する。
 */
export class ViewMyBalance {
  constructor(private readonly c: Context) {}

  async run(props: { employeeId: number }): Promise<number | ApplicationError> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    const balance = await redemptionRepository.getBalance(props.employeeId)

    if (balance instanceof Error) {
      return new UnexpectedError("failed to find balance", { cause: balance })
    }

    return balance
  }
}
