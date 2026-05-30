type SeedSurvey = {
  id: number
  title: string
  status: "open" | "closed"
  questionsJson: ReadonlyArray<unknown>
}

export const seedSurveys: ReadonlyArray<SeedSurvey> = [
  {
    id: 1,
    title: "FY2026 Employee Engagement Survey",
    status: "open",
    questionsJson: [
      { id: "q1", type: "scale", text: "I find my work rewarding", min: 1, max: 5 },
      {
        id: "q2",
        type: "scale",
        text: "I have a good relationship with my manager",
        min: 1,
        max: 5,
      },
      { id: "q3", type: "text", text: "Please share anything you would like us to improve" },
    ],
  },
  {
    id: 2,
    title: "Remote Work Satisfaction Survey",
    status: "open",
    questionsJson: [
      {
        id: "q1",
        type: "scale",
        text: "I am satisfied with my home work environment",
        min: 1,
        max: 5,
      },
      {
        id: "q2",
        type: "choice",
        text: "Preferred office attendance frequency",
        options: ["0 days/week", "1 day/week", "2+ days/week"],
      },
    ],
  },
  {
    id: 3,
    title: "H2 FY2025 Retrospective Survey",
    status: "closed",
    questionsJson: [{ id: "q1", type: "scale", text: "I achieved my goals", min: 1, max: 5 }],
  },
]
