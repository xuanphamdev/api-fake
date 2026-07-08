"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Locale, dictionaries, Dictionary } from './dictionaries';

interface I18nContextType {
  lang: Locale;
  t: (key: keyof Dictionary) => string;
  setLang: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children, initialLang }: { children: React.ReactNode; initialLang: Locale }) {
  const [lang, setLangState] = useState<Locale>(initialLang);

  const t = (key: keyof Dictionary): string => {
    return dictionaries[lang][key] || dictionaries['en'][key] || String(key);
  };

  const setLang = (locale: Locale) => {
    setLangState(locale);
    // Write cookie lang
    document.cookie = `lang=${locale}; path=/; max-age=31536000`;
    // Refresh page to trigger server action updates
    window.location.reload();
  };

  return (
    <I18nContext.Provider value={{ lang, t, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
