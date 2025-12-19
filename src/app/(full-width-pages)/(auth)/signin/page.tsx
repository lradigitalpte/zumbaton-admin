import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Login | Zumbaton",
  description: "Sign in to your Zumbaton Admin Dashboard",
};

export default function SignIn() {
  return <SignInForm />;
}
