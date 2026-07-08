"use client";

import { useTranslation } from '../../lib/i18n';

export default function LanguageSwitcher() {
  const { lang, setLang } = useTranslation();

  return (
    <div className="flex items-center space-x-1 border border-[#1f1f23] rounded bg-[#09090b] p-0.5 text-[10px] font-bold">
      <button
        onClick={() => setLang('en')}
        className={`px-2 py-0.5 rounded transition-all ${
          lang === 'en' ? 'bg-[#27272a] text-white' : 'text-neutral-500 hover:text-white'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang('vi')}
        className={`px-2 py-0.5 rounded transition-all ${
          lang === 'vi' ? 'bg-[#27272a] text-white' : 'text-neutral-500 hover:text-white'
        }`}
      >
        VI
      </button>
    </div>
  );
}
