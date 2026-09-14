import { redirect } from "next/navigation"
export default async function SurveyDetailPage(props: { params: Promise<{ survey: string }> }) {
  const { survey } = await props.params
  redirect("/survey/surveys/" + encodeURIComponent(survey) + "/summary")
}
