import type { Context } from "@/env"
import { ThanksRedemptionRepository } from "@/infrastructure/thanks-points/thanks-redemption-repository"

// 受領残高（受領 thanks の合計 − 確定交換の合計）を参照する。
export class ViewMyBalance {
  constructor(private readonly c: Context) {}

  async run(props: { employeeId: number }): Promise<number | Error> {
    const redemptionRepository = new ThanksRedemptionRepository(this.c)

    return redemptionRepository.getBalance(props.employeeId)
  }
}
