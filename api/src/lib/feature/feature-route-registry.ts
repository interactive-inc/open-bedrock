/**
 * 機能キーと API ルート接頭辞の対応表。機能キーは web の feature-registry の slug と揃える。
 * 区分の正本は .docs/feature-tiers.md。app-opt-in は既定で無効、app-default は既定で有効。
 * ここに無いルート（システム層・company）はゲート対象外で常に有効。
 */
export const optInAppRoutePrefixes: Readonly<Record<string, ReadonlyArray<string>>> = {
  "one-on-ones": ["/one-on-one/one-on-ones"],
  thanks: [
    "/thanks/thanks-messages",
    "/thanks/thanks-rewards",
    "/thanks/thanks-redemptions",
    "/thanks/thanks-point-balances",
    "/thanks/thanks-point-budgets",
  ],
  goals: ["/performance-review/performance-goals"],
  "performance-reviews": ["/performance-review/review-cycles", "/performance-review/review-forms"],
  skills: ["/skill/skill-definitions", "/skill/employee-skills"],
  career: ["/career/career-postings", "/career/career-applications", "/career/career-sheets"],
  surveys: ["/survey/surveys"],
  knowledge: ["/knowledge/knowledge-articles"],
  training: ["/training/training-courses", "/training/training-enrollments"],
  "management-dashboard": ["/company/dashboard/management"],
}

export const defaultAppRoutePrefixes: Readonly<Record<string, ReadonlyArray<string>>> = {
  attendance: ["/attendance/attendance-records"],
  leave: ["/leave/leave-requests", "/leave/leave-balances"],
  "family-care-leave": ["/family-care-leave/family-care-leaves"],
  shifts: ["/shift/shift-assignments", "/shift/shift-patterns", "/shift/shift-swap-requests"],
  "company-calendar": ["/company-calendar/company-calendar-days"],
  expenses: ["/expense/expenses"],
  "business-trips": ["/business-trip/business-trips"],
  "life-events": ["/life-event/life-events"],
  ringi: ["/ringi/ringi-requests"],
  "antisocial-checks": ["/antisocial-check/antisocial-checks"],
  recruitment: ["/recruitment/job-openings", "/recruitment/recruitment-candidates"],
  "headcount-plans": ["/headcount-plan/headcount-plans"],
  "health-checkups": ["/health-checkup/health-checkups"],
  "work-accidents": ["/work-accident/work-accidents"],
  certifications: [
    "/certification/certification-definitions",
    "/certification/employee-certifications",
  ],
  commendations: ["/commendation/commendations"],
  assets: ["/asset/assets", "/asset/stocktakes"],
  rooms: ["/room/rooms"],
  rentals: ["/rental/rental-reservations"],
  meetings: ["/meeting/meetings", "/meeting/meeting-minutes-records"],
  partners: ["/partner/partners", "/partner/partner-contracts"],
  budgets: ["/expense/department-budgets"],
  "software-licenses": ["/software-license/software-licenses"],
  "it-incidents": ["/it-incident/it-incidents"],
}
