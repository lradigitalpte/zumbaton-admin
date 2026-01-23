"use client";

import { useState, useEffect } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import { api } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Mail, Calendar, Sparkles } from "lucide-react";

interface BirthdayUser {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string;
  nextBirthday: string;
  age: number;
  isToday: boolean;
  daysUntil: number;
}

export default function CelebratePage() {
  const [birthdays, setBirthdays] = useState<BirthdayUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "today" | "upcoming">("all");
  const toast = useToast();

  useEffect(() => {
    fetchBirthdays();
  }, [filter]);

  const fetchBirthdays = async () => {
    try {
      setLoading(true);
      const url =
        filter === "today"
          ? "/api/users/birthdays?today=true"
          : "/api/users/birthdays";
      const response = await api.get<{ success: boolean; data: BirthdayUser[] }>(url);

      if (response.error) {
        throw new Error(response.error.message || "Failed to fetch birthdays");
      }

      let data = response.data?.data || [];
      
      if (filter === "upcoming") {
        // Filter to show only upcoming birthdays (next 30 days)
        const today = new Date();
        data = data.filter((user) => {
          const nextBirthday = new Date(user.nextBirthday);
          const daysDiff = Math.ceil(
            (nextBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysDiff >= 0 && daysDiff <= 30;
        });
      }

      setBirthdays(data);
    } catch (error) {
      console.error("Error fetching birthdays:", error);
      toast.showToast("Failed to load birthdays", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendBirthdayEmail = async (userId: string, userName: string) => {
    try {
      setSendingEmail(userId);
      const response = await api.post<{
        success: boolean;
        message?: string;
        error?: { message: string };
      }>("/api/users/birthdays/send", { userId });

      if (response.error) {
        throw new Error(response.error.message || "Failed to send email");
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error?.message || "Failed to send email");
      }

      toast.showToast(`Birthday message sent to ${userName}`, "success");
    } catch (error) {
      console.error("Error sending birthday email:", error);
      toast.showToast("Failed to send email", "error");
    } finally {
      setSendingEmail(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysUntilText = (daysUntil: number, isToday: boolean) => {
    if (isToday) return "Today! 🎉";
    if (daysUntil === 0) return "Today! 🎉";
    if (daysUntil === 1) return "Tomorrow";
    if (daysUntil <= 7) return `In ${daysUntil} days`;
    if (daysUntil <= 30) return `In ${daysUntil} days`;
    return `In ${daysUntil} days`;
  };

  const todayBirthdays = birthdays.filter((b) => b.isToday);
  const upcomingBirthdays = birthdays.filter((b) => !b.isToday && b.daysUntil <= 30);

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="Celebrate" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Celebrate Birthdays
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Send birthday wishes to your users
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Today's Birthdays
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {todayBirthdays.length}
              </p>
            </div>
            <div className="rounded-full bg-pink-100 p-3 dark:bg-pink-900/30">
              <Calendar className="h-6 w-6 text-pink-600 dark:text-pink-400" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Upcoming (30 days)
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {upcomingBirthdays.length}
              </p>
            </div>
            <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
              <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Users
              </p>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                {birthdays.length}
              </p>
            </div>
            <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900/30">
              <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          All Birthdays
        </button>
        <button
          onClick={() => setFilter("today")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === "today"
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          Today
        </button>
        <button
          onClick={() => setFilter("upcoming")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === "upcoming"
              ? "bg-indigo-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          Upcoming (30 days)
        </button>
      </div>

      {/* Birthdays List */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Loading birthdays...
              </p>
            </div>
          </div>
        ) : birthdays.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              No birthdays found
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {filter === "today"
                ? "No birthdays today. Check back tomorrow!"
                : filter === "upcoming"
                ? "No upcoming birthdays in the next 30 days."
                : "No users have birthday dates set."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {birthdays.map((user) => (
              <div
                key={user.id}
                className={`p-6 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                  user.isToday ? "bg-pink-50 dark:bg-pink-900/10" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {user.name}
                      </h3>
                      {user.isToday && (
                        <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-semibold text-pink-700 dark:bg-pink-900/30 dark:text-pink-400">
                          🎉 Today!
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Email:</span> {user.email}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Birthday:</span>{" "}
                        {formatDate(user.dateOfBirth)}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Next Birthday:</span>{" "}
                        {formatDate(user.nextBirthday)} ({getDaysUntilText(user.daysUntil, user.isToday)})
                      </p>
                      {user.age > 0 && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Age:</span> {user.age} years old
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => handleSendBirthdayEmail(user.id, user.name)}
                      disabled={sendingEmail === user.id}
                      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                    >
                      {sendingEmail === user.id ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4" />
                          Send Birthday Email
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
