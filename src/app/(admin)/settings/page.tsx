"use client";

import { useState, useEffect } from "react";
import PageBreadCrumb from "@/components/common/PageBreadCrumb";
import Input from "@/components/form/input/InputField";
import { useSettings, useUpdateSettings, BusinessSettings, BookingSettings } from "@/hooks/useSettings";

export default function GeneralSettingsPage() {
  const [activeTab, setActiveTab] = useState<"business" | "booking">("business");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data: settings, isLoading, error } = useSettings();
  const updateSettings = useUpdateSettings();

  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>({
    businessName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "Singapore",
    timezone: "Asia/Singapore",
    currency: "SGD",
    language: "en",
  });

  const [bookingSettings, setBookingSettings] = useState<BookingSettings>({
    maxBookingsPerUser: 5,
    cancellationWindow: 24,
    noShowPenalty: true,
    noShowPenaltyTokens: 1,
    waitlistEnabled: true,
    autoConfirmBookings: true,
    reminderHoursBefore: 2,
  });

  // Load settings from API
  useEffect(() => {
    if (settings) {
      if (settings.business) setBusinessSettings(settings.business);
      if (settings.booking) setBookingSettings(settings.booking);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        business: businessSettings,
        booking: bookingSettings,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const tabs = [
    { id: "business", label: "Business Info", icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    )},
    { id: "booking", label: "Booking Rules", icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="General Settings" />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-gray-600 to-gray-800 text-white shadow-lg">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">General Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure your business and system preferences
            </p>
          </div>
        </div>
        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Settings saved successfully
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                      : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-12 dark:border-gray-700 dark:bg-gray-800 flex items-center justify-center">
              <div className="text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading settings...</p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-800 dark:text-red-300">
                Failed to load settings: {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            {/* Business Info Tab */}
            {activeTab === "business" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Business Information</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Basic details about your fitness studio</p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Business Name</label>
                    <Input
                      type="text"
                      value={businessSettings.businessName}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, businessName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                    <Input
                      type="email"
                      value={businessSettings.email}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
                    <Input
                      type="tel"
                      value={businessSettings.phone}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, phone: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                    <Input
                      type="text"
                      value={businessSettings.address}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, address: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">City</label>
                    <Input
                      type="text"
                      value={businessSettings.city}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, city: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Country</label>
                    <select
                      value={businessSettings.country}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, country: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    >
                      <option value="Singapore">Singapore</option>
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Australia">Australia</option>
                      <option value="Germany">Germany</option>
                      <option value="France">France</option>
                      <option value="Spain">Spain</option>
                      <option value="Mexico">Mexico</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Timezone</label>
                    <select
                      value={businessSettings.timezone}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, timezone: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    >
                      <option value="Asia/Singapore">Singapore Time (SGT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="Europe/London">GMT (London)</option>
                      <option value="Europe/Paris">CET (Paris)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
                    <select
                      value={businessSettings.currency}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, currency: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    >
                      <option value="SGD">SGD (S$)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (E)</option>
                      <option value="GBP">GBP (#)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="AUD">AUD ($)</option>
                      <option value="MXN">MXN ($)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Booking Rules Tab */}
            {activeTab === "booking" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Booking Rules</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Configure how class bookings work</p>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Max Bookings Per User</label>
                      <Input
                        type="number"
                        value={bookingSettings.maxBookingsPerUser}
                        onChange={(e) => setBookingSettings({ ...bookingSettings, maxBookingsPerUser: Number(e.target.value) })}
                      />
                      <p className="mt-1 text-xs text-gray-500">Maximum concurrent active bookings allowed</p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Cancellation Window (hours)</label>
                      <Input
                        type="number"
                        value={bookingSettings.cancellationWindow}
                        onChange={(e) => setBookingSettings({ ...bookingSettings, cancellationWindow: Number(e.target.value) })}
                      />
                      <p className="mt-1 text-xs text-gray-500">Hours before class for free cancellation</p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Reminder Time (hours before)</label>
                      <Input
                        type="number"
                        value={bookingSettings.reminderHoursBefore}
                        onChange={(e) => setBookingSettings({ ...bookingSettings, reminderHoursBefore: Number(e.target.value) })}
                      />
                      <p className="mt-1 text-xs text-gray-500">When to send booking reminders</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Auto-confirm Bookings</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Automatically confirm bookings when made</p>
                      </div>
                      <button
                        onClick={() => setBookingSettings({ ...bookingSettings, autoConfirmBookings: !bookingSettings.autoConfirmBookings })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          bookingSettings.autoConfirmBookings ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          bookingSettings.autoConfirmBookings ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Enable Waitlist</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Allow users to join waitlist for full classes</p>
                      </div>
                      <button
                        onClick={() => setBookingSettings({ ...bookingSettings, waitlistEnabled: !bookingSettings.waitlistEnabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          bookingSettings.waitlistEnabled ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          bookingSettings.waitlistEnabled ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">No-Show Penalty</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Charge tokens for no-shows</p>
                        </div>
                        <button
                          onClick={() => setBookingSettings({ ...bookingSettings, noShowPenalty: !bookingSettings.noShowPenalty })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            bookingSettings.noShowPenalty ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            bookingSettings.noShowPenalty ? "translate-x-6" : "translate-x-1"
                          }`} />
                        </button>
                      </div>
                      {bookingSettings.noShowPenalty && (
                        <div className="mt-4">
                          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Penalty Amount (tokens)</label>
                          <Input
                            type="number"
                            value={bookingSettings.noShowPenaltyTokens}
                            onChange={(e) => setBookingSettings({ ...bookingSettings, noShowPenaltyTokens: Number(e.target.value) })}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* Save Button */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateSettings.isPending || isLoading}
                className="px-6 py-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {updateSettings.isPending ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
              {updateSettings.isError && (
                <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {updateSettings.error?.message || "Failed to save settings"}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
