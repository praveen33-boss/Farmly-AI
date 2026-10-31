import type { Metadata } from "next"
import { FarmlyAuthExperience } from "@/components/farmly/auth-experience"

export const metadata: Metadata = { title: "Create an account · Farmly.AI", description: "Start your smarter farming journey with Farmly.AI." }

export default function SignupPage() {
  return <FarmlyAuthExperience mode="signup" />
}
