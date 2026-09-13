import { createLicensePreservationSubmissionHandlers } from "@/contexts/software-license/interface/operations/create-license-preservation-submission-handlers"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 保全権限と原台帳の管理資格、本文、Company候補を保存時にも検査する
export const POST = softwareLicenseFactory.createHandlers(
  authenticateSystemAccessToken,
  ...createLicensePreservationSubmissionHandlers("create"),
)
