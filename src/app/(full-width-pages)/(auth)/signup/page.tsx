import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Sign Up | Zumbaton",
  description: "Create a Zumbaton Admin account",
  // other metadata
};

export default function SignUp() {
  return <SignUpForm />;
}
