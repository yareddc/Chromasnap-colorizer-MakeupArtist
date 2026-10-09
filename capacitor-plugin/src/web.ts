import { WebPlugin, type PluginListenerHandle } from '@capacitor/core';

import type {
  ChromaSnapImageProcessorPlugin,
  AnalyzeOptions,
  EnhancementOptions,
  AnimationOptions,
  ProcessResult,
  SafetyCheckResult,
} from './index';

/**
 * Web implementation - delegates to backend API
 * Used in web builds and as fallback
 */
export class ChromaSnapImageProcessorWeb extends WebPlugin implements ChromaSnapImageProcessorPlugin {
  private apiBaseUrl = (import.meta.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_BASE_URL ||
    'http://localhost:3001') as string;

  private async parseJsonResponse(response: Response) {
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error("Backend unreachable (HTML received). Make sure the API URL points to the host computer's IP address.");
    }
    return response.json();
  }

  async checkSafety(options: AnalyzeOptions): Promise<SafetyCheckResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/analyze/safety`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: options.image }),
      });

      if (!response.ok) throw new Error('Safety check failed');
      return await this.parseJsonResponse(response);
    } catch (error) {
      console.error('Safety check failed:', error);
      return { isSafe: true, containsMinors: false, reason: '' };
    }
  }

  async upscaleImage(options: EnhancementOptions): Promise<ProcessResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/process/upscale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: options.image }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upscaling failed');
      }

      const data = await this.parseJsonResponse(response);
      return { success: true, result: data.result };
    } catch (error: any) {
      console.error('Upscale failed:', error);
      return { success: false, error: error.message || 'Upscaling failed' };
    }
  }

  async enhanceVibrancy(options: EnhancementOptions): Promise<ProcessResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/process/vibrancy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: options.image }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Enhancement failed');
      }

      const data = await this.parseJsonResponse(response);
      return { success: true, result: data.result };
    } catch (error: any) {
      console.error('Enhancement failed:', error);
      return { success: false, error: error.message || 'Enhancement failed' };
    }
  }

  async sharpenImage(options: EnhancementOptions): Promise<ProcessResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/process/sharpen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: options.image }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Sharpening failed');
      }

      const data = await this.parseJsonResponse(response);
      return { success: true, result: data.result };
    } catch (error: any) {
      console.error('Sharpen failed:', error);
      return { success: false, error: error.message || 'Sharpening failed' };
    }
  }

  async animateImage(options: AnimationOptions): Promise<ProcessResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/process/animate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: options.image }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Animation failed');
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error("Backend unreachable (HTML received). Make sure the API URL points to the host computer's IP address.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      return { success: true, result: url };
    } catch (error: any) {
      console.error('Animation failed:', error);
      return { success: false, error: error.message || 'Animation failed' };
    }
  }

  addListener(
    eventName: 'processingProgress',
    listenerFunc: (data: { progress: number; status: string }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle {
    const handler = (ev: Event) => {
      try {
        const custom = ev as CustomEvent;
        listenerFunc(custom.detail);
      } catch (e) {
        console.warn('processingProgress handler error', e);
      }
    };

    window.addEventListener(eventName, handler as EventListener);

    const remove = async () => {
      window.removeEventListener(eventName, handler as EventListener);
    };

    const handle: PluginListenerHandle = { remove };

    const promise = Promise.resolve(handle) as Promise<PluginListenerHandle> & PluginListenerHandle;
    // Attach remove onto the promise so it can be used synchronously
    (promise as any).remove = remove;

    return promise;
  }
}
