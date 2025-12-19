import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useToast as useAdminToast } from '@/components/ui/Toast'
import { handleApiResponse, handleMutationError, createToastAdapter } from '@/lib/toast-helper'

export interface UserProfile {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  avatarUrl: string | null
  bio?: string | null
  preferences?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

// Helper to extract bio from preferences
export function getBioFromProfile(profile: UserProfile): string {
  if (profile.bio) return profile.bio
  if (profile.preferences && typeof profile.preferences === 'object' && 'bio' in profile.preferences) {
    return String(profile.preferences.bio || '')
  }
  return ''
}

export interface UpdateProfileData {
  name?: string
  phone?: string | null
  avatarUrl?: string | null
  bio?: string
  preferences?: Record<string, unknown>
}

export interface ChangePasswordData {
  currentPassword: string
  newPassword: string
}

async function fetchProfile(): Promise<UserProfile> {
  const response = await api.get<{ data: UserProfile }>('/api/users/me')

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch profile')
  }

  if (!response.data?.data) {
    throw new Error('Failed to fetch profile')
  }

  return response.data.data
}

async function updateProfile(data: UpdateProfileData): Promise<UserProfile> {
  // Map bio to preferences if needed, or send as part of preferences
  const updateData: any = {
    name: data.name,
    phone: data.phone,
    avatarUrl: data.avatarUrl,
  }
  
  // Store bio in preferences if provided
  if (data.bio !== undefined) {
    updateData.preferences = {
      ...(data.preferences || {}),
      bio: data.bio,
    }
  } else if (data.preferences) {
    updateData.preferences = data.preferences
  }

  const response = await api.put<{ data: UserProfile }>('/api/users/me', updateData)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to update profile')
  }

  if (!response.data?.data) {
    throw new Error('Failed to update profile')
  }

  return response.data.data
}

async function changePassword(data: ChangePasswordData): Promise<{ message: string }> {
  // Use Supabase auth API for password change
  const response = await api.post<{ success: boolean; data: { message: string } }>('/api/auth/change-password', data)

  if (response.error) {
    throw new Error(response.error.message || 'Failed to change password')
  }

  if (!response.data?.success) {
    const errorMessage = (response.data as any)?.error?.message || 'Failed to change password'
    throw new Error(errorMessage)
  }

  return response.data.data
}

export function useProfile() {
  return useQuery({
    queryKey: ['user-profile'],
    queryFn: fetchProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const adminToast = useAdminToast()
  const toast = createToastAdapter(adminToast)

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      // Invalidate profile and auth queries
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      queryClient.invalidateQueries({ queryKey: ['auth'] })
      handleApiResponse({ success: true, message: 'Profile updated successfully' }, toast, {
        successTitle: 'Profile Updated'
      })
    },
    onError: (error: Error) => {
      handleMutationError(error, toast, 'Update')
    }
  })
}

export function useChangePassword() {
  const adminToast = useAdminToast()
  const toast = createToastAdapter(adminToast)
  
  return useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      handleApiResponse({ success: true, message: 'Password changed successfully' }, toast, {
        successTitle: 'Password Changed'
      })
    },
    onError: (error: Error) => {
      handleMutationError(error, toast, 'Password change')
    }
  })
}

