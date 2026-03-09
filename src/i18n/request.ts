import {getRequestConfig} from 'next-intl/server';

const SUPPORTED = ['en', 'fr'] as const;
type Supported = (typeof SUPPORTED)[number];
const DEFAULT_LOCALE: Supported = 'en';

export default getRequestConfig(async ({requestLocale}) => {
  const locale = await requestLocale;
  const resolved: Supported = SUPPORTED.includes(locale as Supported)
    ? (locale as Supported)
    : DEFAULT_LOCALE;

  const base = (await import(`../messages/${resolved}.json`)).default;

  let bookingOverride = null;
  let servicesOverride = null;
  try { bookingOverride = (await import(`../messages/${resolved}/booking.json`)).default; } catch {}
  try { servicesOverride = (await import(`../messages/${resolved}/services.json`)).default; } catch {}

  return {
    locale: resolved,
    messages: {
      ...base,
      ...(bookingOverride ? { booking: bookingOverride } : {}),
      ...(servicesOverride ? { services: servicesOverride } : {}),
    }
  };
});
