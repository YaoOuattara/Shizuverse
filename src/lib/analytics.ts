import posthog from 'posthog-js'

export const initAnalytics = () => {
  if (typeof window === 'undefined') return
  posthog.init('phc_placeholder', {
    api_host: 'https://app.posthog.com',
    capture_pageview: false,
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') ph.opt_out_capturing()
    },
  })
}

export const trackEvent = (event: string, properties?: Record<string, unknown>) => {
  if (typeof window === 'undefined') return
  posthog.capture(event, properties)
}
