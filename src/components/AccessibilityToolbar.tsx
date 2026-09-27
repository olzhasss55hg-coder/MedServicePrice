"use client";

import React, { useState } from 'react';
import {
  Glasses,
  Eye,
  Type,
  Volume2,
  VolumeX,
  RotateCcw,
  Image as ImageIcon,
  ImageOff,
  SunMoon,
  X,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { useAccessibility, FontSize, ContrastScheme, ImageMode } from './AccessibilityContext';
import { useTranslation } from '@/i18n/LanguageContext';

export function AccessibilityToolbar() {
  const {
    isEnabled,
    fontSize,
    contrast,
    imageMode,
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
  } = useAccessibility();

  const { locale } = useTranslation();
  const [showSpeechTooltip, setShowSpeechTooltip] = useState(false);
  const isKz = locale === 'kk';

  return (
    <>
      {/* 1. TOP ACCESSIBILITY CONTROL PANEL */}
      {isEnabled && (
        <aside
          role="region"
          aria-label={isKz ? "Көзі нашар көретіндерге арналған басқару панелі" : "Панель для слабовидящих"}
          className="a11y-panel sticky top-0 z-[70] w-full bg-slate-900 text-white border-b-2 border-amber-400 shadow-xl"
        >
          <div className="container mx-auto max-w-[1440px] px-3 sm:px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
              
              {/* Header Title */}
              <div className="flex items-center gap-2 font-bold tracking-tight text-amber-300">
                <Glasses className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {isKz ? "Көзі нашар көретіндерге арналған нұсқа" : "Версия для слабовидящих"}
                </span>
                <span className="sm:hidden font-extrabold">
                  {isKz ? "Көру режимі" : "Слабовидящим"}
                </span>
              </div>

              {/* Controls Group */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                
                {/* 1. Font Size Controls */}
                <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
                  <span className="text-[11px] font-semibold text-slate-300 px-1.5 hidden md:inline">
                    {isKz ? "Қаріп:" : "Шрифт:"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFontSize('normal')}
                    title={isKz ? "Қалыпты қаріп (100%)" : "Обычный шрифт (100%)"}
                    aria-pressed={fontSize === 'normal'}
                    className={`px-2 py-1 rounded-lg font-bold transition-all text-xs ${
                      fontSize === 'normal'
                        ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 font-extrabold'
                        : 'text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    A- <span className="hidden lg:inline text-[10px] font-normal">100%</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize('large')}
                    title={isKz ? "Үлкейтілген қаріп (120%)" : "Увеличенный шрифт (120%)"}
                    aria-pressed={fontSize === 'large'}
                    className={`px-2 py-1 rounded-lg font-bold transition-all text-sm ${
                      fontSize === 'large'
                        ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 font-extrabold'
                        : 'text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    A <span className="hidden lg:inline text-[10px] font-normal">120%</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize('xlarge')}
                    title={isKz ? "Ең үлкен қаріп (140%)" : "Максимальный шрифт (140%)"}
                    aria-pressed={fontSize === 'xlarge'}
                    className={`px-2 py-1 rounded-lg font-extrabold transition-all text-base ${
                      fontSize === 'xlarge'
                        ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 font-black'
                        : 'text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    A+ <span className="hidden lg:inline text-[10px] font-normal">140%</span>
                  </button>
                </div>

                {/* 2. Color Contrast Schemes */}
                <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
                  <span className="text-[11px] font-semibold text-slate-300 px-1.5 hidden md:inline">
                    {isKz ? "Түстер:" : "Цвета:"}
                  </span>
                  
                  {/* Standard */}
                  <button
                    type="button"
                    onClick={() => setContrast('default')}
                    title={isKz ? "Стандартты түстер" : "Стандартные цвета"}
                    aria-pressed={contrast === 'default'}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                      contrast === 'default'
                        ? 'bg-teal-600 text-white ring-2 ring-teal-300 font-bold'
                        : 'text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {isKz ? "Негізгі" : "Обычные"}
                  </button>

                  {/* High Contrast Black/White */}
                  <button
                    type="button"
                    onClick={() => setContrast('high-contrast')}
                    title={isKz ? "Қара фонда ақ мәтін (Жоғары контраст)" : "Черный фон, белый текст (Высокий контраст)"}
                    aria-pressed={contrast === 'high-contrast'}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${
                      contrast === 'high-contrast'
                        ? 'bg-black text-white border-white ring-2 ring-white'
                        : 'bg-black/70 text-white border-slate-600 hover:border-white'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white border border-black inline-block"></span>
                    <span>{isKz ? "Қара" : "Черный"}</span>
                  </button>

                  {/* Monochrome White/Black */}
                  <button
                    type="button"
                    onClick={() => setContrast('monochrome')}
                    title={isKz ? "Ақ фонда қара мәтін (Монохром)" : "Белый фон, черный текст (Монохром)"}
                    aria-pressed={contrast === 'monochrome'}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${
                      contrast === 'monochrome'
                        ? 'bg-white text-black border-black ring-2 ring-slate-900'
                        : 'bg-white/80 text-black border-slate-300 hover:bg-white'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-black border border-white inline-block"></span>
                    <span>{isKz ? "Ақ" : "Белый"}</span>
                  </button>

                  {/* Yellow on Blue */}
                  <button
                    type="button"
                    onClick={() => setContrast('yellow-blue')}
                    title={isKz ? "Көк фонда сары мәтін (Ерекше көзге көрінетін)" : "Синий фон, желтый текст (Высокая видимость)"}
                    aria-pressed={contrast === 'yellow-blue'}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all border flex items-center gap-1 ${
                      contrast === 'yellow-blue'
                        ? 'bg-blue-950 text-yellow-300 border-yellow-300 ring-2 ring-yellow-300'
                        : 'bg-blue-900/60 text-yellow-300 border-blue-700 hover:border-yellow-400'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-300 border border-blue-900 inline-block"></span>
                    <span>{isKz ? "Көк/Сары" : "Синий"}</span>
                  </button>
                </div>

                {/* 3. Images Mode Toggle */}
                <div className="hidden lg:flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
                  <span className="text-[11px] font-semibold text-slate-300 px-1.5">
                    {isKz ? "Суреттер:" : "Фото:"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setImageMode('show')}
                    title={isKz ? "Суреттерді толық көрсету" : "Показывать изображения"}
                    className={`p-1.5 rounded-lg transition-all ${
                      imageMode === 'show' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('grayscale')}
                    title={isKz ? "Суреттерді ақ-қара реңкке ауыстыру" : "Черно-белые изображения"}
                    className={`p-1.5 rounded-lg transition-all ${
                      imageMode === 'grayscale' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <SunMoon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('hide')}
                    title={isKz ? "Суреттерді жасыру" : "Скрыть изображения"}
                    className={`p-1.5 rounded-lg transition-all ${
                      imageMode === 'hide' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <ImageOff className="w-4 h-4" />
                  </button>
                </div>

                {/* 4. Screen Reader / Voice Synthesizer */}
                {isSpeechSupported && (
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      onClick={() => (isSpeaking ? stopSpeaking() : speakText())}
                      title={
                        isSpeaking
                          ? (isKz ? "Дыбысты тоқтату" : "Остановить озвучивание")
                          : (isKz ? "Мәтінді дауыстап оқу" : "Озвучить страницу / выделенный текст")
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all border shadow-sm ${
                        isSpeaking
                          ? 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-300 animate-pulse'
                          : 'bg-emerald-600 text-white border-emerald-400 hover:bg-emerald-500'
                      }`}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="w-4 h-4" />
                          <span>{isKz ? "Тоқтату" : "Стоп"}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" />
                          <span>{isKz ? "Дыбыстау" : "Озвучить"}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSpeechTooltip(!showSpeechTooltip)}
                      className="ml-1 text-slate-400 hover:text-white"
                      title={isKz ? "Дыбыстау туралы көмек" : "Справка по озвучке"}
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>

                    {showSpeechTooltip && (
                      <div className="absolute right-0 top-10 w-64 bg-slate-800 text-slate-100 p-3 rounded-xl border border-slate-600 shadow-2xl z-50 text-xs">
                        <p className="font-semibold text-amber-300 mb-1">
                          {isKz ? "Дыбыстық сүйемелдеу:" : "Голосовое сопровождение:"}
                        </p>
                        <p className="text-[11px] leading-relaxed text-slate-200">
                          {isKz
                            ? "Беттегі кез келген мәтінді тінтуірмен белгілеп, «Дыбыстау» батырмасын басыңыз немесе бүкіл парақшаны тыңдаңыз."
                            : "Выделите любой текст на странице и нажмите «Озвучить», либо нажмите для чтения основных заголовков страницы."}
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowSpeechTooltip(false)}
                          className="mt-2 text-[10px] text-amber-400 underline font-bold"
                        >
                          {isKz ? "Түсінікті" : "Понятно"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Reset to Normal Site */}
                <button
                  type="button"
                  onClick={resetSettings}
                  title={isKz ? "Қалыпты нұсқаға оралу" : "Вернуться к обычной версии сайта"}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-600 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">
                    {isKz ? "Қалыпты нұсқа" : "Обычная версия"}
                  </span>
                </button>

                {/* 6. Close Panel Button */}
                <button
                  type="button"
                  onClick={closeToolbar}
                  title={isKz ? "Панельді жабу" : "Закрыть панель"}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

              </div>
            </div>
          </div>
        </aside>
      )}

      {/* 2. FLOATING QUICK ACCESS BUTTON */}
      {!isEnabled && (
        <aside
          role="complementary"
          aria-label={isKz ? "Көзі нашар көретіндерге арналған жылдам батырма" : "Кнопка для слабовидящих"}
          className="fixed bottom-20 md:bottom-6 left-4 md:left-6 z-40 print:hidden"
        >
          <button
            type="button"
            onClick={openToolbar}
            title={isKz ? "Көзі нашар көретіндерге арналған нұсқа" : "Версия для слабовидящих"}
            aria-label={isKz ? "Көзі нашар көретіндерге арналған нұсқаны ашу" : "Включить версию для слабовидящих"}
            className="group flex items-center gap-2.5 bg-slate-900 text-white hover:bg-black px-3.5 py-2.5 rounded-2xl shadow-2xl border-2 border-amber-400 hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-amber-300"
          >
            <Glasses className="w-5 h-5 text-amber-400 group-hover:rotate-12 transition-transform" />
            <span className="hidden lg:inline text-xs font-extrabold tracking-wide text-amber-300">
              {isKz ? "Көру режимі" : "Для слабовидящих"}
            </span>
          </button>
        </aside>
      )}
    </>
  );
}
