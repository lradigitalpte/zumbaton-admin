"use client";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon } from "@/icons";
import Link from "next/link";
import Image from "next/image";
import React, { useState } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
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

      // Success - show confirmation message
    setIsSubmitted(true);
    } catch (err) {
      console.error('Error sending password reset:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <Link
          href="/signin"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon />
          Back to sign in
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <Image
              src="/images/logo/zumbaton logo (transparent).png"
              alt="Zumbaton Logo"
              width={400}
              height={133}
              className="h-32 w-auto dark:invert"
              priority
            />
          </div>

          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Forgot Password?
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          {isSubmitted ? (
            <div className="space-y-6">
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium text-emerald-800 dark:text-emerald-300">Check your email</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                      We&apos;ve sent a password reset link to <strong>{email}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400">
                Didn&apos;t receive the email?{" "}
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Try again
                </button>
              </p>

              <Link href="/signin">
                <Button className="w-full" size="sm">
                  Back to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                    {error}
                  </div>
                )}

                <div>
                  <Label>
                    Email Address <span className="text-error-500">*</span>
                  </Label>
                  <Input
                    placeholder="Enter your email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <Button className="w-full" size="sm" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Sending..." : "Send Reset Link"}
                  </Button>
                </div>
              </div>
            </form>
          )}

          <div className="mt-5">
            <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
              Remember your password?{" "}
              <Link
                href="/signin"
                className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
