type Redirect = {
  source: string
  destination: string
  permanent: boolean
}

/**
 * App の全社ビューを持つ context と、その配下の resource。
 * URL は API と同じ `/<context>/<resource>` にする。
 */
const appViews: ReadonlyArray<{ context: string; resources: ReadonlyArray<string> }> = [
  { context: "announcement", resources: ["announcements"] },
  { context: "asset", resources: ["assets", "stocktakes"] },
  { context: "attendance", resources: ["attendances"] },
  { context: "business-trip", resources: ["business-trips"] },
  { context: "career", resources: ["job-postings"] },
  { context: "certificate-request", resources: ["certificate-requests"] },
  { context: "certification", resources: ["certifications"] },
  { context: "commendation", resources: ["commendations"] },
  { context: "company-calendar", resources: ["calendars"] },
  { context: "document", resources: ["documents"] },
  { context: "expense", resources: ["budgets", "expenses"] },
  { context: "family-care-leave", resources: ["family-care-leaves"] },
  { context: "governance", resources: ["governance-documents"] },
  { context: "headcount-plan", resources: ["headcount-plans"] },
  { context: "health-checkup", resources: ["health-checkups"] },
  { context: "it-incident", resources: ["it-incidents"] },
  { context: "knowledge", resources: ["knowledge-articles"] },
  { context: "leave", resources: ["leaves"] },
  { context: "life-event", resources: ["life-events"] },
  { context: "meeting", resources: ["decisions", "meetings"] },
  { context: "onboarding", resources: ["onboarding-assignments", "onboarding-templates"] },
  { context: "partner", resources: ["partners"] },
  { context: "performance-review", resources: ["goals", "review-cycles", "reviews"] },
  { context: "recruitment", resources: ["recruitments"] },
  { context: "regulation", resources: ["regulations"] },
  { context: "rental", resources: ["rentals"] },
  { context: "resignation", resources: ["resignations"] },
  { context: "ringi", resources: ["ringis"] },
  { context: "room", resources: ["rooms"] },
  { context: "shift", resources: ["shift-assignments", "shift-patterns", "shift-swaps"] },
  { context: "skill", resources: ["skills"] },
  { context: "software-license", resources: ["licenses"] },
  { context: "survey", resources: ["surveys"] },
  { context: "thanks", resources: ["rewards", "thanks", "thanks-redemptions"] },
  { context: "training", resources: ["trainings"] },
  { context: "work-accident", resources: ["work-accidents"] },
]

/**
 * 旧 `/organization/<resource>` から現行 URL への対応。
 * Company 所有は `/company/*`、汎用手続きは System なので `/system/*`、
 * 残りは App の `/<context>/<resource>`。
 */
const organizationMoves: ReadonlyArray<{ resource: string; destination: string }> = [
  { resource: "application-templates", destination: "application-templates" },
  { resource: "applications", destination: "applications" },
  { resource: "workflow-repairs", destination: "workflow-repairs" },
  { resource: "departments", destination: "company/departments" },
  { resource: "employees", destination: "company/employee-directory" },
  { resource: "grades", destination: "company/grades" },
  { resource: "positions", destination: "company/positions" },
  { resource: "dashboards", destination: "dashboards" },
  { resource: "governance", destination: "governance/governance-documents" },
  ...appViews.flatMap((view) =>
    view.resources.map((resource) => ({
      resource,
      destination: `${view.context}/${resource}`,
    })),
  ),
]

/**
 * 現行 URL のうち、旧 URL としても登場しないもの。
 * ここに載る resource は `/<resource>` からの一括転送を作らない。
 */
const contextPrefixes = new Set(appViews.map((view) => view.context))

function toRedirects(
  moves: ReadonlyArray<{ source: string; destination: string }>,
): ReadonlyArray<Redirect> {
  return moves.flatMap((move) => [
    { source: `/${move.source}`, destination: `/${move.destination}`, permanent: false },
    {
      source: `/${move.source}/:path*`,
      destination: `/${move.destination}/:path*`,
      permanent: false,
    },
  ])
}

/**
 * 第2世代（空間 my / teams / organization / system）への一括転送。
 * 中継先は第3世代の現行 URL へ直接向ける。連鎖を浅くしてループを避ける。
 */
const flatResourceMoves: ReadonlyArray<{ source: string; destination: string }> = [
  { source: "oneonones", destination: "my/oneonones" },
  { source: "accounts", destination: "system/accounts" },
  { source: "audit-events", destination: "audit-events" },
  { source: "batches", destination: "system/batches" },
  { source: "roles", destination: "system/roles" },
  ...organizationMoves
    // context prefix と同名の resource（thanks、governance）は
    // `/<resource>/:path*` を作ると新 URL 側を丸ごと奪うので個別に扱う。
    .filter((move) => contextPrefixes.has(move.resource) === false)
    .filter((move) => move.resource !== "dashboards")
    // 先に個別定義がある旧 URL。一括生成すると source が重複する。
    .filter((move) => ["applications", "departments", "rentals"].includes(move.resource) === false)
    .map((move) => ({ source: move.resource, destination: move.destination })),
]

/**
 * 旧 URL から現行 URL への転送定義。
 * 所有者ごとの prefix（System は `/system`、Company は `/company`、App は context 名）へ
 * 揃えた第3世代が現行で、それ以前の 2 世代分をここで最新へ寄せる。
 * 配列は先頭一致なので、具体パスを base より前に置く。
 */
const legacyRedirects: ReadonlyArray<Redirect> = [
  ...toRedirects([
    { source: "system/applications", destination: "applications" },
    { source: "system/workflow-repairs", destination: "workflow-repairs" },
    { source: "system/approval-delegations", destination: "approval-delegations" },
    { source: "system/permission-definitions", destination: "permission-definitions" },
    { source: "attendance/attendances/overtime", destination: "overtime-summary" },
  ]),
  { source: "/system/resources", destination: "/system", permanent: false },
  { source: "/company/resources", destination: "/company", permanent: false },
  { source: "/composition/resources", destination: "/composition", permanent: false },
  { source: "/system/resources/:resource", destination: "/system/:resource", permanent: false },
  { source: "/company/resources/:resource", destination: "/company/:resource", permanent: false },
  {
    source: "/company/employees/:employee/:path*",
    destination: "/company/employee-directory/:employee/:path*",
    permanent: false,
  },
  {
    source: "/system/audit-events/:eventId/:path*",
    destination: "/audit-events/:eventId/:path*",
    permanent: false,
  },
  {
    source: "/system/application-templates",
    destination: "/application-templates",
    permanent: false,
  },
  {
    source: "/company/application-templates",
    destination: "/application-templates",
    permanent: false,
  },
  {
    source: "/system/application-templates/:path*",
    destination: "/application-templates/:path*",
    permanent: false,
  },
  // --- admin 系 ---
  {
    source: "/admin/audit-events/:path*",
    destination: "/audit-events/:path*",
    permanent: false,
  },
  // --- 単純リネーム ---
  { source: "/batch", destination: "/system/batches", permanent: false },
  { source: "/calendar", destination: "/company-calendar/calendars", permanent: false },
  {
    source: "/company/dashboard/management",
    destination: "/dashboards/management",
    permanent: false,
  },
  {
    source: "/knowledge/articles/:path*",
    destination: "/knowledge/knowledge-articles/:path*",
    permanent: false,
  },
  { source: "/oneonone/:path*", destination: "/my/oneonones/:path*", permanent: false },
  { source: "/oneonone", destination: "/my/oneonones", permanent: false },
  { source: "/training/me", destination: "/training/trainings", permanent: false },
  // --- attendance ---
  { source: "/attendance/all", destination: "/attendance/attendances", permanent: false },
  {
    source: "/attendance/overtime",
    destination: "/overtime-summary",
    permanent: false,
  },
  { source: "/attendance", destination: "/attendance/attendances", permanent: false },
  // --- leave ---
  { source: "/leave/admin", destination: "/leave/leaves", permanent: false },
  { source: "/leave/inbox", destination: "/inbox/leaves", permanent: false },
  { source: "/leave/new", destination: "/my/leaves/new", permanent: false },
  { source: "/leave", destination: "/leave/leaves", permanent: false },
  // --- expense ---
  { source: "/expense/admin", destination: "/expense/expenses", permanent: false },
  { source: "/expense/inbox", destination: "/inbox/expenses", permanent: false },
  { source: "/expense/new", destination: "/my/expenses/new", permanent: false },
  { source: "/expense", destination: "/expense/expenses", permanent: false },
  // --- applications ---
  { source: "/applications/admin", destination: "/applications", permanent: false },
  { source: "/applications/inbox", destination: "/inbox/applications", permanent: false },
  {
    source: "/applications/templates/new",
    destination: "/application-templates/new",
    permanent: false,
  },
  {
    source: "/applications/templates/:path*",
    destination: "/application-templates/:path*",
    permanent: false,
  },
  {
    source: "/applications/delegations",
    destination: "/teams/approval-delegations",
    permanent: false,
  },
  {
    source: "/applications/workflow-repairs",
    destination: "/workflow-repairs",
    permanent: false,
  },
  { source: "/applications", destination: "/applications", permanent: false },
  // --- ringi ---
  { source: "/ringi/admin", destination: "/ringi/ringis", permanent: false },
  { source: "/ringi/inbox", destination: "/inbox/ringis", permanent: false },
  { source: "/ringi/new", destination: "/my/ringis/new", permanent: false },
  { source: "/ringi", destination: "/ringi/ringis", permanent: false },
  // --- 本人ビューへ寄せた App の旧 base（context prefix は現行 URL でも使う） ---
  {
    source: "/business-trip/business-trips/admin",
    destination: "/business-trip/business-trips",
    permanent: false,
  },
  {
    source: "/business-trip/business-trips/new",
    destination: "/my/business-trips/new",
    permanent: false,
  },
  {
    source: "/certificate-request/certificate-requests/admin",
    destination: "/certificate-request/certificate-requests",
    permanent: false,
  },
  {
    source: "/certificate-request/certificate-requests/new",
    destination: "/my/certificate-requests/new",
    permanent: false,
  },
  {
    source: "/life-event/life-events/admin",
    destination: "/life-event/life-events",
    permanent: false,
  },
  {
    source: "/life-event/life-events/new",
    destination: "/my/life-events/new",
    permanent: false,
  },
  {
    source: "/family-care-leave/family-care-leaves/admin",
    destination: "/family-care-leave/family-care-leaves",
    permanent: false,
  },
  {
    source: "/family-care-leave/family-care-leaves/new",
    destination: "/my/family-care-leaves/new",
    permanent: false,
  },
  {
    source: "/resignation/resignations/admin",
    destination: "/resignation/resignations",
    permanent: false,
  },
  {
    source: "/resignation/resignations/new",
    destination: "/my/resignations/new",
    permanent: false,
  },
  { source: "/rentals/admin", destination: "/rental/rentals", permanent: false },
  { source: "/rentals/new", destination: "/my/rentals/new", permanent: false },
  { source: "/rentals", destination: "/rental/rentals", permanent: false },
  // --- antisocial-checks ---
  {
    source: "/antisocial-check/antisocial-checks/admin",
    destination: "/inbox/antisocial-checks",
    permanent: false,
  },
  {
    source: "/antisocial-check/antisocial-checks/new",
    destination: "/my/antisocial-checks/new",
    permanent: false,
  },
  {
    source: "/antisocial-check/antisocial-checks",
    destination: "/inbox/antisocial-checks",
    permanent: false,
  },
  // --- shift ---
  { source: "/shift/admin", destination: "/shift/shift-swaps", permanent: false },
  { source: "/shift/inbox", destination: "/inbox/shift-swaps", permanent: false },
  {
    source: "/shift/manage/new",
    destination: "/shift/shift-assignments/new",
    permanent: false,
  },
  { source: "/shift/manage", destination: "/shift/shift-assignments", permanent: false },
  { source: "/shift/patterns/new", destination: "/shift/shift-patterns/new", permanent: false },
  { source: "/shift/patterns", destination: "/shift/shift-patterns", permanent: false },
  { source: "/shift", destination: "/shift/shift-assignments", permanent: false },
  // --- thanks ---
  { source: "/thanks/admin", destination: "/thanks/thanks-redemptions", permanent: false },
  { source: "/thanks/inbox", destination: "/inbox/thanks-redemptions", permanent: false },
  // context 名と resource 名が同じなので `/thanks/:path*` は作れない。
  // 現行 URL を食わないよう、旧 base だけを exact で転送する。
  { source: "/thanks", destination: "/thanks/thanks", permanent: false },
  { source: "/governance", destination: "/governance/governance-documents", permanent: false },
  // --- review ---
  {
    source: "/review/manage",
    destination: "/performance-review/review-cycles",
    permanent: false,
  },
  { source: "/review/results", destination: "/performance-review/reviews", permanent: false },
  { source: "/review", destination: "/performance-review/review-cycles", permanent: false },
  // --- career ---
  { source: "/career/postings/new", destination: "/career/job-postings/new", permanent: false },
  {
    source: "/career/postings/:path*",
    destination: "/career/job-postings/:path*",
    permanent: false,
  },
  { source: "/career/postings", destination: "/career/job-postings", permanent: false },
  { source: "/career", destination: "/career/job-postings", permanent: false },
  // --- skills / surveys ---
  { source: "/skills/me", destination: "/skill/skills", permanent: false },
  {
    source: "/survey/surveys/responses",
    destination: "/survey/surveys",
    permanent: false,
  },
  // --- assets / rooms ---
  { source: "/asset/assets/lent/me", destination: "/asset/assets", permanent: false },
  { source: "/room/rooms/me", destination: "/room/rooms", permanent: false },
  // --- onboarding ---
  {
    source: "/onboarding/employee/:code",
    destination: "/company/employee-directory/:code/onboarding",
    permanent: false,
  },
  {
    source: "/onboarding/employees",
    destination: "/onboarding/onboarding-assignments",
    permanent: false,
  },
  {
    source: "/onboarding/assignments/new",
    destination: "/onboarding/onboarding-assignments/new",
    permanent: false,
  },
  { source: "/onboarding/me", destination: "/onboarding/onboarding-assignments", permanent: false },
  {
    source: "/onboarding/templates/new",
    destination: "/onboarding/onboarding-templates/new",
    permanent: false,
  },
  {
    source: "/onboarding/templates",
    destination: "/onboarding/onboarding-templates",
    permanent: false,
  },
  {
    source: "/onboarding",
    destination: "/onboarding/onboarding-assignments",
    permanent: false,
  },
  // --- org ---
  {
    source: "/org/reporting-line/:code",
    destination: "/company/employee-directory/:code/reporting-line",
    permanent: false,
  },
  {
    source: "/org/departments/:code/members",
    destination: "/company/departments/:code/members",
    permanent: false,
  },
  {
    source: "/org/departments/:path*",
    destination: "/company/departments/:path*",
    permanent: false,
  },
  { source: "/org/departments", destination: "/company/departments", permanent: false },
  { source: "/org", destination: "/company/departments", permanent: false },
  // --- 組織図は Company へ移設。個別部署 /teams/:code は部署ハブとして存続 ---
  { source: "/teams", destination: "/company/departments", permanent: false },
  { source: "/teams/new", destination: "/company/departments/new", permanent: false },
  { source: "/teams/reports", destination: "/my/direct-reports", permanent: false },
  { source: "/departments/new", destination: "/company/departments/new", permanent: false },
  { source: "/departments", destination: "/company/departments", permanent: false },
  { source: "/departments/:path*", destination: "/teams/:path*", permanent: false },
  // --- マイチームと代理承認は部署空間へ移動 ---
  { source: "/my/reports", destination: "/my/direct-reports", permanent: false },
  {
    source: "/my/approval-delegations",
    destination: "/teams/approval-delegations",
    permanent: false,
  },
  { source: "/me/reports", destination: "/my/direct-reports", permanent: false },
  // --- 空間 prefix の廃止（第3世代） ---
  // /organization は所有者を表さないので全面的に解体した。
  ...toRedirects(
    organizationMoves.map((move) => ({
      source: `organization/${move.resource}`,
      destination: move.destination,
    })),
  ),
  { source: "/organization", destination: "/company/employee-directory", permanent: false },
  { source: "/system/licenses", destination: "/software-license/licenses", permanent: false },
  {
    source: "/system/licenses/:path*",
    destination: "/software-license/licenses/:path*",
    permanent: false,
  },
  { source: "/system/it-incidents", destination: "/it-incident/it-incidents", permanent: false },
  {
    source: "/system/it-incidents/:path*",
    destination: "/it-incident/it-incidents/:path*",
    permanent: false,
  },
  // 「レポート」と誤読されるため direct reports（直属の部下）へ改名し、
  // 本人の文脈なので会社ではなく自分の空間へ移した。
  { source: "/company/reports", destination: "/my/direct-reports", permanent: false },
  { source: "/company/inbox", destination: "/inbox", permanent: false },
  { source: "/company/inbox/:path*", destination: "/inbox/:path*", permanent: false },
  { source: "/company/notifications", destination: "/notifications", permanent: false },
  {
    source: "/company/notifications/:path*",
    destination: "/notifications/:path*",
    permanent: false,
  },
  {
    source: "/company/application-templates/:path*",
    destination: "/application-templates/:path*",
    permanent: false,
  },
  {
    source: "/company/audit-events/:path*",
    destination: "/audit-events/:path*",
    permanent: false,
  },
  // マイページはホームへ統合した。`/my/:path*`（本人スコープ）は現行なので転送しない。
  { source: "/my", destination: "/", permanent: false },
  { source: "/me", destination: "/", permanent: false },
  { source: "/me/:path*", destination: "/my/:path*", permanent: false },
  // 空間移動の一括転送は個別 redirects より後に置く（先に置くと
  // /applications/inbox 等の具体パスが先取りされて壊れる）。
  ...toRedirects(flatResourceMoves),
]

/** 廃止した個人画面への転送は提供しない。 */
export const urlRedirects: ReadonlyArray<Redirect> = legacyRedirects.filter(
  (redirect) =>
    !redirect.destination.startsWith("/my/") &&
    !redirect.destination.startsWith("/teams/") &&
    redirect.destination !== "/notifications" &&
    redirect.destination !== "/thanks/rewards" &&
    redirect.source !== redirect.destination,
)
