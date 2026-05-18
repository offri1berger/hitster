import posthog from 'posthog-js'

export const avatarFilename = (url: string | undefined) =>
  url ? (url.split('/').pop()?.split('?')[0] ?? 'unknown').slice(0, 60) : 'none'

export const initAnalytics = () => {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  if (!key) return
  posthog.init(key, {
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: false,
  })
}

export const identify = (playerId: string) => posthog.identify(playerId)

export const capture = (event: string, props?: Record<string, unknown>) =>
  posthog.capture(event, props)
