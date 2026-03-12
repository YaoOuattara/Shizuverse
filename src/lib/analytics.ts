import posthog from 'posthog-js'

export const initAnalytics = () => {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
  try {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
      capture_pageview: false,
      loaded: (ph) => {
        if (process.env.NODE_ENV === 'development') ph.opt_out_capturing()
      },
    })
  } catch (err) {
    console.error('[analytics] posthog init failed:', err)
  }
}

export const trackEvent = (event: string, properties?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return
  posthog.capture(event, properties)
}
