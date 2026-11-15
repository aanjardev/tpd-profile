// Loaded only by the isolated CMS test server via Node --import. Production has no endpoint override.
const origin = new URL(process.env.CMS_TEST_TRANSLATION_ORIGIN);
if (origin.hostname !== '127.0.0.1' || origin.protocol !== 'http:') throw new Error('Translation fixture must use loopback.');
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname === 'translation.googleapis.com') {
    if (url.href !== 'https://translation.googleapis.com/language/translate/v2') throw new Error('Unexpected translation API request.');
    return realFetch(new URL('/translate', origin), init);
  }
  return realFetch(input, init);
};
