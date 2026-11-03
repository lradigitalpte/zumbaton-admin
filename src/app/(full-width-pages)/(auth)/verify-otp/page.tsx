"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BrandLogo from "@/components/common/BrandLogo";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import { useToast } from "@/components/ui/Toast";
import { studioBack, studioButton, studioError, studioInputIcon, studioLead, studioLink, studioOtp, studioTitle } from "@/components/auth/studio";

function VerifyOTPContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Get email from query params
  const email = searchParams.get('email') || '';

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

  const handleResend = async () => {
    if (resendTimer > 0 || !email) return;

    setResendTimer(30);
    setCode(["", "", "", "", "", ""]);
    setError("");

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.showToast('Verification code sent! Please check your email.', 'success');
        inputRefs.current[0]?.focus();
      } else {
        setError(data.error || 'Failed to resend code. Please try again.');
      }
    } catch (err) {
      console.error('Error resending code:', err);
      setError('Failed to resend code. Please try again.');
    }
  };

  const validatePassword = (pwd: string) => {
    const checks = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
    };
    return checks;
  };

  const passwordChecks = validatePassword(password);
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    if (!email) {
      setError("Email address is required");
      return;
    }

    if (!password) {
      setError("Please enter a new password");
      return;
    }

    if (!isPasswordValid) {
      setError("Password does not meet all requirements");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          otpCode: fullCode,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to reset password. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Success! Password updated - redirect to sign in
      toast.showToast('Password updated successfully! Please sign in with your new password.', 'success');
      setTimeout(() => {
        router.push('/signin');
      }, 1500);
    } catch (err) {
      console.error('Error verifying OTP and updating password:', err);
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const isComplete = code.every(digit => digit !== "");

  // Redirect if no email
  useEffect(() => {
    if (!email) {
      router.push('/forgot-password');
    }
  }, [email, router]);

  if (!email) {
    return null;
  }

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
            <h1 className={studioTitle}>Reset your password</h1>
            <p className={studioLead}>
              We sent a 6-digit code to <strong className="text-neutral-950 dark:text-white">{email}</strong>. Enter it with your new password.
            </p>
          </div>

          <div className="mb-6 flex justify-center">
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
                      disabled={isSubmitting}
                    />
                  ))}
                </div>
              </div>

              {/* Password Fields */}
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-800 dark:text-white/90">New password</label>
                  <div className="relative">
                    <Input
                      className={studioInputIcon}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    >
                      {showPassword ? <EyeCloseIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2 text-xs space-y-1">
                      <div className={passwordChecks.length ? "text-neutral-950 dark:text-white" : "text-neutral-400"}>
                        {passwordChecks.length ? "✓" : "○"} At least 8 characters
                      </div>
                      <div className={passwordChecks.uppercase ? "text-neutral-950 dark:text-white" : "text-neutral-400"}>
                        {passwordChecks.uppercase ? "✓" : "○"} One uppercase letter
                      </div>
                      <div className={passwordChecks.lowercase ? "text-neutral-950 dark:text-white" : "text-neutral-400"}>
                        {passwordChecks.lowercase ? "✓" : "○"} One lowercase letter
                      </div>
                      <div className={passwordChecks.number ? "text-neutral-950 dark:text-white" : "text-neutral-400"}>
                        {passwordChecks.number ? "✓" : "○"} One number
                      </div>
                      <div className={passwordChecks.special ? "text-neutral-950 dark:text-white" : "text-neutral-400"}>
                        {passwordChecks.special ? "✓" : "○"} One special character
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-800 dark:text-white/90">Confirm password</label>
                  <div className="relative">
                    <Input
                      className={studioInputIcon}
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    >
                      {showConfirmPassword ? <EyeCloseIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      Passwords do not match
                    </p>
                  )}
                </div>
              </div>

              {/* Resend */}
              <div className="text-center">
                {resendTimer > 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Resend code in <span className="font-semibold">{resendTimer}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-sm font-semibold text-neutral-950 underline decoration-[#E4F56C] decoration-2 underline-offset-4 dark:text-white"
                    disabled={isSubmitting}
                  >
                    Resend code
                  </button>
                )}
              </div>

              {/* Submit */}
              <div>
                <Button
                  className={studioButton}
                  size="sm"
                  type="submit"
                  disabled={!isComplete || !isPasswordValid || password !== confirmPassword || !password || !confirmPassword || isSubmitting}
                >
                  {isSubmitting ? "Updating…" : "Reset password"}
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-5">
            <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400">
              <Link href="/forgot-password" className={studioLink}>
                Change email address
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOTPPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyOTPContent />
    </Suspense>
  );
}
