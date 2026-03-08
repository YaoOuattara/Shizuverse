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
  
  let booking = {};
  let services = {};
  try { booking = (await import(`../messages/${resolved}/booking.json`)).default; } catch {}
  try { services = (await import(`../messages/${resolved}/services.json`)).default; } catch {}

  return {
    locale: resolved,
    messages: { ...base, booking, services }
  };
});
