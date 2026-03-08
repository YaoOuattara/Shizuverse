module.exports = {
  locales: ['en', 'fr'],
  defaultLocale: 'en',
  messages: (locale) => import(`./src/messages/${locale}.json`).then((m) => m.default),
};
