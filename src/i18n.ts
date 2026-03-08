export const locales = ['en', 'fr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export async function loadMessages(locale: Locale) {
  const messages = (await import(`@/messages/${locale}.json`)).default;
  return messages;
}
