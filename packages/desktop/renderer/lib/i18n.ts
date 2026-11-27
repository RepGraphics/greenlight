import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

// Import all JSON files from the languages directory
function importAllLanguages(): Resource {
  const resources: Resource = {};
  // @ts-ignore
  const context = require.context("../languages", false, /\.json$/);
  context.keys().forEach((key: string) => {
    // Get the file name without extension
    const langCode = key.replace("./", "").replace(".json", "");
    resources[langCode] = context(key);
  });
  return resources;
}

const defaultLanguage = 'en-US';

// Bundled translations are available before static rendering or hydration.
void i18n.use(initReactI18next).init({
  resources: importAllLanguages(),
  lng: defaultLanguage,
  fallbackLng: defaultLanguage,
  initAsync: false,
  interpolation: { escapeValue: false },
}).catch(error => console.error('[i18n] Unable to initialize translations:', error));

export function setI18nLanguage(language?: string) {
  const selected = language || defaultLanguage;
  if (i18n.language !== selected) {
    void i18n.changeLanguage(selected).catch(error => console.error('[i18n] Unable to change language:', error));
  }
}

export default i18n;
