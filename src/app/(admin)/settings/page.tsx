"use client";

import { useState, useEffect } from "react";
import StudioDate from "@/components/ui/StudioDate";
import StudioMenu from "@/components/ui/StudioMenu";
import { useSettings, useUpdateSettings, BusinessSettings, BookingSettings } from "@/hooks/useSettings";
import { usePromotionsSettings, useUpdatePromotionsSettings, type PromotionsSettings } from "@/hooks/usePromotions";
import { useOnboarding } from "@/components/onboarding";

const card = "rounded-[28px] border border-neutral-200/80 bg-white shadow-[0_10px_30px_rgba(16,24,40,0.05)] dark:border-white/10 dark:bg-gray-800";
const field = "h-11 w-full rounded-full border border-neutral-200 bg-white px-4 text-sm text-neutral-950 outline-none placeholder:text-neutral-400 dark:border-white/10 dark:bg-gray-800 dark:text-white";
const label = "mb-2 block text-sm font-medium text-neutral-800 dark:text-white/90";
const hint = "mt-1 text-xs text-neutral-400";

const countries = ["Singapore", "United States", "Canada", "United Kingdom", "Australia", "Germany", "France", "Spain", "Mexico"].map((value) => ({ value, label: value }));
const timezones = [
  { value: "Asia/Singapore", label: "Singapore Time (SGT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "Europe/London", label: "GMT (London)" },
  { value: "Europe/Paris", label: "CET (Paris)" },
];
const currencies = [
  { value: "SGD", label: "SGD (S$)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "CAD", label: "CAD ($)" },
  { value: "AUD", label: "AUD ($)" },
  { value: "MXN", label: "MXN ($)" },
];

export default function GeneralSettingsPage() {
  const [activeTab, setActiveTab] = useState<"business" | "booking" | "promotions">("business");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { restart: restartOnboarding } = useOnboarding();

  const { data: settings, isLoading, error } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: promoSettings, isLoading: promoLoading, error: promoError } = usePromotionsSettings();
  const updatePromoSettings = useUpdatePromotionsSettings();

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

  const [promotionSettings, setPromotionSettings] = useState<PromotionsSettings>({
    early_bird_enabled: true,
    early_bird_limit: 40,
    early_bird_discount_percent: 10,
    early_bird_validity_months: 2,
    referral_enabled: true,
    referral_discount_percent: 8,
    duo_promo_active: true,
    duo_indoor_price_cents: 2300,
    duo_outdoor_price_cents: 3500,
    duo_booking_mode: "pay_online",
    duo_payment_terms: "full",
    duo_deposit_percent: 50,
    duo_end_date: "",
    duo_outdoor_quick_join_mode: "auto",
    duo_start_page_mode: "quick_join",
  });

  // Load settings from API
  useEffect(() => {
    if (settings) {
      if (settings.business) setBusinessSettings(settings.business);
      if (settings.booking) setBookingSettings(settings.booking);
    }
  }, [settings]);

  useEffect(() => {
    if (promoSettings) {
      setPromotionSettings(promoSettings);
    }
  }, [promoSettings]);

  const handleSave = async () => {
    try {
      if (activeTab === "promotions") {
        await updatePromoSettings.mutateAsync(promotionSettings);
      } else {
        await updateSettings.mutateAsync({
          business: businessSettings,
          booking: bookingSettings,
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleCancel = () => {
    if (activeTab === "promotions" && promoSettings) setPromotionSettings(promoSettings);
    if (settings?.business) setBusinessSettings(settings.business);
    if (settings?.booking) setBookingSettings(settings.booking);
  };

  const saving = activeTab === "promotions" ? updatePromoSettings.isPending : updateSettings.isPending;
  const tabs = [
    { id: "business" as const, label: "Business" },
    { id: "booking" as const, label: "Booking rules" },
    { id: "promotions" as const, label: "Promotions" },
  ];

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white sm:text-3xl">Settings</h1>
          <p className="mt-1 max-w-xl text-sm text-neutral-500">
            Studio details, booking rules, and promotions. {saveSuccess ? "Saved." : "Save when you are done with this section."}
          </p>
        </div>
        <button type="button" onClick={restartOnboarding} className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-semibold text-neutral-700 dark:bg-white/10 dark:text-white">
          Restart tour
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${activeTab === tab.id ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950" : "bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-white"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
          {isLoading || promoLoading ? (
            <div className={`${card} h-64 animate-pulse`} />
          ) : error || promoError ? (
            <div className={`${card} px-6 py-8 text-sm text-red-600`}>
              Could not load settings. {error instanceof Error ? error.message : promoError instanceof Error ? promoError.message : ""}
            </div>
          ) : (
          <div className={`${card} p-5 sm:p-6`}>
            {/* Business Info Tab */}
            {activeTab === "business" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Business</h2>
                  <p className="mt-1 text-sm text-neutral-500">Name, contact, and how prices are shown.</p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={label}>Business Name</label>
                    <input className={field}
                      type="text"
                      value={businessSettings.businessName}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, businessName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className={label}>Email Address</label>
                    <input className={field}
                      type="email"
                      value={businessSettings.email}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className={label}>Phone Number</label>
                    <input className={field}
                      type="tel"
                      value={businessSettings.phone}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, phone: e.target.value })}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={label}>Address</label>
                    <input className={field}
                      type="text"
                      value={businessSettings.address}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, address: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className={label}>City</label>
                    <input className={field}
                      type="text"
                      value={businessSettings.city}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, city: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className={label}>Country</label>
                    <StudioMenu value={businessSettings.country} onChange={(value) => setBusinessSettings({ ...businessSettings, country: value })} placeholder="Country" options={countries} />
                  </div>

                  <div>
                    <label className={label}>Timezone</label>
                    <StudioMenu value={businessSettings.timezone} onChange={(value) => setBusinessSettings({ ...businessSettings, timezone: value })} placeholder="Timezone" options={timezones} />
                  </div>

                  <div>
                    <label className={label}>Currency</label>
                    <StudioMenu value={businessSettings.currency} onChange={(value) => setBusinessSettings({ ...businessSettings, currency: value })} placeholder="Currency" options={currencies} />
                  </div>
                </div>
              </div>
            )}

            {/* Booking Rules Tab */}
            {activeTab === "booking" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Booking rules</h2>
                  <p className="mt-1 text-sm text-neutral-500">How class bookings, reminders, and no-shows work.</p>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className={label}>Max Bookings Per User</label>
                      <input className={field}
                        type="number"
                        value={bookingSettings.maxBookingsPerUser}
                        onChange={(e) => setBookingSettings({ ...bookingSettings, maxBookingsPerUser: Number(e.target.value) })}
                      />
                      <p className={hint}>Maximum concurrent active bookings allowed</p>
                    </div>

                    <div>
                      <label className={label}>Cancellation Window (hours)</label>
                      <input className={field}
                        type="number"
                        value={bookingSettings.cancellationWindow}
                        onChange={(e) => setBookingSettings({ ...bookingSettings, cancellationWindow: Number(e.target.value) })}
                      />
                      <p className={hint}>Hours before class for free cancellation</p>
                    </div>

                    <div>
                      <label className={label}>Reminder Time (hours before)</label>
                      <input className={field}
                        type="number"
                        value={bookingSettings.reminderHoursBefore}
                        onChange={(e) => setBookingSettings({ ...bookingSettings, reminderHoursBefore: Number(e.target.value) })}
                      />
                      <p className={hint}>When to send booking reminders</p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 dark:bg-white/5">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Auto-confirm Bookings</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Automatically confirm bookings when made</p>
                      </div>
                      <button
                        onClick={() => setBookingSettings({ ...bookingSettings, autoConfirmBookings: !bookingSettings.autoConfirmBookings })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          bookingSettings.autoConfirmBookings ? "bg-[#E4F56C]" : "bg-neutral-200 dark:bg-white/15"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-neutral-950 transition-transform ${
                          bookingSettings.autoConfirmBookings ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 dark:bg-white/5">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Enable Waitlist</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Allow users to join waitlist for full classes</p>
                      </div>
                      <button
                        onClick={() => setBookingSettings({ ...bookingSettings, waitlistEnabled: !bookingSettings.waitlistEnabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          bookingSettings.waitlistEnabled ? "bg-[#E4F56C]" : "bg-neutral-200 dark:bg-white/15"
                        }`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-neutral-950 transition-transform ${
                          bookingSettings.waitlistEnabled ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-white/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">No-Show Penalty</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Charge tokens for no-shows</p>
                        </div>
                        <button
                          onClick={() => setBookingSettings({ ...bookingSettings, noShowPenalty: !bookingSettings.noShowPenalty })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            bookingSettings.noShowPenalty ? "bg-[#E4F56C]" : "bg-neutral-200 dark:bg-white/15"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-neutral-950 transition-transform ${
                            bookingSettings.noShowPenalty ? "translate-x-6" : "translate-x-1"
                          }`} />
                        </button>
                      </div>
                      {bookingSettings.noShowPenalty && (
                        <div className="mt-4">
                          <label className={label}>Penalty Amount (tokens)</label>
                          <input className={field}
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

            {/* Promotions Tab */}
            {activeTab === "promotions" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-sm font-medium text-neutral-800 dark:text-white/90">Promotions</h2>
                  <p className="mt-1 text-sm text-neutral-500">Early bird, referrals, and the 1-for-1 trial.</p>
                </div>

                <div className="space-y-6">
                  {/* Early Bird Section */}
                  <div className="rounded-[22px] border border-neutral-200 bg-neutral-50 p-5 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Early Bird Program</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Offer discounts to new users during their first months</p>
                      </div>
                      <button
                        onClick={() => setPromotionSettings({ ...promotionSettings, early_bird_enabled: !promotionSettings.early_bird_enabled })}
                        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                          promotionSettings.early_bird_enabled ? "bg-[#E4F56C]" : "bg-neutral-200 dark:bg-white/15"
                        }`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-neutral-950 transition-transform ${
                          promotionSettings.early_bird_enabled ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </button>
                    </div>

                    {promotionSettings.early_bird_enabled && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className={label}>User Limit</label>
                            <input className={field}
                              type="number"
                              min="0"
                              value={promotionSettings.early_bird_limit}
                              onChange={(e) => setPromotionSettings({ ...promotionSettings, early_bird_limit: Number(e.target.value) })}
                            />
                            <p className={hint}>Maximum number of users eligible for early bird discount</p>
                          </div>

                          <div>
                            <label className={label}>Discount Percentage</label>
                            <div className="flex items-center gap-2">
                              <input className={field}
                                type="number"
                                min="0"
                                max="100"
                                value={promotionSettings.early_bird_discount_percent}
                                onChange={(e) => setPromotionSettings({ ...promotionSettings, early_bird_discount_percent: Number(e.target.value) })}
                              />
                              <span className="text-sm text-gray-500">%</span>
                            </div>
                            <p className={hint}>Discount offered to early bird users</p>
                          </div>

                          <div className="sm:col-span-2">
                            <label className={label}>Validity Period (Months)</label>
                            <input className={field}
                              type="number"
                              min="1"
                              value={promotionSettings.early_bird_validity_months}
                              onChange={(e) => setPromotionSettings({ ...promotionSettings, early_bird_validity_months: Number(e.target.value) })}
                            />
                            <p className={hint}>How long the early bird discount is valid after registration</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Referral Section */}
                  <div className="rounded-[22px] border border-neutral-200 bg-neutral-50 p-5 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Referral Program</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Reward users for referring friends to One Step Fitness</p>
                      </div>
                      <button
                        onClick={() => setPromotionSettings({ ...promotionSettings, referral_enabled: !promotionSettings.referral_enabled })}
                        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                          promotionSettings.referral_enabled ? "bg-[#E4F56C]" : "bg-neutral-200 dark:bg-white/15"
                        }`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-neutral-950 transition-transform ${
                          promotionSettings.referral_enabled ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </button>
                    </div>

                    {promotionSettings.referral_enabled && (
                      <div className="space-y-4">
                        <div>
                          <label className={label}>Discount Percentage</label>
                          <div className="flex items-center gap-2">
                            <input className={field}
                              type="number"
                              min="0"
                              max="100"
                              value={promotionSettings.referral_discount_percent}
                              onChange={(e) => setPromotionSettings({ ...promotionSettings, referral_discount_percent: Number(e.target.value) })}
                            />
                            <span className="text-sm text-gray-500">%</span>
                          </div>
                          <p className={hint}>Discount amount for referred users</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Duo Trial (1-for-1) Section */}
                  <div className="rounded-[22px] border border-neutral-200 bg-neutral-50 p-5 dark:border-white/10 dark:bg-white/5">
                    <div className="mb-6 border-b border-neutral-200 pb-6 dark:border-white/10">
                      <label className={label}>/start sales page booking</label>
                      <StudioMenu
                        value={promotionSettings.duo_start_page_mode}
                        onChange={(value) => setPromotionSettings({ ...promotionSettings, duo_start_page_mode: value as PromotionsSettings["duo_start_page_mode"] })}
                        placeholder="Start page"
                        options={[
                          { value: "quick_join", label: "1-for-1 quick book" },
                          { value: "trial", label: "Fast trial" },
                        ]}
                      />
                      <p className={hint}>
                        Controls the /start page. Fast trial uses the short pay-first form; visitors who want to pick a class themselves can use full trial booking at /trial-booking.
                      </p>
                    </div>

                    <div className="flex items-start justify-between mb-6">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Duo Trial (1-for-1)</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">The studio &amp; outdoor 1-for-1 promo shown on the public /promos page</p>
                      </div>
                      <button
                        onClick={() => setPromotionSettings({ ...promotionSettings, duo_promo_active: !promotionSettings.duo_promo_active })}
                        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                          promotionSettings.duo_promo_active ? "bg-[#E4F56C]" : "bg-neutral-200 dark:bg-white/15"
                        }`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-neutral-950 transition-transform ${
                          promotionSettings.duo_promo_active ? "translate-x-6" : "translate-x-1"
                        }`} />
                      </button>
                    </div>

                    {promotionSettings.duo_promo_active && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className={label}>Studio (indoor) price</label>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">$</span>
                              <input className={field}
                                type="number"
                                min="1"
                                step="0.01"
                                value={promotionSettings.duo_indoor_price_cents / 100}
                                onChange={(e) => setPromotionSettings({ ...promotionSettings, duo_indoor_price_cents: Math.round((Number(e.target.value) || 0) * 100) })}
                              />
                            </div>
                            <p className={hint}>Total price for two people (1-for-1)</p>
                          </div>

                          <div>
                            <label className={label}>Outdoor price</label>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">$</span>
                              <input className={field}
                                type="number"
                                min="1"
                                step="0.01"
                                value={promotionSettings.duo_outdoor_price_cents / 100}
                                onChange={(e) => setPromotionSettings({ ...promotionSettings, duo_outdoor_price_cents: Math.round((Number(e.target.value) || 0) * 100) })}
                              />
                            </div>
                            <p className={hint}>e.g. OCBC Arena, Kallang</p>
                          </div>

                          <div>
                            <label className={label}>Outdoor on /start page</label>
                            <StudioMenu
                              value={promotionSettings.duo_outdoor_quick_join_mode}
                              onChange={(value) => setPromotionSettings({ ...promotionSettings, duo_outdoor_quick_join_mode: value as PromotionsSettings["duo_outdoor_quick_join_mode"] })}
                              placeholder="Outdoor on /start"
                              options={[
                                { value: "auto", label: "Auto, when outdoor classes exist" },
                                { value: "on", label: "Always show" },
                                { value: "off", label: "Never show" },
                              ]}
                            />
                            <p className={hint}>Controls the outdoor option on the quick sales /start page</p>
                          </div>

                          <div>
                            <label className={label}>Booking mode</label>
                            <StudioMenu
                              value={promotionSettings.duo_booking_mode}
                              onChange={(value) => setPromotionSettings({ ...promotionSettings, duo_booking_mode: value as PromotionsSettings["duo_booking_mode"] })}
                              placeholder="Booking mode"
                              options={[
                                { value: "pay_online", label: "Pay online only" },
                                { value: "reserve_only", label: "Reserve and pay at the studio" },
                                { value: "both", label: "Pay online or reserve" },
                              ]}
                            />
                            <p className={hint}>How visitors confirm their spot</p>
                          </div>

                          <div>
                            <label className={label}>Payment terms</label>
                            <StudioMenu
                              value={promotionSettings.duo_payment_terms}
                              onChange={(value) => setPromotionSettings({ ...promotionSettings, duo_payment_terms: value as PromotionsSettings["duo_payment_terms"] })}
                              placeholder="Payment terms"
                              options={[
                                { value: "full", label: "Pay in full online" },
                                { value: "deposit", label: "Pay a deposit online" },
                                { value: "none", label: "Pay at the studio" },
                              ]}
                            />
                            <p className={hint}>How much they pay online now</p>
                          </div>

                          {promotionSettings.duo_payment_terms === "deposit" && (
                            <div>
                              <label className={label}>Deposit %</label>
                              <div className="flex items-center gap-2">
                                <input className={field}
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={promotionSettings.duo_deposit_percent}
                                  onChange={(e) => setPromotionSettings({ ...promotionSettings, duo_deposit_percent: Number(e.target.value) })}
                                />
                                <span className="text-sm text-gray-500">%</span>
                              </div>
                              <p className={hint}>50% = half now, half at studio</p>
                            </div>
                          )}

                          <div>
                            <label className={label}>Promo end date</label>
                            <StudioDate
                              block
                              clearable
                              ariaLabel="Promo end date"
                              placeholder="No expiry"
                              value={promotionSettings.duo_end_date}
                              onChange={(value) => setPromotionSettings({ ...promotionSettings, duo_end_date: value })}
                            />
                            <p className={hint}>Leave blank for no expiry</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}


            {/* Save Button */}
            <div className="mt-8 flex flex-col items-stretch gap-3 border-t border-neutral-200 pt-6 dark:border-white/10 sm:flex-row sm:justify-end">
              {(updateSettings.isError || updatePromoSettings.isError) && (
                <p className="text-sm text-red-600 sm:mr-auto">{updateSettings.error?.message || updatePromoSettings.error?.message || "Could not save"}</p>
              )}
              <button type="button" onClick={handleCancel} className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 dark:border-white/10 dark:text-white">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || isLoading || promoLoading}
                className="rounded-full bg-[#E4F56C] px-5 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
          )}
      </div>
    </div>
  );
}
