import { redirect } from "next/navigation"

// This is a self-hosted app, not a marketing site — there is no landing page.
// Visitors are sent straight into the app: sign-in -> onboarding -> dashboard.
// (Sign-in forwards already-authenticated users on to setup/dashboard.)
export default function Home() {
  redirect("/auth/signin")
}
