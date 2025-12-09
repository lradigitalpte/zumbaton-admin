'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import type { UserResponse } from '@/api/schemas'

interface UserContextType {
  profile: UserResponse | null
  setProfile: (profile: UserResponse | null) => void
  updateProfile: (updates: Partial<UserResponse>) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserResponse | null>(null)

  const updateProfile = (updates: Partial<UserResponse>) => {
    if (profile) {
      setProfile({ ...profile, ...updates })
    }
  }

  return (
    <UserContext.Provider value={{
      profile,
      setProfile,
      updateProfile,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within UserProvider')
  }
  return context
}
