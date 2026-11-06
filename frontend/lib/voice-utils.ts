"use client";

/**
 * Supported TTS & STT languages for Sarvam AI voice service.
 */
export type SupportedVoiceLanguage = "Telugu" | "Hindi" | "English";

/**
 * Map any app language string or code to the exact language name
 * expected by the Sarvam AI voice service ("Telugu" | "Hindi" | "English").
 *
 * Returns null for unsupported languages (Marathi, Punjabi, Tamil, etc.).
 */
export function mapLanguageToVoice(language: string): SupportedVoiceLanguage | null {
  const raw = (language || "").trim();
  const norm = raw.toLowerCase();
  if (norm === "telugu" || norm === "te" || norm === "te-in" || raw === "తెలుగు") return "Telugu";
  if (
    norm === "hindi" ||
    norm === "hi" ||
    norm === "hi-in" ||
    raw === "हिंदी" ||
    raw === "हिन्दी" ||
    /[\u0900-\u097F]/.test(raw)
  ) {
    return "Hindi";
  }
  if (norm === "english" || norm === "en" || norm === "en-in") return "English";
  return null;
}

/**
 * Detect script language from text Unicode characters.
 * Useful to prevent sending Telugu text with an English language tag.
 */
export function detectLanguageFromText(text: string): SupportedVoiceLanguage | null {
  if (!text) return null;
  if (/[\u0C00-\u0C7F]/.test(text)) return "Telugu";
  if (/[\u0900-\u097F]/.test(text)) return "Hindi";
  if (/[a-zA-Z]/.test(text)) return "English";
  return null;
}

/**
 * Strip common Markdown formatting from a string without touching the
 * underlying script (Telugu / Hindi Unicode characters are preserved).
 * Converts markdown table rows to readable text and strips markdown symbols.
 */
export function stripMarkdown(text: string): string {
  if (!text) return "";
  return text
    // Replace table separator rows (|---|---|)
    .replace(/\|[ \t]*[-:]+[-| :]*\|/g, "")
    // Convert table rows (| col1 | col2 |) into clean spaced sentences
    .replace(/\|[^\n]+\|/g, (match) => {
      const row = match.replace(/\|/g, " ").trim();
      return row ? `${row}. ` : "";
    })
    .replace(/#{1,6}\s*/g, "")          // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")    // bold
    .replace(/\*(.+?)\*/g, "$1")        // italic
    .replace(/`(.+?)`/g, "$1")          // inline code
    .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links
    .replace(/^\s*[-*+•]\s+/gm, "")     // bullets
    .replace(/^\s*\d+\.\s+/gm, "")      // numbers
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prepare advisory text for TTS: strip markdown, then truncate to ~400
 * characters at the nearest sentence boundary (. ! ? ।) so playback ends
 * naturally without cutting off mid-sentence.
 */
export function prepareTextForSpeech(text: string, maxChars = 400): string {
  const clean = stripMarkdown(text);
  if (clean.length <= maxChars) return clean;
  // Walk backwards from maxChars to find a sentence boundary
  let cutAt = maxChars;
  for (let i = maxChars; i > maxChars * 0.5; i--) {
    if (/[.!?।;]/.test(clean[i])) { cutAt = i + 1; break; }
  }
  return clean.slice(0, cutAt).trim();
}

/**
 * Check if the browser's speechSynthesis engine has an installed voice
 * matching the requested language code (e.g. "te" for Telugu or "hi" for Hindi).
 */
export function hasBrowserVoiceFor(lang: SupportedVoiceLanguage): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const voices = window.speechSynthesis.getVoices();
  const code = lang === "Telugu" ? "te" : lang === "Hindi" ? "hi" : "en";
  return voices.some((v) => v.lang.toLowerCase().startsWith(code));
}

/**
 * Decode a Blob (any format MediaRecorder produces, typically audio/webm),
 * down-mix to mono, resample to 16 kHz, and encode as a linear-PCM 16-bit
 * WAV Blob that Sarvam saaras:v4 accepts.
 *
 * This does real audio processing — it does not just rename the file.
 */
export async function convertBlobTo16kHzWav(blob: Blob): Promise<Blob> {
  const TARGET_SAMPLE_RATE = 16000;

  // Decode compressed audio (webm/opus, etc.) using the Web Audio API
  const arrayBuffer = await blob.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error("No audio detected. Please record again.");
  }
  const AudioContextClass =
    (typeof window !== "undefined" && (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) ||
    (typeof AudioContext !== "undefined" ? AudioContext : null);
  if (!AudioContextClass) {
    throw new Error("Web Audio API AudioContext is not supported in this browser.");
  }
  const audioCtx = new AudioContextClass();
  let decoded: AudioBuffer;
  try {
    if (audioCtx.state === "suspended") {
      await audioCtx.resume().catch(() => {});
    }
    decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    audioCtx.close().catch(() => {});
  }

  if (!decoded || decoded.length === 0) {
    throw new Error("No audio detected. Please record again.");
  }

  // Down-mix to mono by averaging all channels
  const numFrames = decoded.length;
  const numChannels = decoded.numberOfChannels;
  const monoData = new Float32Array(numFrames);
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = decoded.getChannelData(ch);
    for (let i = 0; i < numFrames; i++) monoData[i] += channelData[i] / numChannels;
  }

  // Resample from original rate → 16 kHz using linear interpolation
  const srcRate = decoded.sampleRate;
  const outFrames = Math.round((numFrames * TARGET_SAMPLE_RATE) / srcRate);
  if (outFrames === 0) {
    throw new Error("No audio detected. Please record again.");
  }
  const resampled = new Float32Array(outFrames);
  for (let i = 0; i < outFrames; i++) {
    const srcPos = (i * srcRate) / TARGET_SAMPLE_RATE;
    const srcIdx = Math.floor(srcPos);
    const frac = srcPos - srcIdx;
    const a = monoData[srcIdx] ?? 0;
    const b = monoData[srcIdx + 1] ?? 0;
    resampled[i] = a + frac * (b - a);
  }

  // Encode as WAV: 44-byte header + 16-bit PCM samples
  const dataBytes = outFrames * 2; // 2 bytes per sample (16-bit)
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);       // ChunkSize
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);                  // Subchunk1Size (PCM)
  view.setUint16(20, 1, true);                   // AudioFormat = PCM
  view.setUint16(22, 1, true);                   // NumChannels = mono
  view.setUint32(24, TARGET_SAMPLE_RATE, true);  // SampleRate
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true); // ByteRate
  view.setUint16(32, 2, true);                   // BlockAlign
  view.setUint16(34, 16, true);                  // BitsPerSample
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);           // Subchunk2Size

  // Write PCM samples (clamp to [-1, 1] to prevent clipping)
  for (let i = 0; i < outFrames; i++) {
    const s = Math.max(-1, Math.min(1, resampled[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}
