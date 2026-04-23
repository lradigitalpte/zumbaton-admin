import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password | One Step Fitness",
  description: "Reset your One Step Fitness account password",
};

export default function ForgotPassword() {
  return <ForgotPasswordForm />;
}
