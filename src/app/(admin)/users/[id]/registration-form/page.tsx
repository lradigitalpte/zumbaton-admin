'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'

interface RegistrationFormData {
  id: string
  user_id: string
  full_name_nric: string
  residential_address: string
  postal_code: string
  date_of_birth: string
  email: string
  phone: string
  gender: string | null
  blood_group: string
  emergency_contact: string
  emergency_contact_phone: string
  parent_guardian_name: string | null
  parent_guardian_signature: string | null
  parent_guardian_date: string | null
  member_signature: string
  terms_accepted: boolean
  media_consent: boolean
  staff_name: string | null
  staff_signature: string | null
  staff_signature_date: string | null
  created_at: string
  updated_at: string
  user: {
    id: string
    name: string
    email: string
    phone: string
  }
}

export default function ViewRegistrationForm() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  const toast = useToast()

  const [formData, setFormData] = useState<RegistrationFormData | null>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [staffSignature, setStaffSignature] = useState('')
  const [showTerms, setShowTerms] = useState(false)
  const [webAppUrl, setWebAppUrl] = useState('http://localhost:3000')

  // Detect environment on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      setWebAppUrl(isDevelopment ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_WEB_URL || 'https://zumbaton.sg'))
    }
  }, [])

  useEffect(() => {
    fetchFormData()
  }, [userId])

  const fetchFormData = async () => {
    try {
      setLoading(true)
      
      // Get session for auth
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.showToast('Please sign in to view registration forms', 'error')
        router.back()
        return
      }

      const response = await fetch(`/api/registration-form/view/${userId}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      const result = await response.json()

      if (result.success && result.data) {
        setFormData(result.data)
      } else {
        toast.showToast(result.error || 'Failed to load registration form', 'error')
        router.back()
      }
    } catch (error) {
      console.error('Error fetching form:', error)
      toast.showToast('An error occurred while loading the form', 'error')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const handleSign = async () => {
    if (!staffSignature.trim() || staffSignature.trim().length < 3) {
      toast.showToast('Please enter your full name (minimum 3 characters)', 'error')
      return
    }

    if (!formData) return

    try {
      setSigning(true)
      
      // Get session for auth
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.showToast('Please sign in to sign forms', 'error')
        return
      }

      const response = await fetch(`/api/registration-form/sign/${formData.id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ staffName: staffSignature.trim() }),
      })

      const result = await response.json()

      if (result.success) {
        toast.showToast('Signature saved successfully!', 'success')
        // Refresh form data to show signature
        await fetchFormData()
      } else {
        toast.showToast(result.error || 'Failed to save signature', 'error')
      }
    } catch (error) {
      console.error('Error signing form:', error)
      toast.showToast('An error occurred while saving signature', 'error')
    } finally {
      setSigning(false)
    }
  }

  const handleSendEmail = async () => {
    if (!formData) return

    try {
      setSendingEmail(true)
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.showToast('Please sign in to send emails', 'error')
        return
      }
      
      console.log('[Send Email] Calling admin API with formId:', formData.id)
      
      // Call the ADMIN's send-pdf API (not the web app's)
      const response = await fetch(`/api/registration-form/send-pdf`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          formId: formData.id,
          includeAdminCopy: true,
          adminEmail: session.user.email
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast.showToast('PDF sent successfully to user and you!', 'success')
      } else {
        toast.showToast('Failed to send email: ' + (result.error || 'Unknown error'), 'error')
      }
    } catch (error) {
      console.error('Error sending email:', error)
      toast.showToast('An error occurred while sending email', 'error')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleDownload = async () => {
    if (!formData) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.showToast('Please sign in to download PDFs', 'error')
        return
      }

      console.log('[Download PDF] Downloading form:', formData.id)

      const response = await fetch(`/api/registration-form/download-pdf?formId=${formData.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        toast.showToast('Failed to download: ' + (error.error || 'Unknown error'), 'error')
        return
      }

      // Get the PDF blob
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `zumbaton-registration-${formData.full_name_nric.replace(/\s+/g, '-')}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.showToast('PDF downloaded successfully!', 'success')
    } catch (error) {
      console.error('Error downloading PDF:', error)
      toast.showToast('An error occurred while downloading PDF', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-gray-600">Loading registration form...</p>
        </div>
      </div>
    )
  }

  if (!formData) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">No registration form found for this user.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded-md bg-gray-200 px-4 py-2 hover:bg-gray-300"
        >
          Go Back
        </button>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-SG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const isAlreadySigned = !!formData.staff_signature

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to User Profile
          </button>
        </div>

        {/* Document Container */}
        <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200">
          {/* Document Header */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">ZUMBATON</h1>
                <p className="text-green-100 text-lg">Membership Registration Form</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-100">Submitted</p>
                <p className="text-xl font-semibold">{formatDate(formData.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Status Banner */}
          {isAlreadySigned ? (
            <div className="bg-green-50 border-b-4 border-green-500 px-8 py-4">
              <div className="flex items-center gap-3">
                <div className="bg-green-500 rounded-full p-2">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-green-900 text-lg">Form Completed</p>
                  <p className="text-sm text-green-700">
                    Signed by <span className="font-semibold">{formData.staff_name}</span> on {formatDate(formData.staff_signature_date!)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border-b-4 border-yellow-500 px-8 py-4">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-500 rounded-full p-2">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-yellow-900 text-lg">Awaiting Staff Signature</p>
                  <p className="text-sm text-yellow-700">This form requires staff signature to complete registration</p>
                </div>
              </div>
            </div>
          )}

          {/* Form Content */}
          <div className="p-8 space-y-8">
            {/* Section 1: Personal Information */}
            <div className="border-l-4 border-purple-500 pl-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                Personal Information
              </h2>
              <div className="bg-gray-50 rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Name (NRIC)</label>
                  <p className="mt-1 text-base text-gray-900 font-medium">{formData.full_name_nric}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date of Birth</label>
                  <p className="mt-1 text-base text-gray-900 font-medium">{formatDate(formData.date_of_birth)}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                  <p className="mt-1 text-base text-gray-900 font-medium">{formData.email}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</label>
                  <p className="mt-1 text-base text-gray-900 font-medium">{formData.phone}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Gender</label>
                  <p className="mt-1 text-base text-gray-900 font-medium">{formData.gender || 'Not specified'}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Blood Group</label>
                  <p className="mt-1 text-base text-gray-900 font-medium">{formData.blood_group}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Postal Code</label>
                  <p className="mt-1 text-base text-gray-900 font-medium">{formData.postal_code}</p>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Residential Address</label>
                  <p className="mt-1 text-base text-gray-900 font-medium">{formData.residential_address}</p>
                </div>
              </div>
            </div>

            {/* Section 2: Emergency Contact */}
            <div className="border-l-4 border-red-500 pl-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                Emergency Contact
              </h2>
              <div className="bg-gray-50 rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact Name</label>
                  <p className="mt-1 text-base text-gray-900 font-medium">{formData.emergency_contact}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact Phone</label>
                  <p className="mt-1 text-base text-gray-900 font-medium">{formData.emergency_contact_phone}</p>
                </div>
              </div>
            </div>

            {/* Section 3: Parent/Guardian (if applicable) */}
            {formData.parent_guardian_name && (
              <div className="border-l-4 border-blue-500 pl-4">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  Parent/Guardian Information
                </h2>
                <div className="bg-blue-50 rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Name</label>
                    <p className="mt-1 text-base text-gray-900 font-medium">{formData.parent_guardian_name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Signature</label>
                    <p className="mt-1 text-lg text-gray-900 font-semibold italic">{formData.parent_guardian_signature}</p>
                  </div>
                  {formData.parent_guardian_date && (
                    <div>
                      <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Date</label>
                      <p className="mt-1 text-base text-gray-900 font-medium">
                      {formatDate(formData.parent_guardian_date)}
                    </p>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Section 4: Terms & Conditions */}
            <div className="border-l-4 border-amber-500 pl-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-6 h-6 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  Terms & Conditions
                </h2>
                <button
                  onClick={() => setShowTerms(!showTerms)}
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
                >
                  {showTerms ? 'Hide' : 'Show Full Terms'}
                  <svg className={`w-4 h-4 transition-transform ${showTerms ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              {showTerms && (
                <div className="bg-amber-50 rounded-lg p-6 max-h-[600px] overflow-y-auto border border-amber-200">
                  <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
                    <h3 className="font-bold text-gray-900 text-lg">MEMBER ASSUMPTION OF RISK AND RELEASE</h3>
                    <p>I hereby understand and acknowledge the risk of injury arising from and/or in connection with ZUMBATON's activities. I willingly assume all the risks associated with the exercise choreographed. I understand that ZUMBATON is independently owned and operated. I HEREBY RELEASE, INDEMNIFY, AND HOLD HARMLESS to ZUMBATON's employees, owners, and partners WITH RESPECT TO ANY AND ALL INJURY, DISABILITY, DEATH, LOSS OR DAMAGE to person and/or property that may arise out of or in connection with my use of the studio, or otherwise related to my subscription. I expressly agree that this release is intended to be as broad and inclusive as permitted by applicable law and if a portion of this release is held invalid, the balance shall remain in full force and effect.</p>

                    <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 my-4">
                      <p className="font-bold">IF YOU ARE AGED BETWEEN 5 – 15 THE CONSENT OF A PARENT/GUARDIAN IS REQUIRED UPON JOINING AND A PARENT/GUARDIAN MUST BE PRESENT DURING CLASSES</p>
                      <p className="mt-2">I am the parent/guardian of the above. I acknowledge that: The above has my express permission to participate in the ZUMBATON activities. The above and I have read and understood the Terms and Conditions & Safety Notices. By signing, I am agreeing to be bound along with the above by the Terms and Conditions, including Safety Notices.</p>
                    </div>

                    <h3 className="font-bold text-gray-900 text-lg mt-6">1. TERMS AND CONDITIONS</h3>
                    <p>1.1. The following terms and conditions govern the rights and obligations of ZUMBATON members thereof. It is important that you have read and understood all the terms and conditions stated herein before signing this Agreement. Each member who signs below will be individually and severally bound by this Agreement.</p>

                    <h3 className="font-bold text-gray-900 text-lg mt-6">2. MEMBERSHIP</h3>
                    <p>2.1. Members who are under the age of 16 years, you confirm that you have the express permission of your parent/guardian to join ZUMBATON and use the facilities and services available. All references to "you" or "your" in this Agreement will denote you and/or your parent/guardian on behalf of you.</p>
                    <p>2.2. Membership is personal to the member and is non-transferable and non-refundable. You may not loan or sell your membership or otherwise permit it to be used by any third party. You may be charged with a fine depending on the sessions being misused. ZUMBATON's management may assign the benefit of this Agreement to any person at any time with notice to the individual.</p>

                    <h3 className="font-bold text-gray-900 text-lg mt-6">3. FREEZING, SUSPENSION, CANCELLATION AND/OR TERMINATION OF THE MEMBERSHIP</h3>
                    <p>3.1. Medical Cancellation: Subject to Clause, you may cancel and/or terminate this Agreement for medical reasons. If you wish to cancel and/or terminate the membership due to medical reasons, your doctor must provide the relevant certification(s) indicating that your participation in ZUMBATON step aerobics activities would impair your health.</p>
                    <p>3.2. In the event of death or disability, the liability for membership will terminate as at the date of death or disability.</p>
                    <p>3.3. If the Club's facilities become temporarily unavailable due to an event such as a fire, flood, loss of lease, or the like, we may freeze your membership for the period the facilities were unavailable.</p>
                    <p>3.4. Cancellation of class after booking should be made at least 24 hours before the class date. Booked class with a "NO SHOW" will be forfeited.</p>
                    <p>3.5. Zumbaton Management Team retains the sole and absolute right to cancel, freeze and/or suspend the membership of any person for any reason. If such cancellation and/or suspension is made due to a breach of any of the terms of this Agreement, including the Membership Policies and Safety Notices, or due to damage caused by you, the balance of your financial obligations under this Agreement shall become immediately due and payable.</p>

                    <h3 className="font-bold text-gray-900 text-lg mt-6">4. PHYSICAL CONDITION OF MEMBER</h3>
                    <p>4.1. You hereby warrant and represent that you are in good physical and/or mental condition and that you know of no medical or any other reason why you are not capable of engaging in active or passive exercise and that such exercise would not be detrimental to your health and/or safety and/or comfort and/or physical condition.</p>
                    <p>4.2. Further, you also acknowledge that you hereby agree to carry out exercises responsibly and with due care and attention to your own medical, health and mental condition at all times. You understand and acknowledge all risks of injury arising from the exercises.</p>

                    <h3 className="font-bold text-gray-900 text-lg mt-6">5. ATTIRE & SAFETY</h3>
                    <p>5.1. You are required to wear covered shoes excluding boots for all ZUMBATON sessions regardless indoors or outdoors.</p>
                    <p>5.2. It will be highly recommended to wear active sportswear & bring bottled water for water breaks & hydration purposes.</p>

                    <h3 className="font-bold text-gray-900 text-lg mt-6">6. MEDIA CONSENT</h3>
                    <p>6.1. To participate in the production of media which may be used to show image, likeness, voice, performance and visual works which may be personally identifiable to the general public when published on social media.</p>

                    <h3 className="font-bold text-gray-900 text-lg mt-8 border-t pt-4">PACKAGE SUBSCRIPTION TERMS</h3>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>Your package subscription is for your personal use and can't be transferred or shared. You must not allow anyone else to use your subscription package. A Fine will be charged for any breach based on sessions misused.</li>
                      <li>Package subscription is non-refundable. Unless, if there is a medical reason. In such case the following documentary proof must be provided and it will be subject to approval by the management:
                        <ul className="list-disc pl-5 mt-2">
                          <li>Medical – A doctor from a Singapore hospital provides a letter indicating that Zumba / Step aerobics will seriously impair my health. If the following documents are approved by management, the subscriptions will be on hold till you are deemed fit to continue.</li>
                        </ul>
                      </li>
                      <li>You confirmed that you have no pre-existing medical conditions which would prevent you from engaging in active exercise and you agree to undertake the lessons within your fitness limits.</li>
                      <li>If you are below 16 years old. You are required to bring along a Parent / Guardian on the registration date.</li>
                      <li>Cancellation of class after booking must be made 24 hours before the class date.</li>
                      <li>Booking timing is open from 0800H – 2200H daily VIA website.</li>
                      <li>Booked class with a "NO SHOW" will be forfeited.</li>
                      <li>You acknowledge that you fully take responsibility of all risk of injuries arising from the Zumba and Step aerobics classes and not hold the trainers or management for any liability for any injury arising from the classes.</li>
                      <li>You will be liable for the medical expenses in cases where there is a personal injury during classes.</li>
                      <li>An e-copy of the terms and conditions will be sent to your email address. This letter of acceptance supplements the agreement.</li>
                    </ol>

                    <div className="bg-gray-100 border-l-4 border-gray-500 p-4 my-6">
                      <p className="font-bold text-gray-900">DECLARATION</p>
                      <p className="mt-2">I HAVE READ THE MEMBERSHIP TERMS AND CONDITIONS AGREEMENT, FULLY UNDERSTAND ITS TERMS AND THAT I HAVE GIVEN UP SUBSTANTIAL RIGHTS BY SIGNING IT, AND SIGN IT FREELY AND VOLUNTARILY WITHOUT ANY INDUCEMENT.</p>
                      <p className="mt-2">I hereby confirm that I am aware of and agree to the terms and conditions on both the front and attached pages of this document headed 'Terms & Conditions'.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 5: Consents */}
            <div className="border-l-4 border-green-500 pl-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Consents & Agreements
              </h2>
              <div className="bg-green-50 rounded-lg p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    formData.terms_accepted ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Terms & Conditions</p>
                    <p className="text-sm text-gray-600">Member acknowledges reading and agreeing to all terms</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    formData.media_consent ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Media Consent</p>
                    <p className="text-sm text-gray-600">Permission granted for photos/videos on social media</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 6: Signatures */}
            <div className="border-l-4 border-indigo-500 pl-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Digital Signatures
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Member Signature */}
                <div className="bg-green-50 rounded-lg p-6 border-2 border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <label className="text-sm font-bold text-green-900 uppercase tracking-wide">Member</label>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 italic mb-2 border-b-2 border-green-300 pb-2">
                    {formData.member_signature}
                  </p>
                  <p className="text-xs text-green-700 font-medium">
                    {formatDate(formData.created_at)}
                  </p>
                </div>

                {/* Staff Signature */}
                <div className={`rounded-lg p-6 border-2 ${
                  isAlreadySigned 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <label className="text-sm font-bold text-green-900 uppercase tracking-wide">Staff</label>
                  </div>
                  {isAlreadySigned ? (
                    <>
                      <p className="text-3xl font-bold text-gray-900 italic mb-2 border-b-2 border-green-300 pb-2">
                        {formData.staff_signature}
                      </p>
                      <p className="text-xs text-green-700 font-medium">
                        {formatDate(formData.staff_signature_date!)}
                      </p>
                    </>
                  ) : (
                    <div>
                      <input
                        type="text"
                        value={staffSignature}
                        onChange={(e) => setStaffSignature(e.target.value)}
                        placeholder="Type your full name"
                        className="w-full rounded-md border-2 border-gray-300 px-4 py-3 text-xl italic focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                        disabled={signing}
                      />
                      <p className="mt-2 text-xs text-gray-500">Type your full name to sign</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 pt-6 border-t-2 border-gray-200">
                {!isAlreadySigned ? (
                  /* Save Signature Button - Before signing */
                  <div className="flex justify-center">
                    <button
                      onClick={handleSign}
                      disabled={signing || !staffSignature.trim()}
                      className="w-full md:w-auto px-12 py-5 bg-green-600 text-white text-lg font-bold rounded-lg hover:bg-green-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {signing ? (
                        <>
                          <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                          </svg>
                          Save Signature
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  /* Send Email & Download Buttons - After signing */
                  <div className="flex flex-col md:flex-row justify-center gap-4">
                    <button
                      onClick={handleSendEmail}
                      disabled={sendingEmail}
                      className="px-10 py-4 bg-green-600 text-white text-base font-bold rounded-lg hover:bg-green-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {sendingEmail ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                          </svg>
                          Send Email
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={handleDownload}
                      className="px-10 py-4 bg-green-600 text-white text-base font-bold rounded-lg hover:bg-green-700 transition-colors shadow-lg flex items-center justify-center gap-3"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Download Copy
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
