"use client";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon } from "@/icons";
import Link from "next/link";
import BrandLogo from "@/components/common/BrandLogo";
import { studioBack, studioButton, studioError, studioLead, studioLink, studioOtp, studioTitle } from "./studio";
import { useRouter } from "next/navigation";
import React, { useState, useRef, useEffect } from "react";

export default function MFAVerificationForm() {
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newCode = [...code];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newCode[index + i] = digit;
        }
      });
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      const newCode = [...code];
      newCode[index] = value.replace(/\D/g, "");
      setCode(newCode);

      // Move to next input
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
    setError("");
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = () => {
    setResendTimer(30);
    setCode(["", "", "", "", "", ""]);
    setError("");
    inputRefs.current[0]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call - accept any code for demo
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSubmitting(false);
    router.push("/");
  };

  const isComplete = code.every(digit => digit !== "");

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
            <h1 className={studioTitle}>Two-factor check</h1>
            <p className={studioLead}>Enter the 6-digit code from your authenticator app or SMS.</p>
          </div>

          {/* MFA Icon */}
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E4F56C] text-neutral-950">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {error && (
                <div className={studioError}>
                  {error}
                </div>
              )}

              {/* Code Input */}
              <div>
                <label className="mb-3 block text-center text-sm font-medium text-neutral-800 dark:text-white/90">
                  Verification code
                </label>
                <div className="flex justify-center gap-2 sm:gap-3">
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className={studioOtp}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Button className={studioButton} size="sm" disabled={isSubmitting || !isComplete}>
                  {isSubmitting ? "Verifying…" : "Verify code"}
                </Button>
              </div>

              {/* Resend Code */}
              <div className="text-center">
                {resendTimer > 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Resend code in <span className="font-semibold text-neutral-950 dark:text-[#E4F56C]">{resendTimer}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-sm font-semibold text-neutral-950 underline decoration-[#E4F56C] decoration-2 underline-offset-4 disabled:opacity-40 dark:text-white"
                  >
                    Resend verification code
                  </button>
                )}
              </div>

              {/* Alternative Methods */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-3">
                  Having trouble?
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="w-full rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-800 dark:border-white/10 dark:text-white"
                  >
                    Use backup code
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-800 dark:border-white/10 dark:text-white"
                  >
                    Send code via SMS
                  </button>
                </div>
              </div>
            </div>
          </form>

          <div className="mt-5">
            <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400">
              Need help?{" "}
              <Link
                href="/signin"
                className={studioLink}
              >
                Contact Support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
