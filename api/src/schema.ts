import {
  systemCoreSchema,
  systemProcedureDelegationSchema,
  systemProcedureSchema,
  systemWorkflowSchema,
} from "@/contexts/system/infrastructure/schema/system"
import { companySchema as canonicalCompanySchema } from "@/contexts/company/infrastructure/schema/company"
import * as ownedSchema0 from "@/contexts/company-compatibility/infrastructure/schema/employee"
import * as ownedSchema1 from "@/contexts/company-compatibility/infrastructure/schema/employee-lifecycle"
import * as ownedSchema2 from "@/contexts/company-compatibility/infrastructure/schema/organization"
import * as ownedSchema3 from "@/contexts/announcement/infrastructure/schema/announcement"
import * as ownedSchema4 from "@/contexts/antisocial-check/infrastructure/schema/antisocial-check"
import * as ownedSchema5 from "@/contexts/asset/infrastructure/schema/asset"
import * as ownedSchema6 from "@/contexts/attendance/infrastructure/schema/attendance"
import * as ownedSchema7 from "@/contexts/expense/infrastructure/schema/budget"
import * as ownedSchema8 from "@/contexts/business-trip/infrastructure/schema/business-trip"
import * as ownedSchema9 from "@/contexts/career/infrastructure/schema/career"
import * as ownedSchema10 from "@/contexts/certificate-request/infrastructure/schema/certificate-request"
import * as ownedSchema11 from "@/contexts/certification/infrastructure/schema/certification"
import * as ownedSchema12 from "@/contexts/commendation/infrastructure/schema/commendation"
import * as ownedSchema13 from "@/contexts/company-calendar/infrastructure/schema/company-calendar"
import * as ownedSchema14 from "@/contexts/company-compatibility/infrastructure/schema/audit"
import * as ownedSchema15 from "@/contexts/company-compatibility/infrastructure/schema/employee-event"
import * as ownedSchema16 from "@/contexts/company-compatibility/infrastructure/schema/grade"
import * as ownedSchema17 from "@/contexts/company-compatibility/infrastructure/schema/position"
import * as ownedSchema18 from "@/contexts/compensation-change/infrastructure/schema/compensation-change"
import * as ownedSchema19 from "@/contexts/disciplinary-action/infrastructure/schema/disciplinary-action"
import * as ownedSchema20 from "@/contexts/document/infrastructure/schema/document"
import * as ownedSchema21 from "@/contexts/expense/infrastructure/schema/expense"
import * as ownedSchema22 from "@/contexts/family-care-leave/infrastructure/schema/family-care-leave"
import * as ownedSchema23 from "@/contexts/performance-review/infrastructure/schema/goal"
import * as ownedSchema24 from "@/contexts/governance/infrastructure/schema/governance"
import * as ownedSchema25 from "@/contexts/headcount-plan/infrastructure/schema/headcount-plan"
import * as ownedSchema26 from "@/contexts/health-checkup/infrastructure/schema/health-checkup"
import * as ownedSchema27 from "@/contexts/it-incident/infrastructure/schema/it-incident"
import * as ownedSchema28 from "@/contexts/knowledge/infrastructure/schema/knowledge"
import * as ownedSchema29 from "@/contexts/leave/infrastructure/schema/leave"
import * as ownedSchema30 from "@/contexts/life-event/infrastructure/schema/life-event"
import * as ownedSchema31 from "@/contexts/meeting/infrastructure/schema/meeting"
import * as ownedSchema32 from "@/contexts/onboarding/infrastructure/schema/onboarding"
import * as ownedSchema33 from "@/contexts/one-on-one/infrastructure/schema/one-on-one"
import * as ownedSchema34 from "@/contexts/partner/infrastructure/schema/partner"
import * as ownedSchema35 from "@/contexts/performance-review/infrastructure/schema/performance-review"
import * as ownedSchema36 from "@/contexts/recruitment/infrastructure/schema/recruitment"
import * as ownedSchema37 from "@/contexts/regulation/infrastructure/schema/regulation"
import * as ownedSchema38 from "@/contexts/rental/infrastructure/schema/rental"
import * as ownedSchema39 from "@/contexts/resignation/infrastructure/schema/resignation"
import * as ownedSchema40 from "@/contexts/ringi/infrastructure/schema/ringi"
import * as ownedSchema41 from "@/contexts/room/infrastructure/schema/room"
import * as ownedSchema42 from "@/contexts/shift/infrastructure/schema/shift"
import * as ownedSchema43 from "@/contexts/skill/infrastructure/schema/skill"
import * as ownedSchema44 from "@/contexts/software-license/infrastructure/schema/software-license"
import * as ownedSchema45 from "@/contexts/asset/infrastructure/schema/stocktake"
import * as ownedSchema46 from "@/contexts/survey/infrastructure/schema/survey"
import * as ownedSchema47 from "@/contexts/thanks/infrastructure/schema/thanks"
import * as ownedSchema48 from "@/contexts/training/infrastructure/schema/training"
import * as ownedSchema49 from "@/contexts/work-accident/infrastructure/schema/work-accident"
import * as ownedSchema50 from "@/contexts/work-style/infrastructure/schema/work-style"

export * from "@/contexts/company-compatibility/infrastructure/schema/employee"
export * from "@/contexts/company-compatibility/infrastructure/schema/employee-lifecycle"
export * from "@/contexts/company-compatibility/infrastructure/schema/organization"
export * from "@/contexts/company/infrastructure/schema/company"
export * from "@/contexts/system/infrastructure/schema/system"
export * from "@/contexts/announcement/infrastructure/schema/announcement"
export * from "@/contexts/antisocial-check/infrastructure/schema/antisocial-check"
export * from "@/contexts/asset/infrastructure/schema/asset"
export * from "@/contexts/attendance/infrastructure/schema/attendance"
export * from "@/contexts/expense/infrastructure/schema/budget"
export * from "@/contexts/business-trip/infrastructure/schema/business-trip"
export * from "@/contexts/career/infrastructure/schema/career"
export * from "@/contexts/certificate-request/infrastructure/schema/certificate-request"
export * from "@/contexts/certification/infrastructure/schema/certification"
export * from "@/contexts/commendation/infrastructure/schema/commendation"
export * from "@/contexts/company-calendar/infrastructure/schema/company-calendar"
export * from "@/contexts/company-compatibility/infrastructure/schema/audit"
export * from "@/contexts/company-compatibility/infrastructure/schema/employee-event"
export * from "@/contexts/company-compatibility/infrastructure/schema/grade"
export * from "@/contexts/company-compatibility/infrastructure/schema/position"
export * from "@/contexts/compensation-change/infrastructure/schema/compensation-change"
export * from "@/contexts/disciplinary-action/infrastructure/schema/disciplinary-action"
export * from "@/contexts/document/infrastructure/schema/document"
export * from "@/contexts/expense/infrastructure/schema/expense"
export * from "@/contexts/family-care-leave/infrastructure/schema/family-care-leave"
export * from "@/contexts/performance-review/infrastructure/schema/goal"
export * from "@/contexts/governance/infrastructure/schema/governance"
export * from "@/contexts/headcount-plan/infrastructure/schema/headcount-plan"
export * from "@/contexts/health-checkup/infrastructure/schema/health-checkup"
export * from "@/contexts/it-incident/infrastructure/schema/it-incident"
export * from "@/contexts/knowledge/infrastructure/schema/knowledge"
export * from "@/contexts/leave/infrastructure/schema/leave"
export * from "@/contexts/life-event/infrastructure/schema/life-event"
export * from "@/contexts/meeting/infrastructure/schema/meeting"
export * from "@/contexts/onboarding/infrastructure/schema/onboarding"
export * from "@/contexts/one-on-one/infrastructure/schema/one-on-one"
export * from "@/contexts/partner/infrastructure/schema/partner"
export * from "@/contexts/performance-review/infrastructure/schema/performance-review"
export * from "@/contexts/recruitment/infrastructure/schema/recruitment"
export * from "@/contexts/regulation/infrastructure/schema/regulation"
export * from "@/contexts/rental/infrastructure/schema/rental"
export * from "@/contexts/resignation/infrastructure/schema/resignation"
export * from "@/contexts/ringi/infrastructure/schema/ringi"
export * from "@/contexts/room/infrastructure/schema/room"
export * from "@/contexts/shift/infrastructure/schema/shift"
export * from "@/contexts/skill/infrastructure/schema/skill"
export * from "@/contexts/software-license/infrastructure/schema/software-license"
export * from "@/contexts/asset/infrastructure/schema/stocktake"
export * from "@/contexts/survey/infrastructure/schema/survey"
export * from "@/contexts/thanks/infrastructure/schema/thanks"
export * from "@/contexts/training/infrastructure/schema/training"
export * from "@/contexts/work-accident/infrastructure/schema/work-accident"
export * from "@/contexts/work-style/infrastructure/schema/work-style"

export const schema = {
  ...systemCoreSchema,
  ...systemProcedureDelegationSchema,
  ...systemProcedureSchema,
  ...systemWorkflowSchema,
  ...canonicalCompanySchema,
  ...ownedSchema0,
  ...ownedSchema1,
  ...ownedSchema2,
  ...ownedSchema3,
  ...ownedSchema4,
  ...ownedSchema5,
  ...ownedSchema6,
  ...ownedSchema7,
  ...ownedSchema8,
  ...ownedSchema9,
  ...ownedSchema10,
  ...ownedSchema11,
  ...ownedSchema12,
  ...ownedSchema13,
  ...ownedSchema14,
  ...ownedSchema15,
  ...ownedSchema16,
  ...ownedSchema17,
  ...ownedSchema18,
  ...ownedSchema19,
  ...ownedSchema20,
  ...ownedSchema21,
  ...ownedSchema22,
  ...ownedSchema23,
  ...ownedSchema24,
  ...ownedSchema25,
  ...ownedSchema26,
  ...ownedSchema27,
  ...ownedSchema28,
  ...ownedSchema29,
  ...ownedSchema30,
  ...ownedSchema31,
  ...ownedSchema32,
  ...ownedSchema33,
  ...ownedSchema34,
  ...ownedSchema35,
  ...ownedSchema36,
  ...ownedSchema37,
  ...ownedSchema38,
  ...ownedSchema39,
  ...ownedSchema40,
  ...ownedSchema41,
  ...ownedSchema42,
  ...ownedSchema43,
  ...ownedSchema44,
  ...ownedSchema45,
  ...ownedSchema46,
  ...ownedSchema47,
  ...ownedSchema48,
  ...ownedSchema49,
  ...ownedSchema50,
}
