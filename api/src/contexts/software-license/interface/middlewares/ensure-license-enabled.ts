import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { SoftwareLicenseNotFoundError } from "@/contexts/software-license/interface/errors"

/** 台帳全体を停止した場合は読取・書込の両方を閉じる。 */
export const ensureLicenseEnabled = softwareLicenseFactory.createMiddleware(async (c, next) => {
  if (c.env.SOFTWARE_LICENSE_ENABLED !== undefined && c.env.SOFTWARE_LICENSE_ENABLED !== "true")
    throw new SoftwareLicenseNotFoundError()
  await next()
})
