import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context } from "@/env"
import { ThanksPointBalanceRepository } from "@/contexts/thanks/infrastructure/thanks-points/thanks-point-balance-repository"

/**
 * 受領残高（もらった点数の累積から交換で引かれた分を差し引いた残り）を参照する。
 * 送れる枠である当月原資は別概念であり ViewMyBudget が担う。ここは原資を一切参照しない。
 */
export class ViewMyBalance {
  constructor(private readonly c: Context) {}

  async run(props: { employeeId: number }): Promise<number | ApplicationError> {
    const balanceRepository = new ThanksPointBalanceRepository(this.c)

    const balance = await balanceRepository.getBalance(props.employeeId)

    if (balance instanceof Error) {
      return new UnexpectedError("failed to find balance", { cause: balance })
    }

    return balance
  }
}
