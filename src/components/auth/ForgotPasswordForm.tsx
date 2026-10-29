"use client";
import Input from "@/components/form/input/InputField";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon } from "@/icons";
import Link from "next/link";
import BrandLogo from "@/components/common/BrandLogo";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { studioBack, studioButton, studioError, studioInput, studioLead, studioLink, studioTitle } from "./studio";

export default function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send reset link. Please try again.');
    setIsSubmitting(false);
        return;
      }

      // Success - redirect to verify-otp page
      if (response.ok && data.success) {
        router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
      } else {
        setError(data.error || 'Failed to send verification code. Please try again.');
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Error sending password reset:', err);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-y-auto px-6 py-8 lg:w-1/2">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <Link
          href="/signin"
          className={studioBack}
        >
          <ChevronLeftIcon />
          Back to sign in
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <BrandLogo
              alt="One Step Fitness Logo"
              width={400}
              height={133}
              className="h-16 w-auto"
              priority
            />
          </div>

          <div className="mb-5 sm:mb-8">
            <h1 className={studioTitle}>Forgot password</h1>
            <p className={studioLead}>
              Enter your email and we&apos;ll send a 6-digit code to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {error && (
                <div className={studioError}>
                  {error}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-800 dark:text-white/90">
                  Email address
                </label>
                <Input
                  className={studioInput}
                  placeholder="you@onestepfitness.sg"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <Button className={studioButton} size="sm" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Sending…" : "Send code"}
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-5">
            <p className="text-center text-sm text-neutral-500 sm:text-start">
              Remember your password?{" "}
              <Link href="/signin" className={studioLink}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
