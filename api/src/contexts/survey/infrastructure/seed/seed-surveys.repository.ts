type SeedSurvey = {
  id: number
  title: string
  status: "open" | "closed"
  questionsJson: ReadonlyArray<unknown>
}

export const seedSurveys: ReadonlyArray<SeedSurvey> = [
  {
    id: 1,
    title: "2026年度 従業員エンゲージメント調査",
    status: "open",
    questionsJson: [
      { id: "q1", type: "scale", text: "仕事にやりがいを感じている", min: 1, max: 5 },
      {
        id: "q2",
        type: "scale",
        text: "上司と良好な関係を築けている",
        min: 1,
        max: 5,
      },
      { id: "q3", type: "text", text: "改善してほしい点があれば教えてください" },
    ],
  },
  {
    id: 2,
    title: "リモートワーク満足度調査",
    status: "open",
    questionsJson: [
      {
        id: "q1",
        type: "scale",
        text: "自宅の労働環境に満足している",
        min: 1,
        max: 5,
      },
      {
        id: "q2",
        type: "choice",
        text: "希望する出社頻度",
        options: ["週0日", "週1日", "週2日以上"],
      },
    ],
  },
  {
    id: 3,
    title: "2025年度下期 振り返り調査",
    status: "closed",
    questionsJson: [{ id: "q1", type: "scale", text: "目標を達成できた", min: 1, max: 5 }],
  },
]
