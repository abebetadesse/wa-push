import { redirect } from "next/navigation";

// The curriculum browser became the Textbooks page.
export default function CurriculumPage() {
  redirect("/textbooks");
}
