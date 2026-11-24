/** Browser-local profile photo (data URL), scoped per user id. */
export function profilePhotoStorageKey(userId: number | string): string {
  return `hrims_profile_photo_${userId}`
}

export function readProfilePhoto(userId: number | string): string | null {
  try {
    const key = profilePhotoStorageKey(userId)
    const value = window.localStorage.getItem(key)
    if (value && value.startsWith('data:image/')) return value

    // Migrate legacy single-key photo used before per-user storage.
    const legacy = window.localStorage.getItem('hrims_profile_photo')
    if (legacy && legacy.startsWith('data:image/')) {
      window.localStorage.setItem(key, legacy)
      return legacy
    }

    return null
  } catch {
    return null
  }
}

export function writeProfilePhoto(userId: number | string, dataUrl: string): void {
  window.localStorage.setItem(profilePhotoStorageKey(userId), dataUrl)
}

export function clearProfilePhoto(userId: number | string): void {
  window.localStorage.removeItem(profilePhotoStorageKey(userId))
}

export const PROFILE_PHOTO_CHANGED_EVENT = 'hrims-profile-photo-changed'

export function notifyProfilePhotoChanged(userId: number | string): void {
  window.dispatchEvent(
    new CustomEvent(PROFILE_PHOTO_CHANGED_EVENT, { detail: { userId: String(userId) } }),
  )
}
