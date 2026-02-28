import React, { useEffect, useMemo, useRef } from 'react';

type TurnstileCaptchaProps = {
  siteKey: string;
  onTokenChange: (token: string) => void;
};

const TURNSTILE_SCRIPT_ID = 'cf-turnstile-script';
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const ensureTurnstileScript = () => {
  const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) return;

  const script = document.createElement('script');
  script.id = TURNSTILE_SCRIPT_ID;
  script.src = TURNSTILE_SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
};

const TurnstileCaptcha: React.FC<TurnstileCaptchaProps> = ({ siteKey, onTokenChange }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | number | null>(null);
  const containerId = useMemo(() => `turnstile-${Math.random().toString(36).slice(2, 10)}`, []);

  useEffect(() => {
    ensureTurnstileScript();

    let stopped = false;
    const startAt = Date.now();

    const tryRender = () => {
      if (stopped) return;
      if (!containerRef.current) {
        requestAnimationFrame(tryRender);
        return;
      }

      if (!window.turnstile || typeof window.turnstile.render !== 'function') {
        if (Date.now() - startAt < 10000) {
          setTimeout(tryRender, 150);
        }
        return;
      }

      if (widgetIdRef.current !== null) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onTokenChange(token),
        'expired-callback': () => onTokenChange(''),
        'error-callback': () => onTokenChange(''),
      });
    };

    tryRender();

    return () => {
      stopped = true;
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore cleanup failures
        }
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, onTokenChange]);

  return <div id={containerId} ref={containerRef} className="min-h-[65px]" />;
};

export default TurnstileCaptcha;
