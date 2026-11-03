"use client";

import { useState, useEffect, useRef } from "react";
import { useProfile, useUpdateProfile, useChangePassword, getBioFromProfile } from "@/hooks/useProfile";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const field = "h-11 w-full rounded-full border border-neutral-200 bg-white px-4 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-gray-800 dark:text-white";
const label = "mb-2 block text-sm font-medium text-neutral-800 dark:text-white/90";
const hint = "mt-1 text-xs text-neutral-400";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  bio: string;
  avatar: string;
}

interface Session {
  id: string;
  device: string;
  browser: string;
  location: string;
  ip: string;
  lastActive: string;
  current: boolean;
}

const emptyProfile: ProfileData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "",
  bio: "",
  avatar: "",
};

export default function ProfileSettingsPage() {
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "sessions">("profile");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { user } = useAuth();
  const { data: profileData, isLoading, error } = useProfile();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [profile, setProfile] = useState<ProfileData>(emptyProfile);

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadedProfile = (): ProfileData => {
    if (profileData) {
      const nameParts = (profileData.name || "").split(" ");
      return {
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        email: profileData.email || "",
        phone: profileData.phone || "",
        role: profileData.role || "",
        bio: getBioFromProfile(profileData),
        avatar: profileData.avatarUrl || "",
      };
    }
    if (user) {
      const nameParts = (user.name || "").split(" ");
      return {
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        email: user.email || "",
        phone: "",
        role: user.role || "",
        bio: "",
        avatar: "",
      };
    }
    return emptyProfile;
  };

  useEffect(() => {
    if (profileData || user) setProfile(loadedProfile());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileData, user]);

  const [sessions] = useState<Session[]>([
    {
      id: "1",
      device: "Windows PC",
      browser: "Chrome 120",
      location: "Los Angeles, CA",
      ip: "192.168.1.100",
      lastActive: "Active now",
      current: true,
    },
    {
      id: "2",
      device: "iPhone 15 Pro",
      browser: "Safari",
      location: "Los Angeles, CA",
      ip: "192.168.1.101",
      lastActive: "2 hours ago",
      current: false,
    },
    {
      id: "3",
      device: "MacBook Pro",
      browser: "Firefox 121",
      location: "San Francisco, CA",
      ip: "10.0.0.45",
      lastActive: "Yesterday",
      current: false,
    },
  ]);

  const handleSave = async () => {
    try {
      const fullName = `${profile.firstName} ${profile.lastName}`.trim();
      await updateProfile.mutateAsync({
        name: fullName,
        phone: profile.phone || null,
        bio: profile.bio || undefined,
        avatarUrl: profile.avatar || null,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  };

  const handleCancel = () => {
    setProfile(loadedProfile());
  };

  const handlePasswordChange = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      alert("Passwords don't match");
      return;
    }

    if (passwords.newPassword.length < 8) {
      alert("Password must be at least 8 characters long");
      return;
    }

    try {
      await changePassword.mutateAsync({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setShowPasswordForm(false);
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to change password:", error);
      alert(error instanceof Error ? error.message : "Failed to change password");
    }
  };

  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.");
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert("File too large. Maximum file size is 5MB.");
      return;
    }

    try {
      setIsUploadingAvatar(true);

      const formData = new FormData();
      formData.append("file", file);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert("Please sign in to upload avatar");
        return;
      }

      const response = await fetch("/api/profile/upload-avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error?.message || "Failed to upload avatar");
        return;
      }

      const data = await response.json();
      if (data.success && data.data?.avatarUrl) {
        setProfile((prev) => ({ ...prev, avatar: data.data.avatarUrl }));
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Error uploading avatar:", error);
      alert("Failed to upload avatar. Please try again.");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const tabs = [
    { id: "profile" as const, label: "Profile" },
    { id: "security" as const, label: "Security" },
    { id: "sessions" as const, label: "Sessions" },
  ];

  const initials = `${profile.firstName[0] || ""}${profile.lastName[0] || ""}`.toUpperCase() || "—";

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Profile</h1>
        <p className="mt-1 max-w-xl text-sm text-neutral-500">
          Your name, photo, and sign-in. {saveSuccess ? "Saved." : "Changes stay on this account."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className={`${card} p-6 text-center`}>
          <div className="relative mx-auto mb-4 h-24 w-24">
            <button
              type="button"
              onClick={handleAvatarClick}
              title="Change profile picture"
              className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-neutral-950 text-2xl font-semibold text-[#E4F56C]"
            >
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt={`${profile.firstName} ${profile.lastName}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleAvatarClick}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-950 shadow-sm dark:border-white/10 dark:bg-gray-800 dark:text-white"
              title="Change profile picture"
            >
              {isUploadingAvatar ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-950" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
          <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
            {profile.firstName} {profile.lastName}
          </h2>
          {profile.role ? (
            <span className="mt-2 inline-flex rounded-full bg-neutral-950 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
              {profile.role}
            </span>
          ) : null}
          <p className="mt-2 text-xs text-neutral-400">{profile.email}</p>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-2 text-xs font-semibold ${
                  activeTab === tab.id
                    ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                    : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className={`${card} h-64 animate-pulse`} />
          ) : error ? (
            <div className={`${card} px-6 py-8 text-sm text-red-600`}>
              Could not load profile. {error instanceof Error ? error.message : ""}
            </div>
          ) : (
            <div className={`${card} p-5 sm:p-6`}>
              {activeTab === "profile" && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Personal information</h2>
                    <p className="mt-1 text-sm text-neutral-500">Name, phone, and a short bio. Email and role stay as they are.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div>
                      <label className={label}>First name</label>
                      <input
                        className={field}
                        type="text"
                        value={profile.firstName}
                        onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={label}>Last name</label>
                      <input
                        className={field}
                        type="text"
                        value={profile.lastName}
                        onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={label}>Email address</label>
                      <input className={`${field} bg-neutral-50 text-neutral-500 dark:bg-white/5`} type="email" value={profile.email} readOnly />
                      <p className={hint}>Sign-in email. It is not changed from this form.</p>
                    </div>
                    <div>
                      <label className={label}>Phone number</label>
                      <input
                        className={field}
                        type="tel"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={label}>Role</label>
                      <input className={`${field} bg-neutral-50 text-neutral-500 dark:bg-white/5`} type="text" value={profile.role} readOnly />
                      <p className={hint}>Contact a super admin to change your role.</p>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={label}>Bio</label>
                      <textarea
                        rows={3}
                        value={profile.bio}
                        onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                        className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-950 outline-none dark:border-white/10 dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                  </div>

                  {updateProfile.isError && (
                    <p className="text-sm text-red-600">{updateProfile.error?.message || "Failed to save profile"}</p>
                  )}

                  <div className="flex justify-end gap-2 border-t border-neutral-200 pt-5 dark:border-white/10">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 dark:border-white/10 dark:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={updateProfile.isPending}
                      className="rounded-full bg-[#E4F56C] px-5 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
                    >
                      {updateProfile.isPending ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "security" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Security</h2>
                    <p className="mt-1 text-sm text-neutral-500">Password and extra checks on this account.</p>
                  </div>

                  <div className="rounded-[22px] border border-neutral-200 bg-neutral-50 p-5 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-neutral-950 dark:text-white">Password</p>
                        <p className="text-sm text-neutral-500">At least 8 characters.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPasswordForm(!showPasswordForm)}
                        className="rounded-full bg-neutral-950 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950"
                      >
                        {showPasswordForm ? "Cancel" : "Change password"}
                      </button>
                    </div>

                    {showPasswordForm && (
                      <div className="mt-4 space-y-4 border-t border-neutral-200 pt-4 dark:border-white/10">
                        <div>
                          <label className={label}>Current password</label>
                          <input
                            className={field}
                            type="password"
                            value={passwords.currentPassword}
                            onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className={label}>New password</label>
                          <input
                            className={field}
                            type="password"
                            value={passwords.newPassword}
                            onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className={label}>Confirm new password</label>
                          <input
                            className={field}
                            type="password"
                            value={passwords.confirmPassword}
                            onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                          />
                        </div>
                        {changePassword.isError && (
                          <p className="text-sm text-red-600">{changePassword.error?.message || "Failed to change password"}</p>
                        )}
                        <button
                          type="button"
                          onClick={handlePasswordChange}
                          disabled={changePassword.isPending}
                          className="rounded-full bg-[#E4F56C] px-5 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-50"
                        >
                          {changePassword.isPending ? "Updating…" : "Update password"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-[22px] border border-neutral-200 bg-neutral-50 p-5 dark:border-white/10 dark:bg-white/5">
                    <div>
                      <p className="font-medium text-neutral-950 dark:text-white">Two-factor authentication</p>
                      <p className="text-sm text-neutral-500">
                        {twoFactorEnabled ? "On for this browser session." : "Adds a second check when you sign in."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full ${twoFactorEnabled ? "bg-[#E4F56C]" : "bg-neutral-300 dark:bg-white/20"}`}
                      aria-pressed={twoFactorEnabled}
                    >
                      <span className={`inline-block h-5 w-5 rounded-full bg-neutral-950 transition-transform ${twoFactorEnabled ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-[22px] border border-neutral-200 bg-neutral-50 p-5 dark:border-white/10 dark:bg-white/5">
                    <div>
                      <p className="font-medium text-neutral-950 dark:text-white">Security email alerts</p>
                      <p className="text-sm text-neutral-500">Notices when something unusual happens on the account.</p>
                    </div>
                    <a href="/settings/notifications" className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-800 dark:border-white/10 dark:text-white">
                      Configure
                    </a>
                  </div>

                  <div className="rounded-[22px] border border-red-200 bg-red-50 p-5 dark:border-red-900/40 dark:bg-red-950/20">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-neutral-950 dark:text-white">Delete account</p>
                        <p className="text-sm text-neutral-500">Removes this admin account and its data.</p>
                      </div>
                      <button type="button" className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white">
                        Delete account
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "sessions" && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Active sessions</h2>
                      <p className="mt-1 text-sm text-neutral-500">Devices that are signed in with this account.</p>
                    </div>
                    <button type="button" className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white">
                      Sign out other sessions
                    </button>
                  </div>

                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className={`rounded-[22px] border p-4 ${
                          session.current
                            ? "border-[#d5e45c] bg-[#E4F56C]/30"
                            : "border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-white/5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-neutral-950 dark:text-white">{session.device}</p>
                              {session.current && (
                                <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[11px] font-semibold text-white">This device</span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-neutral-500">{session.browser}</p>
                            <p className="mt-1 text-xs text-neutral-400">
                              {session.location} · {session.ip}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium ${session.current ? "text-neutral-950 dark:text-white" : "text-neutral-500"}`}>
                              {session.lastActive}
                            </p>
                            {!session.current && (
                              <button type="button" className="mt-1 text-xs font-semibold text-red-600">
                                Sign out
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-neutral-400">Sessions shown here expire after 30 days without use.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
