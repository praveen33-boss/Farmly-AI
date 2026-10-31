import type { Metadata } from "next"
import { FarmlyAuthExperience } from "@/components/farmly/auth-experience"

export const metadata: Metadata = { title: "Recover your account · Farmly.AI", description: "Recover access to your Farmly.AI demo account." }

export default function ForgotPasswordPage() {
  return <FarmlyAuthExperience mode="forgot-password" />
}
