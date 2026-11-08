import { create } from 'zustand';

export type DuckingMode = 'duck' | 'pause';

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
];

interface SettingsState {
  audioDuckingMode: DuckingMode;
  uiLanguage: string;
  timbreTtsOptIn: boolean;
  dataSaverMode: boolean;

  setAudioDuckingMode: (mode: DuckingMode) => void;
  setUiLanguage: (lang: string) => void;
  setTimbreTtsOptIn: (optIn: boolean) => void;
  setDataSaverMode: (dataSaver: boolean) => void;
}

const STORAGE_KEY = 'conv_way_user_settings';

function loadSettings(): Partial<SettingsState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistSettings(data: Partial<SettingsState>) {
  try {
    const current = loadSettings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...data }));
  } catch {}
}

const saved = loadSettings();

export const useSettingsStore = create<SettingsState>((set) => ({
  audioDuckingMode: saved.audioDuckingMode || 'duck',
  uiLanguage: saved.uiLanguage || 'en',
  timbreTtsOptIn: saved.timbreTtsOptIn || false,
  dataSaverMode: saved.dataSaverMode || false,

  setAudioDuckingMode: (mode) => {
    set({ audioDuckingMode: mode });
    persistSettings({ audioDuckingMode: mode });
  },

  setUiLanguage: (lang) => {
    set({ uiLanguage: lang });
    persistSettings({ uiLanguage: lang });
  },

  setTimbreTtsOptIn: (optIn) => {
    set({ timbreTtsOptIn: optIn });
    persistSettings({ timbreTtsOptIn: optIn });
  },

  setDataSaverMode: (dataSaver) => {
    set({ dataSaverMode: dataSaver });
    persistSettings({ dataSaverMode: dataSaver });
  },
}));

