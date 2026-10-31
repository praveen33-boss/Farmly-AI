import type { Metadata } from "next"
import { FarmlyAuthExperience } from "@/components/farmly/auth-experience"

export const metadata: Metadata = { title: "Log in · Farmly.AI", description: "Log in to your Farmly.AI farmer account." }

export default function LoginPage() {
  return <FarmlyAuthExperience mode="login" />
}
