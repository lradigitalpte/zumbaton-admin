/**
 * User Age and Package/Class Type Validation Utilities
 * Ensures adults can only purchase adult packages and book adult classes
 * Ensures kids can only purchase kid packages and book kid classes
 */

/**
 * Calculate user age from date of birth
 * Returns age in years, or null if date_of_birth is not available
 */
export function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) {
    return null
  }

  try {
    const birthDate = new Date(dateOfBirth)
    const today = new Date()
    
    // Check if date is valid
    if (isNaN(birthDate.getTime())) {
      return null
    }

    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    
    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  } catch (error) {
    console.error('[UserAgeUtils] Error calculating age:', error)
    return null
  }
}

/**
 * Determine if user is an adult (13+) or kid (<13)
 * Returns 'adult' if 13 or older, 'kid' if under 13, or null if age cannot be determined
 */
export function getUserType(dateOfBirth: string | null | undefined): 'adult' | 'kid' | null {
  const age = calculateAge(dateOfBirth)
  
  if (age === null) {
    return null // Cannot determine - will need to handle this case
  }

  // Age 13 and above is considered adult
  return age >= 13 ? 'adult' : 'kid'
}

/**
 * Check if package type is compatible with user type
 * - Adults can purchase: 'adult' or 'all' packages
 * - Kids can purchase: 'kid' packages only
 * Returns true if compatible, false otherwise
 */
export function isPackageTypeCompatible(
  packageType: 'adult' | 'kid' | 'all' | string,
  userType: 'adult' | 'kid' | null
): boolean {
  // If user type cannot be determined, allow purchase (fail open for backwards compatibility)
  // But log a warning
  if (userType === null) {
    console.warn('[UserAgeUtils] User type cannot be determined - allowing package purchase')
    return true
  }

  // Normalize package type (handle 'adults' vs 'adult', 'kids' vs 'kid')
  const normalizedPackageType = packageType === 'adults' ? 'adult' : 
                                 packageType === 'kids' ? 'kid' : 
                                 packageType

  if (userType === 'adult') {
    // Adults can purchase 'adult' or 'all' packages
    return normalizedPackageType === 'adult' || normalizedPackageType === 'all'
  } else if (userType === 'kid') {
    // Kids can only purchase 'kid' packages
    return normalizedPackageType === 'kid'
  }

  return false
}

/**
 * Check if class type is compatible with user type
 * Assumes class types are: 'adult', 'kid', or 'all'
 * Returns true if compatible, false otherwise
 */
export function isClassTypeCompatible(
  classType: string | null | undefined,
  userType: 'adult' | 'kid' | null
): boolean {
  // If user type cannot be determined, allow booking (fail open for backwards compatibility)
  if (userType === null) {
    console.warn('[UserAgeUtils] User type cannot be determined - allowing class booking')
    return true
  }

  // If class type is 'all', anyone can book it
  if (!classType || classType === 'all') {
    return true
  }

  // Normalize class type
  const normalizedClassType = classType.toLowerCase()

  if (userType === 'adult') {
    // Adults can book 'adult' or 'all' classes
    return normalizedClassType === 'adult' || normalizedClassType === 'all'
  } else if (userType === 'kid') {
    // Kids can only book 'kid' classes
    return normalizedClassType === 'kid'
  }

  return false
}

/**
 * Check if package type is compatible with class type
 * Used when booking a class - ensures tokens from the right package type are used
 * Returns true if compatible, false otherwise
 */
export function isPackageCompatibleWithClass(
  packageType: 'adult' | 'kid' | 'all' | string,
  classType: string | null | undefined
): boolean {
  // Normalize package type
  const normalizedPackageType = packageType === 'adults' ? 'adult' : 
                                 packageType === 'kids' ? 'kid' : 
                                 packageType

  // If class type is 'all', any package type can be used
  if (!classType || classType === 'all') {
    return true
  }

  const normalizedClassType = classType.toLowerCase()

  // 'all' packages can be used for any class type
  if (normalizedPackageType === 'all') {
    return true
  }

  // Adult packages can only be used for adult classes
  if (normalizedPackageType === 'adult') {
    return normalizedClassType === 'adult'
  }

  // Kid packages can only be used for kid classes
  if (normalizedPackageType === 'kid') {
    return normalizedClassType === 'kid'
  }

  return false
}
