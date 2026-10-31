import type { Metadata } from "next"
import { FarmlyAuthExperience } from "@/components/farmly/auth-experience"

export const metadata: Metadata = { title: "Verify your number · Farmly.AI", description: "Verify your mobile number to continue with Farmly.AI." }

export default function VerifyOtpPage() {
  return <FarmlyAuthExperience mode="verify-otp" />
}
