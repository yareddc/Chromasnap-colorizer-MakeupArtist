/**
 * Analytics abstraction.
 *
 * Keeps analytics calls separate from feature logic so a real provider
 * (Segment, Amplitude, Firebase Analytics, PostHog, etc.) can be plugged in
 * later without touching feature code. The default implementation is a
 * console logger suitable for development.
 */

export type AnalyticsEvent =
  | 'photo_uploaded'
  | 'hairstyle_started'
  | 'hairstyle_generated'
  | 'beauty_generated'
  | 'outfit_generated'
  | 'complete_look_generated'
  | 'generation_failed'
  | 'look_saved'
  | 'look_shared'
  | 'find_this_look_clicked'
  | 'product_clicked'
  | 'booking_clicked';

interface AnalyticsBackend {
  track(event: AnalyticsEvent, properties?: Record<string, unknown>): void;
}

const consoleBackend: AnalyticsBackend = {
  track(event, properties) {
    // eslint-disable-next-line no-console
    console.info('[analytics]', event, properties ?? {});
  },
};

let backend: AnalyticsBackend = consoleBackend;

export const setAnalyticsBackend = (next: AnalyticsBackend) => {
  backend = next;
};

export const track = (event: AnalyticsEvent, properties?: Record<string, unknown>) => {
  try {
    backend.track(event, properties);
  } catch {
    // Analytics must never break feature flows.
  }
};
