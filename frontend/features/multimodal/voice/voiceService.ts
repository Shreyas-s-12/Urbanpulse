/**
 * UrbanPulse Voice Architecture Services
 * - SpeechRecognitionService: browser-native speech-to-text with multilingual locale support
 * - SpeechSynthesisService: text-to-speech feedback with locale voice selection
 * - Completely isolated; failure to access microphone never breaks text Nexus
 */

export class SpeechRecognitionService {
  private recognition: any = null;
  private isListening: boolean = false;

  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public start(
    locale: string,
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (errorMessage: string) => void,
    onEnd: () => void
  ): boolean {
    if (!SpeechRecognitionService.isSupported()) {
      onError('Speech recognition is not supported in this browser.');
      return false;
    }

    try {
      this.stop();
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionClass();
      this.recognition.lang = locale || 'en-IN';
      this.recognition.continuous = false;
      this.recognition.interimResults = true;

      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const transcript = finalTranscript || interimTranscript;
        const isFinal = Boolean(finalTranscript);
        onResult(transcript, isFinal);
      };

      this.recognition.onerror = (event: any) => {
        console.warn('[SpeechRecognition] Error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          onError('Microphone access is unavailable.');
        } else if (event.error === 'no-speech') {
          // No speech detected, silently finish
        } else {
          onError(`Speech recognition error: ${event.error}`);
        }
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.isListening = false;
        onEnd();
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (err: any) {
      console.warn('[SpeechRecognition] Start error:', err);
      onError('Microphone access is unavailable.');
      this.isListening = false;
      return false;
    }
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop errors
      }
    }
    this.isListening = false;
  }
}

export class SpeechSynthesisService {
  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window;
  }

  public static speak(
    text: string,
    locale: string = 'en-IN',
    onEnd?: () => void
  ): void {
    if (!SpeechSynthesisService.isSupported() || !text.trim()) {
      if (onEnd) onEnd();
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any pending speech

      // Clean markdown tags for natural speech
      const cleanText = text
        .replace(/[*_#`~>\[\]]/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .substring(0, 300); // Limit spoken summary length

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = locale;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select matching voice if available
      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find((v) => v.lang === locale || v.lang.startsWith(locale.split('-')[0]));
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onend = () => {
        if (onEnd) onEnd();
      };

      utterance.onerror = () => {
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[SpeechSynthesis] Spoken output error:', err);
      if (onEnd) onEnd();
    }
  }

  public static stop(): void {
    if (SpeechSynthesisService.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }
}
