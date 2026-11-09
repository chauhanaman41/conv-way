export interface SpeechFormatResult {
  text: string;
  confidence?: number;
  placeholder?: string;
  statusText?: string;
}

export function formatSpeechUtterance(text?: string | null, confidence?: number): SpeechFormatResult {
  const clean = (text || '').trim();
  if (!clean) {
    return {
      text: '',
      confidence: 0,
      placeholder: 'Nothing recognized',
      statusText: 'Nothing recognized',
    };
  }

  const result: SpeechFormatResult = { text: clean };
  if (typeof confidence === 'number' && Number.isFinite(confidence) && confidence > 0) {
    result.confidence = Math.round(confidence * 100) / 100;
    result.statusText = `Recognized (${Math.round(confidence * 100)}% confidence)`;
  } else {
    result.statusText = 'Recognized';
  }
  return result;
}
