"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  X,
  ChevronDown,
  ChevronUp,
  Cookie,
  Shield,
  BarChart3,
  Target,
} from "lucide-react";

// Types for cookie consent
interface CookiePreferences {
  necessary: boolean;
  marketing: boolean;
  analytics: boolean;
}

interface ConsentState {
  preferences: CookiePreferences;
  timestamp: string;
  version: string;
}

const CONSENT_VERSION = "1.0.0";
const STORAGE_KEY = "cookieConsent";

// Cookie category descriptions with Emerald Royal Theme colors
const COOKIE_CATEGORIES = {
  necessary: {
    key: "necessary" as const,
    title: "Niezbędne ciasteczka",
    description:
      "Te pliki cookie są niezbędne do prawidłowego funkcjonowania strony. Umożliwiają podstawowe funkcje, takie jak nawigacja po stronie i dostęp do bezpiecznych obszarów. Strona nie może działać prawidłowo bez tych plików cookie.",
    cookies: [
      {
        name: "session",
        purpose: "Utrzymanie sesji użytkownika",
        duration: "Sesja",
      },
      {
        name: "cookieConsent",
        purpose: "Przechowywanie preferencji cookie",
        duration: "1 rok",
      },
    ],
    required: true,
    icon: Shield,
    bgColor: "bg-ui-bg",
    iconBgColor: "bg-emerald-DEFAULT/20",
    iconColor: "text-brand-DEFAULT",
    borderColor: "border-ui-border",
    switchOnColor: "bg-brand-DEFAULT",
  },
  marketing: {
    key: "marketing" as const,
    title: "Marketingowe ciasteczka",
    description:
      "Te pliki cookie służą do śledzenia odwiedzających na stronach internetowych. Celem jest wyświetlanie reklam, które są trafne i interesujące dla indywidualnego użytkownika.",
    cookies: [
      {
        name: "_fbp",
        purpose: "Facebook Pixel - śledzenie konwersji",
        duration: "3 miesiące",
      },
      {
        name: "_gcl_au",
        purpose: "Google Ads - śledzenie konwersji",
        duration: "3 miesiące",
      },
    ],
    required: false,
    icon: Target,
    bgColor: "bg-ui-bg",
    iconBgColor: "bg-emerald-DEFAULT/20",
    iconColor: "text-brand-DEFAULT",
    borderColor: "border-ui-border",
    switchOnColor: "bg-brand-DEFAULT",
  },
  analytics: {
    key: "analytics" as const,
    title: "Analityczne ciasteczka",
    description:
      "Te pliki cookie pozwalają nam zliczać wizyty i źródła ruchu, dzięki czemu możemy mierzyć i poprawiać wydajność naszej strony. Pomagają nam dowiedzieć się, które strony są najbardziej i najmniej popularne.",
    cookies: [
      {
        name: "_ga",
        purpose: "Google Analytics - identyfikacja użytkownika",
        duration: "2 lata",
      },
      {
        name: "_ga_*",
        purpose: "Google Analytics - stan sesji",
        duration: "2 lata",
      },
    ],
    required: false,
    icon: BarChart3,
    bgColor: "bg-ui-bg",
    iconBgColor: "bg-emerald-DEFAULT/20",
    iconColor: "text-brand-DEFAULT",
    borderColor: "border-ui-border",
    switchOnColor: "bg-brand-DEFAULT",
  },
};

// Update Google Consent Mode
function updateGoogleConsent(preferences: CookiePreferences) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      ad_storage: preferences.marketing ? "granted" : "denied",
      ad_user_data: preferences.marketing ? "granted" : "denied",
      ad_personalization: preferences.marketing ? "granted" : "denied",
      analytics_storage: preferences.analytics ? "granted" : "denied",
      functionality_storage: "granted",
      personalization_storage: preferences.marketing ? "granted" : "denied",
      security_storage: "granted",
    });
  }
}

// Save consent to localStorage
function saveConsent(preferences: CookiePreferences) {
  const consent: ConsentState = {
    preferences,
    timestamp: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  updateGoogleConsent(preferences);
}

// Load consent from localStorage
function loadConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const consent = JSON.parse(stored) as ConsentState;
    if (consent.version !== CONSENT_VERSION) return null;
    return consent;
  } catch {
    return null;
  }
}

// Announce to screen readers
function announceToScreenReader(message: string) {
  const announcement = document.createElement("div");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", "polite");
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;
  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showCookieButton, setShowCookieButton] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    marketing: true,
    analytics: true,
  });
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});
  const bannerRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Initialize on mount
  useEffect(() => {
    const consent = loadConsent();
    if (consent) {
      setPreferences(consent.preferences);
      updateGoogleConsent(consent.preferences);
      setShowCookieButton(true);
    } else {
      const timer = setTimeout(() => {
        setShowBanner(true);
        setTimeout(() => {
          firstFocusableRef.current?.focus();
        }, 100);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Trap focus inside banner when open
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!showBanner) return;

      if (e.key === "Escape") {
        handleAcceptNecessary();
        return;
      }

      if (e.key === "Tab") {
        const focusableElements = bannerRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusableElements?.length) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    },
    [showBanner],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const togglePreference = (category: keyof CookiePreferences) => {
    if (category === "necessary") return;
    setPreferences((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      marketing: true,
      analytics: true,
    };
    saveConsent(allAccepted);
    setPreferences(allAccepted);
    setShowBanner(false);
    setShowCookieButton(true);
    announceToScreenReader("Wszystkie pliki cookie zostały zaakceptowane");
  };

  const handleAcceptNecessary = () => {
    const necessaryOnly: CookiePreferences = {
      necessary: true,
      marketing: false,
      analytics: false,
    };
    saveConsent(necessaryOnly);
    setPreferences(necessaryOnly);
    setShowBanner(false);
    setShowCookieButton(true);
    announceToScreenReader("Zaakceptowano tylko niezbędne pliki cookie");
  };

  const handleAcceptSelected = () => {
    saveConsent(preferences);
    setShowBanner(false);
    setShowCookieButton(true);
    const accepted = [];
    if (preferences.marketing) accepted.push("marketingowe");
    if (preferences.analytics) accepted.push("analityczne");
    const message =
      accepted.length > 0
        ? `Zaakceptowano niezbędne oraz ${accepted.join(" i ")} pliki cookie`
        : "Zaakceptowano tylko niezbędne pliki cookie";
    announceToScreenReader(message);
  };

  const handleOpenSettings = () => {
    setShowBanner(true);
    setShowCookieButton(false);
  };

  return (
    <>
      {/* Cookie button in bottom left corner - Emerald Royal style */}
      {showCookieButton && !showBanner && (
        <button
          onClick={handleOpenSettings}
          className="fixed bottom-4 left-4 z-[98] p-3 bg-white border border-brand-DEFAULT/30 rounded-full shadow-marble-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-brand-DEFAULT focus:ring-offset-2 focus:ring-offset-marble-bg group"
          aria-label="Otwórz ustawienia plików cookie"
        >
          <Cookie className="w-5 h-5 text-brand-DEFAULT" />
        </button>
      )}

      {showBanner && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80 z-[99] backdrop-blur-md"
            aria-hidden="true"
            onClick={handleAcceptNecessary}
          />

          {/* Cookie Banner Modal */}
          <div
            ref={bannerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-banner-title"
            aria-describedby="cookie-banner-description"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            <div className="bg-ui-bg border border-ui-border rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.7)] max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header - Emerald Royal Theme style */}
              <div className="p-6 pb-4 bg-gradient-to-b from-emerald-DEFAULT to-ui-appBg border-b border-ui-border">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-brand-DEFAULT/10 border border-brand-DEFAULT/30 rounded-xl shadow-md">
                      <Cookie
                        className="w-6 h-6 text-brand-DEFAULT"
                        aria-hidden="true"
                      />
                    </div>
                    <h2
                      id="cookie-banner-title"
                      className="text-xl font-serif font-light tracking-wider text-marble-text uppercase"
                    >
                      Używamy{" "}
                      <span className="text-brand-DEFAULT">plików cookie</span>
                    </h2>
                  </div>
                  <button
                    ref={firstFocusableRef}
                    onClick={handleAcceptNecessary}
                    className="p-2 text-ui-textMuted hover:text-brand-DEFAULT hover:bg-brand-DEFAULT/10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-DEFAULT"
                    aria-label="Zamknij i zaakceptuj tylko niezbędne"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
                <p
                  id="cookie-banner-description"
                  className="mt-3 text-sm text-emerald-sage leading-relaxed font-light"
                >
                  Szanowni Państwo, nasz serwis stosuje pliki cookies. Głównie w
                  celach funkcjonalnych oraz w celu, by nasze usługi były
                  dostarczane na jak najwyższym poziomie. Prosimy o określenie
                  warunków przechowywania lub dostępu do nich niżej.
                </p>
              </div>

              {/* Cookie Categories - always visible */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-ui-bg">
                {(
                  Object.keys(COOKIE_CATEGORIES) as Array<
                    keyof typeof COOKIE_CATEGORIES
                  >
                ).map((categoryKey) => {
                  const category = COOKIE_CATEGORIES[categoryKey];
                  const isExpanded = expandedCategories[categoryKey];
                  const isEnabled = preferences[categoryKey];
                  const IconComponent = category.icon;

                  return (
                    <div
                      key={categoryKey}
                      className={`border ${isEnabled ? "border-brand-DEFAULT/50" : "border-ui-border"} rounded-xl overflow-hidden transition-all duration-300`}
                    >
                      <div
                        className={`flex items-center justify-between p-4 ${isEnabled ? "bg-emerald-DEFAULT/5" : "bg-transparent"} transition-colors duration-300`}
                      >
                        <button
                          onClick={() => toggleCategory(categoryKey)}
                          className="flex items-center gap-3 flex-1 text-left focus:outline-none group"
                          aria-expanded={isExpanded}
                          aria-controls={`cookie-category-${categoryKey}`}
                        >
                          <div
                            className={`p-2 ${category.iconBgColor} border border-brand-DEFAULT/20 rounded-lg group-hover:border-brand-DEFAULT/40 transition-colors`}
                          >
                            <IconComponent
                              className={`w-4 h-4 ${category.iconColor}`}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-marble-text group-hover:text-brand-DEFAULT transition-colors">
                              {category.title}
                            </span>
                            {category.required && (
                              <span className="text-[10px] px-2 py-0.5 bg-brand-DEFAULT text-white border border-brand-DEFAULT/30 rounded-full uppercase tracking-tighter font-bold">
                                Wymagane
                              </span>
                            )}
                          </div>
                          <span
                            className={`${category.iconColor} ml-auto opacity-50 group-hover:opacity-100 transition-opacity`}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </span>
                        </button>

                        {/* Toggle Switch with category color */}
                        <button
                          onClick={() => togglePreference(categoryKey)}
                          disabled={category.required}
                          className={`
                              relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ml-4
                              focus:outline-none focus:ring-2 focus:ring-brand-DEFAULT focus:ring-offset-2 focus:ring-offset-ui-appBg
                              ${category.required ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-105"}
                              ${isEnabled ? category.switchOnColor : "bg-ui-border"}
                            `}
                          role="switch"
                          aria-checked={isEnabled}
                          aria-label={`${isEnabled ? "Wyłącz" : "Włącz"} ${category.title}`}
                        >
                          <span
                            className={`
                                absolute top-1 left-1 w-4 h-4 bg-brand-light rounded-full shadow-md
                                transition-all duration-300 ease-in-out
                                ${isEnabled ? "translate-x-6" : "translate-x-0"}
                              `}
                          />
                        </button>
                      </div>

                      {/* Expanded Content */}
                      <div
                        id={`cookie-category-${categoryKey}`}
                        className={`
                            overflow-hidden transition-all duration-300 ease-in-out
                            ${isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}
                          `}
                        aria-hidden={!isExpanded}
                      >
                        <div className="p-4 pt-2 bg-marble-bg/50 border-t border-ui-border">
                          <p className="text-sm text-emerald-sage leading-relaxed mb-3 font-light">
                            {category.description}
                          </p>
                          {category.cookies.length > 0 && (
                            <div className="bg-ui-bg/50 border border-ui-border rounded-lg p-3">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-brand-DEFAULT border-b border-ui-border">
                                    <th className="pb-2 font-medium">Nazwa</th>
                                    <th className="pb-2 font-medium">Cel</th>
                                    <th className="pb-2 font-medium">Czas</th>
                                  </tr>
                                </thead>
                                <tbody className="text-ui-textLight">
                                  {category.cookies.map((cookie, index) => (
                                    <tr
                                      key={index}
                                      className="border-t border-ui-border first:border-t-0"
                                    >
                                      <td className="py-2 font-mono text-brand-DEFAULT/80 font-semibold">
                                        {cookie.name}
                                      </td>
                                      <td className="py-2">{cookie.purpose}</td>
                                      <td className="py-2 text-ui-textMuted">
                                        {cookie.duration}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer with Actions - Emerald Royal Theme style */}
              <div className="p-6 pt-4 border-t border-ui-border bg-marble-bg/60">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleAcceptNecessary}
                    className="flex-1 px-4 py-3 border border-ui-border text-marble-textSecondary font-light text-xs rounded-xl hover:bg-marble-border/20 hover:text-marble-text transition-all duration-300 tracking-widest uppercase"
                  >
                    Tylko niezbędne
                  </button>
                  <button
                    onClick={handleAcceptSelected}
                    className="flex-1 px-4 py-3 border border-brand-DEFAULT/30 text-brand-DEFAULT font-light text-xs rounded-xl hover:bg-brand-DEFAULT/10 transition-all duration-300 tracking-widest uppercase"
                  >
                    Potwierdź wybrane
                  </button>
                  <button
                    onClick={handleAcceptAll}
                    className="flex-1 px-4 py-3 bg-gradient-gold text-black font-bold text-xs rounded-xl hover:shadow-[0_0_25px_rgba(212,175,55,0.8)] transition-all duration-300 gold-glow tracking-widest uppercase border border-brand-light/30"
                  >
                    Zaakceptuj wszystkie
                  </button>
                </div>

                {/* Privacy Policy Link */}
                <div className="mt-4 text-center">
                  <Link
                    href="/polityka-prywatnosci"
                    className="text-[10px] text-ui-textMuted hover:text-brand-DEFAULT underline transition-colors focus:outline-none focus:ring-1 focus:ring-brand-DEFAULT rounded tracking-widest uppercase"
                  >
                    Polityka prywatności
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// Export utility function to check consent
export function hasConsentFor(category: keyof CookiePreferences): boolean {
  if (typeof window === "undefined") return false;
  const consent = loadConsent();
  return consent?.preferences[category] ?? false;
}

// Export function to show consent banner again
export function showConsentBanner() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

// Extend window interface for gtag
declare global {
  interface Window {
    gtag: (
      command: string,
      action: string,
      params?: Record<string, string>,
    ) => void;
    dataLayer: unknown[];
  }
}
