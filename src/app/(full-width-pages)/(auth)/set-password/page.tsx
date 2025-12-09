import SetPasswordForm from "@/components/auth/SetPasswordForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set Password | Zumbathon",
  description: "Set your Zumbathon account password",
};

export default function SetPassword() {
  return <SetPasswordForm />;
}
