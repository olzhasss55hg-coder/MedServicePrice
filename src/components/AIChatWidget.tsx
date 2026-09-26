"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles, Crown, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { API_URL, api } from "@/lib/api";
import { useTranslation } from "@/i18n/LanguageContext";
import { useToast } from "@/components/ui/ToastContext";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface RecommendedDoctor {
  id: string;
  name: string;
  specialty: string;
  clinic_id: string;
  clinic_name?: string | null;
  price: number;
  rating?: number | null;
  photo_url?: string | null;
}

export function AIChatWidget() {
  const { locale, setLocale } = useTranslation();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [chatLang, setChatLang] = useState<"ru" | "kz">(locale === "kk" ? "kz" : "ru");

  useEffect(() => {
    setChatLang(locale === "kk" ? "kz" : "ru");
  }, [locale]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: locale === "kk"
        ? "Сәлеметсіз бе! Мен сіздің медициналық AI-көмекшіңізбін 🤖\n\nСізге ең тиімді клиникалар мен білікті дәрігерлерді тауып беремін. Белгілеріңізді немесе қажетті қызметті жазыңыз!"
        : "Здравствуйте! Я ваш медицинский AI-ассистент MedService 🤖\n\nПомогу найти проверенные клиники, врачей и сравнить цены на анализы и диагностику. Опишите симптомы или напишите интересующую услугу!"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recommendedDoctors, setRecommendedDoctors] = useState<RecommendedDoctor[]>([]);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const [aiSessionId] = useState(() => {
    if (typeof window === "undefined") return "";
    const existing = window.localStorage.getItem("medservice-ai-session");
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem("medservice-ai-session", created);
    return created;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSubmit = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const promptToSend = (customPrompt || input).trim();
    if (!promptToSend || isLoading) return;

    if (!customPrompt) setInput("");
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "user", content: promptToSend }]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-AI-Session": aiSessionId },
        body: JSON.stringify({ message: promptToSend, language: chatLang })
      });

      const data = await res.json().catch(() => ({})) as {
        reply?: string;
        recommended_doctors?: RecommendedDoctor[];
        detail?: { message?: string; upgrade_required?: boolean } | string;
      };

      if (!res.ok) {
        if (res.status === 429 && typeof data.detail === "object" && data.detail?.upgrade_required) {
          setShowQuotaModal(true);
          setIsOpen(true);
        }
        const detail = typeof data.detail === "string" ? data.detail : data.detail?.message;
        throw new Error(detail || "Chat request failed");
      }

      setRecommendedDoctors(data.recommended_doctors || []);

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply || (chatLang === "kz" ? "Сұрағыңызға сәйкес мәлімет табылмады." : "Не удалось найти ответ на ваш запрос.")
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: err?.message || (chatLang === "kz" ? "Қате кетті. Кейінірек қайталап көріңіз." : "Произошла ошибка при обращении к серверу.")
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstantUpgrade = async (plan: 'pro' | 'premium') => {
    setUpgrading(true);
    try {
      await api.upgradePlan(plan);
      toast.success(chatLang === "kz" ? `Құттықтаймыз! ${plan.toUpperCase()} тарифі белсендірілді.` : `Поздравляем! Тариф ${plan.toUpperCase()} успешно подключен.`);
      setShowQuotaModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Ошибка активации тарифа');
    } finally {
      setUpgrading(false);
    }
  };

  const renderInlineMarkdown = (content: string): ReactNode[] => {
    const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^\)]+\))/g;
    const nodes: ReactNode[] = [];
    let cursor = 0;

    for (const match of content.matchAll(tokenPattern)) {
      const token = match[0];
      const start = match.index ?? 0;
      if (start > cursor) nodes.push(content.slice(cursor, start));

      if (token.startsWith("**")) {
        nodes.push(<strong key={`${start}-bold`} className="font-semibold text-slate-900">{token.slice(2, -2)}</strong>);
      } else if (token.startsWith("*")) {
        nodes.push(<em key={`${start}-italic`}>{token.slice(1, -1)}</em>);
      } else {
        const linkMatch = token.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
        const href = linkMatch?.[2] ?? "#";
        const isSafeHref = href.startsWith("/") || href.startsWith("https://");
        nodes.push(isSafeHref ? (
          <a key={`${start}-link`} href={href} className="text-teal-600 underline font-semibold hover:text-teal-700 transition-colors">
            {linkMatch?.[1]}
          </a>
        ) : (linkMatch?.[1] ?? token));
      }
      cursor = start + token.length;
    }

    if (cursor < content.length) nodes.push(content.slice(cursor));
    return nodes;
  };

  const renderMessageContent = (content: string) => {
    const parts = content.split("\n");
    return parts.map((part, index) => (
      <span key={index}>
        {renderInlineMarkdown(part)}
        {index < parts.length - 1 && <br />}
      </span>
    ));
  };

  const quickPrompts = chatLang === "kz" ? [
    "Алматыдағы үздік кардиолог",
    "Астанада МРТ бағасы қанша?",
    "Бас ауруы және қан қысымы",
    "Қанның жалпы талдауы"
  ] : [
    "Лучший кардиолог в Алматы",
    "Сколько стоит МРТ в Астане?",
    "Головная боль и давление",
    "Общий анализ крови (ОАК)"
  ];

  return (
    <>
      {/* Chat Button */}
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
            isOpen ? 'bg-rose-500 hover:bg-rose-600' : 'bg-teal-600 hover:bg-teal-500'
          }`}
          aria-label="Toggle AI Assistant"
        >
          {isOpen ? <X className="w-6 h-6 text-white" /> : <MessageSquare className="w-6 h-6 text-white" />}
        </button>
      </motion.div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 w-[400px] h-[620px] max-h-[82vh] max-w-[calc(100vw-36px)] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-50 font-sans"
          >
            {/* Header */}
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide flex items-center gap-1.5 text-slate-100">
                    MedService AI
                    <span className="text-[10px] uppercase font-bold bg-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded-full">RU / KK</span>
                  </h3>
                  <p className="text-xs text-slate-400">Медициналық көмекші / Ассистент</p>
                </div>
              </div>

              {/* Language Switcher in Header */}
              <div className="flex items-center gap-1.5">
                <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  <button
                    onClick={() => {
                      setChatLang("kz");
                      setLocale("kk");
                    }}
                    className={`px-2 py-0.5 text-xs font-bold rounded ${
                      chatLang === "kz" ? "bg-teal-500 text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    KK
                  </button>
                  <button
                    onClick={() => {
                      setChatLang("ru");
                      setLocale("ru");
                    }}
                    className={`px-2 py-0.5 text-xs font-bold rounded ${
                      chatLang === "ru" ? "bg-teal-500 text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    RU
                  </button>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user' ? 'bg-teal-600 text-white' : 'bg-teal-100 text-teal-700'
                    }`}
                  >
                    {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[85%] ${
                      msg.role === 'user'
                        ? 'bg-teal-600 text-white rounded-tr-sm shadow-md shadow-teal-600/10'
                        : 'bg-white shadow-sm border border-slate-200/80 rounded-tl-sm text-slate-800'
                    }`}
                  >
                    {renderMessageContent(msg.content)}
                  </div>
                </div>
              ))}

              {/* Recommended Doctors Card */}
              {recommendedDoctors.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {chatLang === "kz" ? "Ұсынылған дәрігерлер" : "Рекомендуемые врачи"}
                  </p>
                  {recommendedDoctors.map((doctor) => (
                    <div key={doctor.id} className="bg-white shadow-sm border border-slate-200 rounded-xl p-3 hover:border-teal-500/50 transition-all">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-900 truncate">{doctor.name}</p>
                          <p className="text-xs text-teal-600 font-medium">{doctor.specialty}</p>
                          <p className="text-xs text-slate-500">
                            {doctor.clinic_name || "Клиника"} · {doctor.price.toLocaleString("ru-RU")} ₸ · ⭐ {doctor.rating ?? "5.0"}
                          </p>
                        </div>
                        <a
                          href={`/clinics/${encodeURIComponent(doctor.clinic_id)}`}
                          className="shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 transition-colors shadow-sm"
                        >
                          {chatLang === "kz" ? "Жазылу" : "Запись"}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                  <div className="px-4 py-2.5 rounded-2xl text-sm bg-white shadow-sm border border-slate-200 rounded-tl-sm text-slate-600 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                    {chatLang === "kz" ? "AI ойлануда..." : "AI формирует ответ..."}
                  </div>
                </div>
              )}

              {/* Quick Prompts */}
              {messages.length === 1 && !isLoading && (
                <div className="pt-2">
                  <p className="text-xs text-slate-400 mb-2">{chatLang === "kz" ? "Жиі қойылатын сұрақтар:" : "Быстрые запросы:"}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSubmit(undefined, prompt)}
                        className="text-xs bg-white border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg hover:border-teal-500 hover:text-teal-700 transition-colors text-left"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={(e) => handleSubmit(e)} className="p-3 bg-white border-t border-slate-200">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={chatLang === "kz" ? "Сұрағыңызды немесе симптомдарды жазыңыз..." : "Опишите вопрос или симптомы..."}
                  className="flex-1 bg-slate-100 border-none focus-visible:ring-1 focus-visible:ring-teal-600 text-sm h-10"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  className="shrink-0 bg-teal-600 hover:bg-teal-500 text-white h-10 w-10 rounded-xl"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quota Upgrade Modal (Module 10) */}
      <AnimatePresence>
        {showQuotaModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowQuotaModal(false)}
          >
            <div
              className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 text-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                <Crown className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-2">
                {chatLang === "kz" ? "AI сұраулар лимиті (20) аяқталды" : "Лимит бесплатных AI-запросов (20) исчерпан"}
              </h3>
              <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                {chatLang === "kz"
                  ? "Шексіз AI консультациялары, жедел жазылу және талдаулар бойынша жеке көмек алу үшін тарифті жаңартыңыз."
                  : "Для безлимитного доступа к AI, приоритетной записи к врачам и персональной поддержки перейдите на Pro или Premium."}
              </p>

              <div className="space-y-3 mb-6">
                <div className="p-4 rounded-2xl bg-slate-800/80 border border-teal-500/30 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-teal-400">Pro Тариф</p>
                    <p className="text-xs text-slate-400">Шексіз AI сұраулар / Безлимитный AI</p>
                  </div>
                  <button
                    disabled={upgrading}
                    onClick={() => handleInstantUpgrade('pro')}
                    className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-colors"
                  >
                    2 990 ₸/мес
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/80 border border-amber-500/30 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-amber-400">Premium Тариф</p>
                    <p className="text-xs text-slate-400">Приоритетная запись + Менеджер</p>
                  </div>
                  <button
                    disabled={upgrading}
                    onClick={() => handleInstantUpgrade('premium')}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
                  >
                    7 990 ₸/мес
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowQuotaModal(false)}
                className="w-full py-2.5 rounded-xl border border-slate-700 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                {chatLang === "kz" ? "Кейінірек" : "Закрыть"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
