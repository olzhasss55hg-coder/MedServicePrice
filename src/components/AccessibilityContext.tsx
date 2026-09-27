"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';

export type FontSize = 'normal' | 'large' | 'xlarge';
export type ContrastScheme = 'default' | 'high-contrast' | 'monochrome' | 'yellow-blue';
export type ImageMode = 'show' | 'grayscale' | 'hide';

export interface AccessibilitySettings {
  isEnabled: boolean;
  fontSize: FontSize;
  contrast: ContrastScheme;
  imageMode: ImageMode;
}

export interface AccessibilityContextType extends AccessibilitySettings {
  isSpeaking: boolean;
  isSpeechSupported: boolean;
  toggleToolbar: () => void;
  openToolbar: () => void;
  closeToolbar: () => void;
  setFontSize: (size: FontSize) => void;
  setContrast: (contrast: ContrastScheme) => void;
  setImageMode: (mode: ImageMode) => void;
  speakText: (text?: string) => void;
  stopSpeaking: () => void;
  resetSettings: () => void;
}

const STORAGE_KEY = 'medservice_a11y_settings_v1';

const defaultSettings: AccessibilitySettings = {
  isEnabled: false,
  fontSize: 'normal',
  contrast: 'default',
  imageMode: 'show',
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { locale } = useTranslation();

  // Safe client-side initialization from localStorage
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setIsSpeechSupported('speechSynthesis' in window);
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings({
            isEnabled: Boolean(parsed.isEnabled),
            fontSize: parsed.fontSize || 'normal',
            contrast: parsed.contrast || 'default',
            imageMode: parsed.imageMode || 'show',
          });
        }
      } catch (e) {
        console.error('Failed to load accessibility settings from localStorage', e);
      }
    }
  }, []);

  // Synchronize CSS classes and styles with DOM
  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;

    const html = document.documentElement;
    const body = document.body;

    // First remove all existing a11y classes
    html.classList.remove('a11y-font-normal', 'a11y-font-lg', 'a11y-font-xl');
    body.classList.remove(
      'a11y-active',
      'a11y-font-normal',
      'a11y-font-lg',
      'a11y-font-xl',
      'a11y-contrast-high',
      'a11y-contrast-mono',
      'a11y-contrast-yellow-blue',
      'a11y-images-grayscale',
      'a11y-images-hidden'
    );

    if (settings.isEnabled) {
      body.classList.add('a11y-active');

      // Font size
      if (settings.fontSize === 'large') {
        html.classList.add('a11y-font-lg');
        body.classList.add('a11y-font-lg');
      } else if (settings.fontSize === 'xlarge') {
        html.classList.add('a11y-font-xl');
        body.classList.add('a11y-font-xl');
      } else {
        html.classList.add('a11y-font-normal');
        body.classList.add('a11y-font-normal');
      }

      // Contrast
      if (settings.contrast === 'high-contrast') {
        body.classList.add('a11y-contrast-high');
      } else if (settings.contrast === 'monochrome') {
        body.classList.add('a11y-contrast-mono');
      } else if (settings.contrast === 'yellow-blue') {
        body.classList.add('a11y-contrast-yellow-blue');
      }

      // Images
      if (settings.imageMode === 'grayscale') {
        body.classList.add('a11y-images-grayscale');
      } else if (settings.imageMode === 'hide') {
        body.classList.add('a11y-images-hidden');
      }
    }

    // Persist to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save accessibility settings to localStorage', e);
    }
  }, [settings, mounted]);

  const toggleToolbar = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      isEnabled: !prev.isEnabled,
    }));
  }, []);

  const openToolbar = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      isEnabled: true,
    }));
  }, []);

  const closeToolbar = useCallback(() => {
    setSettings(prev => ({
      ...prev,
      isEnabled: false,
    }));
  }, []);

  const setFontSize = useCallback((fontSize: FontSize) => {
    setSettings(prev => ({ ...prev, fontSize, isEnabled: true }));
  }, []);

  const setContrast = useCallback((contrast: ContrastScheme) => {
    setSettings(prev => ({ ...prev, contrast, isEnabled: true }));
  }, []);

  const setImageMode = useCallback((imageMode: ImageMode) => {
    setSettings(prev => ({ ...prev, imageMode, isEnabled: true }));
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speakText = useCallback((customText?: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (!customText) {
        setIsSpeaking(false);
        return;
      }
    }

    // Get text to speak: customText -> selected text -> active main container
    let textToRead = customText?.trim();
    if (!textToRead) {
      const selected = window.getSelection()?.toString().trim();
      if (selected) {
        textToRead = selected;
      } else {
        const main = document.querySelector('main') || document.body;
        const headings = Array.from(main.querySelectorAll('h1, h2, h3, p'))
          .map(el => (el as HTMLElement).innerText.trim())
          .filter(Boolean)
          .slice(0, 5)
          .join('. ');

        textToRead = headings || document.title;
      }
    }

    if (!textToRead) return;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = locale === 'kk' ? 'kk-KZ' : 'ru-RU';
    utterance.rate = 0.95;

    // Find language voice if available
    const voices = window.speechSynthesis.getVoices();
    const voicePrefix = locale === 'kk' ? 'kk' : 'ru';
    const voice = voices.find(v => v.lang.toLowerCase().startsWith(voicePrefix)) ||
                  voices.find(v => v.lang.toLowerCase().startsWith('ru')) ||
                  null;

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [locale]);

  const resetSettings = useCallback(() => {
    stopSpeaking();
    setSettings({
      isEnabled: false,
      fontSize: 'normal',
      contrast: 'default',
      imageMode: 'show',
    });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [stopSpeaking]);

  return (
    <AccessibilityContext.Provider
      value={{
        ...settings,
        isSpeaking,
        isSpeechSupported,
        toggleToolbar,
        openToolbar,
        closeToolbar,
        setFontSize,
        setContrast,
        setImageMode,
        speakText,
        stopSpeaking,
        resetSettings,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}
