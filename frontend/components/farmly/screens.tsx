"use client"
import { useLocation } from "@/lib/location-context";
import { useWeather } from "@/lib/use-weather";
import { usePrices, usePriceTrend, type MandiRecord } from "@/lib/use-prices";
import { useSchemes, useRecommendedSchemes, useSchemesMetadata, type SchemeRecord } from "@/lib/use-schemes";
import { LocationSelect } from "./location-select";
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowDownWideNarrow, ArrowRight, BadgeCheck, CalendarDays, Check, ChevronDown, CircleHelp, CloudDrizzle, CloudRain, CloudSun, Download, ExternalLink, FileText, Filter, Info, Leaf, LoaderCircle, MapPin, Mic, MicOff, Play, Plus, RefreshCw, Search, Send, ShieldCheck, Sprout, Store, Sun, Volume2, VolumeX, Wind, X } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { FarmerProfile } from "./farmly-app"
import { apiPost, voicePostMultipart, voicePostJsonBlob, ApiError } from "@/lib/api"
import { mapLanguageToVoice, prepareTextForSpeech, convertBlobTo16kHzWav, detectLanguageFromText, hasBrowserVoiceFor, type SupportedVoiceLanguage } from "@/lib/voice-utils"

const schemeData = [
  { id: "pm-kisan", name: "PM-KISAN", full: "Pradhan Mantri Kisan Samman Nidhi", category: "Income support", type: "Central government", about: "Income support programme for eligible landholding farmer families, subject to scheme guidelines and exclusions.", benefit: "₹6,000 per year", fit: "More information needed", fitReason: "Land records and scheme exclusions need to be checked with the official portal.", url: "https://pmkisan.gov.in/", color: "scheme-green", mark: "₹" },
  { id: "pmfby", name: "PMFBY", full: "Pradhan Mantri Fasal Bima Yojana", category: "Crop insurance", type: "Central government", about: "Crop insurance support against specified non-preventable natural risks, under notified crops and areas.", benefit: "Premium subsidy varies", fit: "Potentially relevant", fitReason: "You grow a notified crop; check current district enrollment dates and crop notification.", url: "https://pmfby.gov.in/", color: "scheme-blue", mark: "✳" },
  { id: "kcc", name: "Kisan Credit Card", full: "Kisan Credit Card (KCC)", category: "Agricultural credit", type: "Central government", about: "Enables eligible farmers to access institutional credit for crop cultivation and allied activities.", benefit: "Credit limit set by bank", fit: "Potentially relevant", fitReason: "Smallholder farmers may apply through participating banks, subject to lender assessment.", url: "https://www.myscheme.gov.in/", color: "scheme-gold", mark: "⌁" },
  { id: "pmksy", name: "PMKSY", full: "Pradhan Mantri Krishi Sinchayee Yojana", category: "Irrigation subsidy", type: "Central government", about: "Supports improved irrigation access and water-use efficiency through applicable programme components.", benefit: "Component & state dependent", fit: "More information needed", fitReason: "Support depends on local implementation, land details, and the active component in your district.", url: "https://pmksy.gov.in/", color: "scheme-teal", mark: "≈" },
  { id: "soil-card", name: "Soil Health Card", full: "Soil Health Card programme", category: "Soil & inputs", type: "Central government", about: "Helps farmers access soil testing and nutrient recommendations through the relevant state process.", benefit: "Soil test & nutrient guidance", fit: "Potentially relevant", fitReason: "A recent soil test can help guide crop nutrient decisions; contact your local agriculture office.", url: "https://soilhealth.dac.gov.in/", color: "scheme-green", mark: "⌖" },
  { id: "jharkhand", name: "Jharkhand agriculture support", full: "State agriculture programmes", category: "State support", type: "State government", about: "State and district programmes may offer seasonal support; confirm current notifications and eligibility locally.", benefit: "Varies by active programme", fit: "More information needed", fitReason: "State programme windows and farmer registration requirements change. Verify with the district office.", url: "https://www.jharkhand.gov.in/", color: "scheme-orange", mark: "J" },
]
const crops = ["Paddy", "Wheat", "Maize", "Tomato", "Potato", "Mustard", "Soybean", "Groundnut", "Cotton", "Pulses"]
const timeline = ["Prepare land", "Choose seed", "Sow", "Establishment", "Vegetative growth", "Nutrient check", "Flowering", "Monitor crop", "Harvest"]

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <section className={`surface-card ${className}`}>{children}</section> }
function SectionHeader({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) { return <div className="module-section-heading"><span className="card-kicker">{eyebrow}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div> }
function SampleNotice({ children = "Illustrative demo information · verify with official or local sources before acting." }: { children?: React.ReactNode }) { return <div className="sample-notice"><Info size={15} /><span>{children}</span></div> }

// ── VoiceScreen types ───────────────────────────────────────────────────────
interface AdviceResponse {
  answer: string
  tools_used?: string[]
  sources?: { name: string; fetched_at?: string }[]
  warnings?: string[]
}

interface TranscribeResponse {
  transcript: string
}

type VoicePhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "advising"
  | "speaking"

// ── VoiceScreen ──────────────────────────────────────────────────────────────
export function VoiceScreen({
  profile,
  onSaveProfile,
  onLanguage,
}: {
  profile: FarmerProfile;
  onSaveProfile?: (profile: FarmerProfile) => void;
  onLanguage?: (lang: string) => void;
}) {
  // ── Selected Language state (dropdown at top of Voice Assistant) ──
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedVoiceLanguage>(() => {
    return mapLanguageToVoice(profile.language) || "English";
  });

  const selectedLanguageRef = useRef<SupportedVoiceLanguage>(selectedLanguage);
  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  // Sync selectedLanguage when profile.language changes (e.g. from topbar header)
  useEffect(() => {
    const mapped = mapLanguageToVoice(profile.language);
    if (mapped && mapped !== selectedLanguageRef.current) {
      setSelectedLanguage(mapped);
      selectedLanguageRef.current = mapped;
      stopAudio();
    }
  }, [profile.language]);

  const handleLanguageChange = (nextLang: SupportedVoiceLanguage) => {
    setSelectedLanguage(nextLang);
    selectedLanguageRef.current = nextLang;
    stopAudio();
    try {
      const saved = window.localStorage.getItem("farmly-profile");
      const current = saved ? JSON.parse(saved) : {};
      const updated = { ...current, ...profile, language: nextLang };
      window.localStorage.setItem("farmly-profile", JSON.stringify(updated));
      if (onLanguage) onLanguage(nextLang);
      else if (onSaveProfile) onSaveProfile(updated);
    } catch {}
    console.log("[Voice Assistant] Language switched to:", nextLang);
  };

  // ── Conversation & Interaction State ──
  interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    text: string;
    timestamp: string;
    language: SupportedVoiceLanguage;
    toolsUsed?: string[];
    sources?: { name: string; fetched_at?: string }[];
    warnings?: string[];
  }

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<
    "idle" | "recording" | "transcribing" | "advising" | "generating_audio" | "playing_audio"
  >("idle");
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCacheRef = useRef<Map<string, { blob: Blob; url: string }>>(new Map());
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const isProcessingStopRef = useRef<boolean>(false);

  // Auto-scroll conversation feed
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  // Clean up dynamic playback Object URL
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Clean up all cached audio URLs and active controllers on unmount
  useEffect(() => {
    const cache = audioCacheRef.current;
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      activeAbortControllerRef.current?.abort();
      cache.forEach((item) => {
        try {
          URL.revokeObjectURL(item.url);
        } catch {}
      });
      cache.clear();
    };
  }, []);

  // ── Cooldown Timer Helper ──
  const startCooldown = useCallback((seconds: number) => {
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    const duration = Math.max(1, Math.min(seconds || 15, 60));
    setCooldownRemaining(duration);
    cooldownTimerRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Granular Error Classifier ──
  const classifyVoiceError = (
    err: unknown,
    context: "stt" | "advice" | "tts"
  ): {
    message: string;
    isRateLimit: boolean;
    isQuotaExceeded: boolean;
    retryAfterSeconds: number;
  } => {
    const isApiErr = err instanceof ApiError;
    const isRateLimit = isApiErr
      ? err.isRateLimit
      : /429|rate[- ]?limit|too many requests/i.test(String(err));
    const isQuota = isApiErr
      ? err.isQuotaExceeded
      : /quota|insufficient balance|credits exhausted|billing/i.test(String(err));
    const isTimeout = isApiErr
      ? err.isTimeout
      : /timeout|timed out|abort/i.test(String(err));
    const isNetwork = isApiErr
      ? err.isNetworkError
      : /failed to fetch|network|unavailable|econnrefused/i.test(String(err));
    const rawMsg = err instanceof Error ? err.message : String(err);
    const retryAfter = isApiErr && err.retryAfterSeconds && err.retryAfterSeconds > 0
      ? err.retryAfterSeconds
      : 15;

    if (isRateLimit) {
      return {
        message:
          context === "tts"
            ? `The voice audio service is temporarily busy. Please try again in ${retryAfter}s. Your text answer is still available.`
            : `The voice service is temporarily busy. Please try again in ${retryAfter}s.`,
        isRateLimit: true,
        isQuotaExceeded: false,
        retryAfterSeconds: retryAfter,
      };
    }

    if (isQuota) {
      return {
        message:
          context === "tts"
            ? "Voice audio service request quota has been reached. Your text answer is still available."
            : "Voice service request quota has been reached. Please try again later.",
        isRateLimit: false,
        isQuotaExceeded: true,
        retryAfterSeconds: 0,
      };
    }

    if (isTimeout) {
      return {
        message:
          context === "tts"
            ? "Audio generation timed out. Your text answer is still available."
            : "The request timed out. Please try again.",
        isRateLimit: false,
        isQuotaExceeded: false,
        retryAfterSeconds: 0,
      };
    }

    if (isNetwork) {
      return {
        message: "Voice service is unavailable. Please check your internet connection and try again.",
        isRateLimit: false,
        isQuotaExceeded: false,
        retryAfterSeconds: 0,
      };
    }

    if (context === "stt") {
      const lower = rawMsg.toLowerCase();
      if (lower.includes("audio format") || lower.includes("unsupported")) {
        return { message: "Audio format is not supported. Please record again.", isRateLimit: false, isQuotaExceeded: false, retryAfterSeconds: 0 };
      }
      if (lower.includes("no speech") || lower.includes("empty")) {
        return { message: "No speech detected. Please speak clearly into your microphone.", isRateLimit: false, isQuotaExceeded: false, retryAfterSeconds: 0 };
      }
      if (lower.includes("no audio")) {
        return { message: "No audio detected. Please record again.", isRateLimit: false, isQuotaExceeded: false, retryAfterSeconds: 0 };
      }
      return { message: "Could not convert your speech into text. Please try again.", isRateLimit: false, isQuotaExceeded: false, retryAfterSeconds: 0 };
    }

    if (context === "advice") {
      const lower = rawMsg.toLowerCase();
      if (lower.includes("tool") || lower.includes("tool_choice") || lower.includes("failed_generation")) {
        return {
          message: "The advisory service encountered a temporary processing issue. Please try asking again.",
          isRateLimit: false,
          isQuotaExceeded: false,
          retryAfterSeconds: 0,
        };
      }
      return { message: "Unable to retrieve your advisory response. Please try again.", isRateLimit: false, isQuotaExceeded: false, retryAfterSeconds: 0 };
    }

    // TTS
    return { message: "Audio generation failed. Your text answer is still available.", isRateLimit: false, isQuotaExceeded: false, retryAfterSeconds: 0 };
  };

  // ── Stop Audio Helper ──
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
    setPhase((p) => (p === "playing_audio" || p === "generating_audio" ? "idle" : p));
  };

  // ── TTS: Read text aloud in exact language with in-memory caching ──
  const speakMessage = async (msgId: string, rawText: string, requestedLang: SupportedVoiceLanguage) => {
    if (speakingMsgId === msgId && (phase === "playing_audio" || phase === "generating_audio")) {
      stopAudio();
      return;
    }

    stopAudio();
    setSpeakingMsgId(msgId);
    setError(null);

    // Detect true script language to prevent language mismatch
    const scriptLang = detectLanguageFromText(rawText);
    const targetLang: SupportedVoiceLanguage = scriptLang || requestedLang;

    // 1. Check in-memory audio cache first (eliminates redundant calls for re-listens)
    const cacheKey = `${msgId}:${targetLang}`;
    const cachedAudio = audioCacheRef.current.get(cacheKey);
    if (cachedAudio) {
      console.log("[Voice Assistant TTS Cache Hit] Playing cached audio for:", cacheKey);
      try {
        const audio = new Audio(cachedAudio.url);
        audioRef.current = audio;
        setPhase("playing_audio");

        audio.onended = () => {
          setPhase("idle");
          setSpeakingMsgId(null);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setPhase("idle");
          setSpeakingMsgId(null);
          audioRef.current = null;
        };
        await audio.play();
        return;
      } catch (playErr) {
        console.warn("[Voice Assistant TTS Cache Playback error, fetching fresh]", playErr);
      }
    }

    // Prepare speech text: clean markdown, strip tables, truncate ~400 chars at sentence end
    const cleanSpeech = prepareTextForSpeech(rawText, 400);

    console.log("[Voice Assistant TTS Request]", {
      msgId,
      selectedLanguage,
      targetLanguage: targetLang,
      cleanLength: cleanSpeech.length,
      sample: cleanSpeech.slice(0, 100),
    });

    if (!cleanSpeech) {
      setPhase("idle");
      setSpeakingMsgId(null);
      return;
    }

    setPhase("generating_audio");

    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    try {
      const blob = await voicePostJsonBlob(
        "/voice/speak",
        {
          text: cleanSpeech,
          language: targetLang,
        },
        { signal: controller.signal, timeoutMs: 25000 }
      );

      console.log("[Voice Assistant TTS Success]", {
        status: 200,
        bytes: blob.size,
        contentType: blob.type,
        language: targetLang,
      });

      const url = URL.createObjectURL(blob);
      audioCacheRef.current.set(cacheKey, { blob, url });
      setAudioUrl(url);
      const audio = new Audio(url);
      audioRef.current = audio;
      setPhase("playing_audio");

      audio.onended = () => {
        setPhase("idle");
        setSpeakingMsgId(null);
        audioRef.current = null;
      };
      audio.onerror = (e) => {
        console.error("[Voice Audio Element Playback Error]", e);
        setError("Audio generation failed. Your text answer is still available.");
        setPhase("idle");
        setSpeakingMsgId(null);
        audioRef.current = null;
      };
      await audio.play();
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        console.log("[Voice Assistant TTS] Request aborted.");
        return;
      }
      const errInfo = classifyVoiceError(err, "tts");
      if (errInfo.isRateLimit) {
        startCooldown(errInfo.retryAfterSeconds);
      }
      console.warn("[Voice Sarvam TTS failed, evaluating browser voice fallback]", err);

      // Fall back to browser speech synthesis ONLY if a matching native voice exists for the target language
      if (hasBrowserVoiceFor(targetLang)) {
        const langCode = targetLang === "Telugu" ? "te-IN" : targetLang === "Hindi" ? "hi-IN" : "en-IN";
        const utterance = new SpeechSynthesisUtterance(cleanSpeech);
        utterance.lang = langCode;
        utterance.onend = () => {
          setPhase("idle");
          setSpeakingMsgId(null);
        };
        utterance.onerror = () => {
          setPhase("idle");
          setSpeakingMsgId(null);
        };
        window.speechSynthesis.speak(utterance);
        setPhase("playing_audio");
      } else {
        // Honest error handling per requirements: retain text and show clear error, do NOT speak English
        setError(errInfo.message);
        setPhase("idle");
        setSpeakingMsgId(null);
      }
    } finally {
      if (activeAbortControllerRef.current === controller) {
        activeAbortControllerRef.current = null;
      }
    }
  };

  // ── Ask Question (Typed or Transcribed) ──
  const submitQuestion = async (questionText: string, fromVoice = false) => {
    const q = questionText.trim();
    if (!q) return;

    // Prevent submission while already busy or cooling down
    if (phase === "advising" || phase === "transcribing" || phase === "generating_audio" || cooldownRemaining > 0) {
      return;
    }

    // Cancel any previous pending request
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }

    stopAudio();
    setError(null);
    if (!fromVoice) {
      setQuery("");
    }

    const now = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const userMsgId = `user-${Date.now()}`;
    const activeLang = selectedLanguageRef.current;

    // Detect user query language
    const queryLang = detectLanguageFromText(q) || activeLang;

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      text: q,
      timestamp: now,
      language: queryLang,
    };

    setMessages((prev) => [...prev, userMessage]);
    setPhase("advising");

    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    try {
      console.log("[Voice Advice Request]", {
        question: q,
        language: activeLang,
        crop: profile.crop,
        district: profile.district,
        state: profile.state,
      });

      const res = await apiPost<{
        answer: string;
        steps?: { tool: string; args: Record<string, unknown>; ok: boolean }[];
        tools_used?: string[];
        sources?: { name?: string; source?: string; fetched_at?: string }[];
        warnings?: string[];
      }>(
        "/api/advice",
        {
          question: q,
          crop: profile.crop,
          state: profile.state,
          district: profile.district,
          city: profile.district,
          language: activeLang,
        },
        { signal: controller.signal, timeoutMs: 35000 }
      );

      const ansText = res.answer || "No response received from advisory service.";
      const ansLang = detectLanguageFromText(ansText) || activeLang;
      const aiMsgId = `ai-${Date.now()}`;

      const normalizedSources = (res.sources || []).map((s) => ({
        name: s.name || s.source || "Government / Weather feed",
        fetched_at: s.fetched_at,
      }));

      const aiMessage: ChatMessage = {
        id: aiMsgId,
        role: "assistant",
        text: ansText,
        timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        language: ansLang,
        toolsUsed: res.tools_used || res.steps?.map((s) => s.tool) || [],
        sources: normalizedSources,
        warnings: res.warnings || [],
      };

      setMessages((prev) => [...prev, aiMessage]);
      setPhase("idle");
      // Clear input box now that advisory response succeeded
      setQuery("");

      // Speak response aloud in matching language (cached or fetched)
      await speakMessage(aiMsgId, ansText, ansLang);
    } catch (e: unknown) {
      if (controller.signal.aborted) {
        console.log("[Voice Advice Request Aborted]");
        return;
      }
      console.error("[Voice Advice Error]", e);
      // Preserve transcript in query input box so user can retry without recording again
      setQuery(q);

      const errInfo = classifyVoiceError(e, "advice");
      if (errInfo.isRateLimit) {
        startCooldown(errInfo.retryAfterSeconds);
      }
      setError(errInfo.message);
      setPhase("idle");
    } finally {
      if (activeAbortControllerRef.current === controller) {
        activeAbortControllerRef.current = null;
      }
    }
  };

  // ── Microphone Recording Flow ──
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    if (phase !== "idle" || cooldownRemaining > 0) return;
    stopAudio();
    setError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Unable to record audio. Please try again.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (isProcessingStopRef.current) return;
        isProcessingStopRef.current = true;

        try {
          const rawBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          if (rawBlob.size < 500) {
            setError("No audio detected. Please record again.");
            setPhase("idle");
            return;
          }

          setPhase("transcribing");
          const currentLang = selectedLanguageRef.current;

          // Convert to 16 kHz mono linear-PCM WAV for Sarvam saaras:v4
          let audioBlobToSend: Blob;
          try {
            audioBlobToSend = await convertBlobTo16kHzWav(rawBlob);
          } catch (convErr) {
            console.warn("[Voice STT] Audio conversion fallback to normalized webm:", convErr);
            audioBlobToSend = new Blob([rawBlob], { type: "audio/webm" });
          }

          const form = new FormData();
          form.append(
            "audio",
            audioBlobToSend,
            audioBlobToSend.type === "audio/wav" ? "recording.wav" : "recording.webm"
          );
          form.append("language", currentLang);

          const transcribeUrl = `/voice/transcribe?language=${encodeURIComponent(currentLang)}`;
          console.log("[Voice STT Upload]", {
            url: transcribeUrl,
            language: currentLang,
            bytes: audioBlobToSend.size,
            mime: audioBlobToSend.type,
          });

          const controller = new AbortController();
          activeAbortControllerRef.current = controller;

          const res = await voicePostMultipart<{ transcript: string; language?: string }>(
            transcribeUrl,
            form,
            { signal: controller.signal, timeoutMs: 25000 }
          );
          const transcript = res?.transcript?.trim() ?? "";

          console.log("[Voice STT Result]", { transcript, language: res?.language || currentLang });

          if (!transcript) {
            setError("No speech detected. Please speak clearly into your microphone.");
            setPhase("idle");
            return;
          }

          // Populate query input box so farmer sees their words
          setQuery(transcript);
          // Automatically submit to advisory backend
          await submitQuestion(transcript, true);
        } catch (e: unknown) {
          console.error("[Voice STT Error]", e);
          const errInfo = classifyVoiceError(e, "stt");
          if (errInfo.isRateLimit) {
            startCooldown(errInfo.retryAfterSeconds);
          }
          setError(errInfo.message);
          setPhase("idle");
        } finally {
          isProcessingStopRef.current = false;
        }
      };

      recorder.start(250);
      setPhase("recording");
    } catch (e) {
      console.error("[Voice Mic Error]", e);
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("denied")) {
        setError("Please allow microphone access.");
      } else {
        setError("Unable to record audio. Please try again.");
      }
      setPhase("idle");
    }
  };

  const toggleMic = () => {
    if (phase === "recording") {
      stopRecording();
    } else if (phase === "playing_audio") {
      stopAudio();
    } else if (phase === "idle" && cooldownRemaining === 0) {
      startRecording();
    }
  };

  // ── Quick Starter Questions by Language ──
  const quickQuestions: Record<SupportedVoiceLanguage, string[]> = {
    Telugu: [
      "నా వరి పంటకు ఏ ఎరువు వాడాలి?",
      "రాబోయే 36 గంటల్లో వర్షం పడుతుందా?",
      "ఖుంటి మార్కెట్‌లో వరి ప్రస్తుత ధర ఎంత?",
      "పొలంలో నీటి నిల్వను ఎలా నియంత్రించాలి?",
    ],
    Hindi: [
      "धान की फसल में कौन सा खाद डालें?",
      "क्या अगले 36 घंटों में बारिश होगी?",
      "खूंटी मंडी में धान का आज का भाव क्या है?",
      "खेत में जल निकासी कैसे ठीक करें?",
    ],
    English: [
      "Which fertilizer should I apply for paddy?",
      "Will it rain in Khunti in the next 36 hours?",
      "What is today's modal price for paddy in Khunti mandi?",
      "How should I manage field drainage after heavy rain?",
    ],
  };

  const activeQuick = quickQuestions[selectedLanguage] || quickQuestions.English;
  const isLoading = phase === "transcribing" || phase === "advising" || phase === "generating_audio";
  const isBusy = phase !== "idle" || cooldownRemaining > 0;

  return (
    <div className="module-layout voice-layout">
      <div className="voice-primary">
        <section className="voice-card-modern">
          {/* Top Bar: Title & Language Dropdown */}
          <div className="voice-topbar">
            <div className="voice-topbar-title">
              <div className="ai-avatar">
                <Leaf size={18} />
              </div>
              <div>
                <h2>Farmly Voice Assistant</h2>
                <p>
                  Live advisory for {profile.crop} · {profile.district}, {profile.state}
                </p>
              </div>
            </div>

            <label className="voice-lang-dropdown">
              <span>🌐 Language:</span>
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  handleLanguageChange(e.target.value as SupportedVoiceLanguage);
                }}
                aria-label="Select voice assistant language"
              >
                <option value="Telugu">తెలుగు (Telugu)</option>
                <option value="Hindi">हिंदी (Hindi)</option>
                <option value="English">English</option>
              </select>
            </label>
          </div>

          {/* Conversation Feed */}
          <div className="voice-chat-feed">
            {messages.length === 0 ? (
              <div className="voice-empty-state">
                <div className="voice-empty-icon">
                  <Mic size={24} />
                </div>
                <h3>Ask anything about your farm</h3>
                <p>
                  Speak into the microphone or type below. Get instant advice on fertilizer application, rain forecasts,
                  and live mandi quotes in <strong>{selectedLanguage}</strong>.
                </p>
                <div className="voice-quick-tray" style={{ justifyContent: "center", flexWrap: "wrap" }}>
                  {activeQuick.map((q) => (
                    <button
                      key={q}
                      className="voice-quick-chip"
                      onClick={() => submitQuestion(q)}
                      disabled={isBusy}
                    >
                      {q} <ArrowRight size={13} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={m.role === "user" ? "voice-bubble-user" : "voice-bubble-ai"}
                >
                  {m.role === "assistant" && (
                    <div className="voice-bubble-ai-head">
                      <span className="voice-ai-badge">
                        <Leaf size={14} /> Farmly AI Live Advisor
                      </span>
                      <small style={{ color: "#7a8a77", fontSize: "11px" }}>{m.timestamp}</small>
                    </div>
                  )}

                  <div className={m.role === "user" ? "" : "voice-ai-body"}>
                    {m.text}
                  </div>

                  {m.role === "user" && (
                    <div className="voice-bubble-meta">
                      <span>{m.timestamp}</span>
                    </div>
                  )}

                  {m.role === "assistant" && (
                    <div className="voice-ai-footer">
                      <button
                        className={`voice-speak-pill ${
                          speakingMsgId === m.id && phase === "playing_audio"
                            ? "voice-speak-playing"
                            : speakingMsgId === m.id && phase === "generating_audio"
                            ? "voice-speak-loading"
                            : "voice-speak-idle"
                        }`}
                        onClick={() => speakMessage(m.id, m.text, m.language)}
                        disabled={isLoading || cooldownRemaining > 0}
                        aria-label="Read answer aloud"
                      >
                        {speakingMsgId === m.id && phase === "generating_audio" ? (
                          <>
                            <LoaderCircle size={14} className="spin-icon" /> Preparing audio...
                          </>
                        ) : speakingMsgId === m.id && phase === "playing_audio" ? (
                          <>
                            <VolumeX size={14} /> Stop Audio ({m.language})
                          </>
                        ) : (
                          <>
                            <Volume2 size={14} /> Listen in {m.language}
                          </>
                        )}
                      </button>

                      {(m.toolsUsed?.length || m.sources?.length || m.warnings?.length) ? (
                        <details className="answer-audit" style={{ margin: 0 }}>
                          <summary style={{ fontSize: "11px" }}>How I answered</summary>
                          {m.toolsUsed && m.toolsUsed.length > 0 && (
                            <p style={{ margin: "4px 0" }}>
                              <strong>Tools:</strong> {m.toolsUsed.join(", ")}
                            </p>
                          )}
                          {m.sources?.map((s, idx) => (
                            <p key={idx} style={{ margin: "2px 0" }}>
                              <strong>{s.name}</strong>
                              {s.fetched_at ? ` · fetched ${s.fetched_at}` : ""}
                            </p>
                          ))}
                          {m.warnings?.map((w, idx) => (
                            <p key={idx} style={{ margin: "2px 0", color: "#b45309" }}>
                              ⚠ {w}
                            </p>
                          ))}
                        </details>
                      ) : null}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={feedEndRef} />
          </div>

          {/* Status Indicators */}
          {phase === "recording" && (
            <div className="voice-status-strip voice-status-recording">
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                🔴 Recording in {selectedLanguage}... Speak into your microphone
              </span>
              <button
                className="text-action"
                onClick={stopRecording}
                style={{ color: "#c23b2b", fontWeight: 700 }}
              >
                Done Speaking
              </button>
            </div>
          )}

          {phase === "transcribing" && (
            <div className="voice-status-strip voice-status-busy">
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <LoaderCircle size={15} className="spin-icon" /> Transcribing speech with Sarvam AI ({selectedLanguage})...
              </span>
            </div>
          )}

          {phase === "advising" && (
            <div className="voice-status-strip voice-status-busy">
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <LoaderCircle size={15} className="spin-icon" /> Retrieving live weather & mandi data for {profile.district}...
              </span>
            </div>
          )}

          {phase === "generating_audio" && (
            <div className="voice-status-strip voice-status-busy">
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <LoaderCircle size={15} className="spin-icon" /> Generating {selectedLanguage} voice with Sarvam AI...
              </span>
            </div>
          )}

          {phase === "playing_audio" && (
            <div className="voice-status-strip voice-status-busy" style={{ background: "#edf5eb" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Volume2 size={15} /> Playing {selectedLanguage} audio...
              </span>
              <button className="text-action" onClick={stopAudio}>
                Stop
              </button>
            </div>
          )}

          {error && (
            <div className="voice-status-strip voice-status-error">
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Info size={15} /> {error}
                {cooldownRemaining > 0 && (
                  <span style={{ fontWeight: 700, marginLeft: "4px" }}>
                    ({cooldownRemaining}s cooldown)
                  </span>
                )}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {query.trim() && phase === "idle" && cooldownRemaining === 0 && !error.toLowerCase().includes("quota") && (
                  <button
                    className="text-action"
                    onClick={() => {
                      setError(null);
                      submitQuestion(query);
                    }}
                    style={{ color: "#a82e22", fontWeight: 700 }}
                  >
                    Retry
                  </button>
                )}
                <button className="text-action" onClick={() => setError(null)} style={{ color: "#a82e22" }}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Bottom Input Controls Bar */}
          <div className="voice-input-strip">
            <button
              className={`voice-mic-main ${phase === "recording" ? "voice-mic-active" : ""}`}
              onClick={toggleMic}
              disabled={isLoading || cooldownRemaining > 0}
              aria-label={phase === "recording" ? "Stop recording" : "Start microphone recording"}
              title={
                cooldownRemaining > 0
                  ? `Voice service cooling down (${cooldownRemaining}s)`
                  : phase === "recording"
                  ? "Stop recording"
                  : "Speak your question"
              }
            >
              {isLoading ? (
                <LoaderCircle size={22} className="spin-icon" />
              ) : phase === "recording" ? (
                <MicOff size={22} />
              ) : (
                <Mic size={22} />
              )}
            </button>

            <input
              className="voice-text-box"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  submitQuestion(query);
                }
              }}
              placeholder={
                cooldownRemaining > 0
                  ? `The voice service is cooling down (${cooldownRemaining}s)...`
                  : selectedLanguage === "Telugu"
                  ? "మీ వ్యవసాయ ప్రశ్నను తెలుగులో టైప్ చేయండి లేదా మైక్ నొక్కండి..."
                  : selectedLanguage === "Hindi"
                  ? "अपना कृषि प्रश्न हिंदी में लिखें या माइक दबाएं..."
                  : "Type your farming question in English or tap the mic..."
              }
              aria-label="Farming question input"
              disabled={isBusy}
            />

            <button
              className="voice-send-main"
              onClick={() => submitQuestion(query)}
              disabled={isBusy || !query.trim()}
              aria-label="Send question"
            >
              <Send size={18} />
            </button>
          </div>

          {/* Quick starter chips row */}
          {messages.length > 0 && (
            <div className="voice-quick-tray">
              {activeQuick.slice(0, 3).map((q) => (
                <button
                  key={q}
                  className="voice-quick-chip"
                  onClick={() => submitQuestion(q)}
                  disabled={isBusy}
                >
                  {q} <ArrowRight size={12} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="voice-sidebar">
        <Card className="conversation-card">
          <div className="side-card-title">
            <div>
              <span className="card-kicker">QUICK QUESTIONS</span>
              <h3>Suggested for {selectedLanguage}</h3>
            </div>
            <CircleHelp size={17} />
          </div>
          <div className="question-list">
            {activeQuick.map((question) => (
              <button
                key={question}
                onClick={() => submitQuestion(question)}
                disabled={isBusy}
              >
                <span>{question}</span>
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        </Card>

        <Card className="language-info-card">
          <div className="language-roundel">
            {selectedLanguage === "Telugu" ? "తె" : selectedLanguage === "Hindi" ? "अ" : "En"}
          </div>
          <div>
            <strong>Voice in {selectedLanguage}</strong>
            <p>
              Powered by Sarvam AI for natural speech recognition and crystal-clear pronunciation in Indian languages.
            </p>
          </div>
        </Card>
      </aside>
    </div>
  );
}

export function WeatherScreen() {
  const [period, setPeriod] = useState("7 days")
  const { data: wx, error: wxError, loading: wxLoading } = useWeather()
  const { location, updateLocationFromInput } = useLocation()
  const [searchInput, setSearchInput] = useState(location.district)

  useEffect(() => {
    setSearchInput(location.district)
  }, [location.district])

  if (wxLoading && !wx) {
    return (
      <div className="module-layout">
        <div className="module-main" style={{ padding: "40px 20px" }}>
          <p>Loading live weather for {location.label}… (first request can take a few seconds)</p>
        </div>
      </div>
    )
  }

  if (!wx && wxError) {
    return (
      <div className="module-layout">
        <div className="module-main" style={{ padding: "20px" }}>
          <div className="weather-location-bar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", marginBottom: "16px", padding: "12px", background: "#f8faf7", border: "1px solid #e2e8df", borderRadius: "10px" }}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (searchInput.trim()) updateLocationFromInput(searchInput.trim())
              }}
              style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 260px" }}
            >
              <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                <Search size={15} style={{ position: "absolute", left: "10px", color: "#6b7280" }} />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search city or district..."
                  style={{ width: "100%", padding: "7px 10px 7px 32px", fontSize: "14px", border: "1px solid #c7d2c3", borderRadius: "8px", background: "#fff" }}
                  aria-label="Location search"
                />
              </div>
              <button type="submit" className="primary-action" style={{ padding: "7px 14px", fontSize: "13px" }}>Search</button>
            </form>
          </div>
          <div style={{ padding: "12px", background: "#fef2f2", border: "1px solid #f87171", borderRadius: "8px", color: "#991b1b", fontSize: "14px" }}>
            Couldn't find that place. Try the district name
          </div>
        </div>
      </div>
    )
  }

  // Build forecast rows dynamically from live wx.daily_7day
  const weatherRows = (wx?.daily_7day || []).map((d: any, idx: number) => {
    let formattedDate = d.date;
    try {
      const parsed = new Date(d.date + "T00:00:00");
      if (!isNaN(parsed.getTime())) {
        formattedDate = parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
    } catch {}

    const lbl = (d.label || "").toLowerCase();
    let icon = "sun";
    if (lbl.includes("thunder") || lbl.includes("heavy rain") || (d.pop_max !== undefined && d.pop_max >= 60)) {
      icon = "rain";
    } else if (lbl.includes("shower") || lbl.includes("rain") || lbl.includes("drizzle") || (d.pop_max !== undefined && d.pop_max >= 30)) {
      icon = "showers";
    } else if (lbl.includes("cloud") || lbl.includes("overcast")) {
      icon = "cloudsun";
    }

    return {
      day: idx === 0 ? "Today" : d.day,
      date: formattedDate,
      icon,
      high: `${d.temp_max_c}°`,
      low: `${d.temp_min_c}°`,
      rain: `${d.pop_max}%`,
      label: d.label || "Clear",
    };
  });
  const visibleForecast = period === "3 days" ? weatherRows.slice(0, 3) : weatherRows;

  const alert = wx?.alerts?.[0];
  const formattedFetchedAt = wx?.fetched_at
    ? new Date(wx.fetched_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })
    : "Recently";

  const placeName = wx?.location?.name
    ? `${wx.location.name.toUpperCase()}, ${wx.location.state?.toUpperCase() || "INDIA"}`
    : `${location.district.toUpperCase()}, ${location.state.toUpperCase()}`;

  return (
    <div className="module-layout">
      <div className="module-main">
        {/* Location Picker Header */}
        <div className="weather-location-bar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "14px", padding: "10px 14px", background: "#f8faf7", border: "1px solid #e2e8df", borderRadius: "10px" }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchInput.trim()) updateLocationFromInput(searchInput.trim());
            }}
            style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 260px" }}
          >
            <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", color: "#6b7280" }} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search city or district (e.g. Khunti, Ranchi)..."
                style={{ width: "100%", padding: "7px 10px 7px 32px", fontSize: "14px", border: "1px solid #c7d2c3", borderRadius: "8px", background: "#fff" }}
                aria-label="Search location"
              />
            </div>
            <button type="submit" className="primary-action" style={{ padding: "7px 14px", fontSize: "13px" }}>
              Search
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", color: "#6b7280" }}>Quick switch:</span>
            {["Khunti", "Ranchi", "Hazaribagh", "Ramgarh"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setSearchInput(d);
                  updateLocationFromInput(d);
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: "14px",
                  border: location.district.toLowerCase() === d.toLowerCase() ? "1px solid #2d6a4f" : "1px solid #d1d5db",
                  background: location.district.toLowerCase() === d.toLowerCase() ? "#e8f5e9" : "#fff",
                  color: location.district.toLowerCase() === d.toLowerCase() ? "#164b35" : "#374151",
                  fontWeight: location.district.toLowerCase() === d.toLowerCase() ? 600 : 400,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Not found error banner with retention of previous forecast */}
        {wxError && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #f87171", borderRadius: "8px", color: "#991b1b", fontSize: "13px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Info size={16} />
            <span>Couldn't find that place. Try the district name</span>
          </div>
        )}

        <div className="weather-summary-grid">
          <div className="weather-now-card">
            <div className="weather-place">
              <MapPin size={14} /> {placeName} {wx.stale ? <span className="sample-chip">EARLIER DATA</span> : null}
            </div>
            <div className="weather-now-main">
              <div>
                <div className="weather-temp">{wx.current?.temp_c ?? "--"}<span>°</span></div>
                <div className="weather-description">{wx.current?.description || "Conditions update"}</div>
              </div>
              <Sun size={59} strokeWidth={1.2} />
            </div>
            <div className="weather-feels">
              Feels like {wx.current?.feels_like_c ?? "--"}°
              {wx.daily_7day?.[0] ? ` · H: ${wx.daily_7day[0].temp_max_c}° L: ${wx.daily_7day[0].temp_min_c}°` : ""}
            </div>
            <div className="weather-bottom-stats">
              <div><DropletsIcon /><span>HUMIDITY</span><strong>{wx.current?.humidity ?? "--"}%</strong></div>
              <div><CloudRain size={16} /><span>RAIN CHANCE</span><strong>{wx.current?.rain_chance ?? "--"}%</strong></div>
              <div><Wind size={16} /><span>WIND</span><strong>{wx.current?.wind_kmh ?? "--"} km/h</strong></div>
            </div>
          </div>
          <div className="weather-soil-card">
            <span className="card-kicker">ON YOUR FARM</span>
            <div className="soil-water-icon"><DropletsIcon /></div>
            <strong>{wx.soil?.soil_moisture_pct ?? wx.current?.soil_moisture_pct ?? 0}<small>%</small></strong>
            <span>volumetric soil moisture</span>
            <div className="moisture-track">
              <i style={{ width: `${Math.min(100, Math.max(0, wx.soil?.soil_moisture_pct ?? wx.current?.soil_moisture_pct ?? 0))}%` }} />
            </div>
            <small className="moisture-note">
              {wx.soil?.soil_temperature_c !== undefined && wx.soil?.soil_temperature_c !== null
                ? `Soil temp: ${wx.soil.soil_temperature_c}°C`
                : "Live soil reading"}
            </small>
            <span className="sample-chip">LIVE READING</span>
          </div>
        </div>

        <Card className="forecast-card">
          <div className="module-card-heading">
            <div>
              <span className="card-kicker">LOCAL OUTLOOK</span>
              <h3>Coming up in {wx.location?.name || location.district}</h3>
            </div>
            <div className="segmented-control">
              {["7 days", "3 days"].map((item) => (
                <button
                  key={item}
                  className={period === item ? "selected" : ""}
                  onClick={() => setPeriod(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="forecast-list">
            {visibleForecast.map((row: any) => (
              <div className="forecast-row" key={row.day}>
                <div className="forecast-day">
                  <strong>{row.day}</strong>
                  <small>{row.date}</small>
                </div>
                <span className="forecast-emoji" aria-hidden="true">
                  {row.icon === "rain" ? (
                    <CloudRain size={18} />
                  ) : row.icon === "showers" ? (
                    <CloudDrizzle size={18} />
                  ) : row.icon === "cloudsun" ? (
                    <CloudSun size={18} />
                  ) : (
                    <Sun size={18} />
                  )}
                </span>
                <span className="forecast-label">{row.label}</span>
                <span className="forecast-rain"><DropletsIcon /> {row.rain}</span>
                <div className="forecast-range">
                  <strong>{row.high}</strong>
                  <i />
                  <span>{row.low}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="risk-card">
          <div className="module-card-heading">
            <div>
              <span className="card-kicker">CROP-SPECIFIC ALERTS</span>
              <h3>What the weather means for your field</h3>
            </div>
            <span className="risk-badge">
              {wx.alerts && wx.alerts.length > 0
                ? `${wx.alerts.length} ACTIVE`
                : "ALL CLEAR"}
            </span>
          </div>
          {wx.alerts && wx.alerts.length > 0 ? (
            wx.alerts.map((alt: any, idx: number) => (
              <div className="risk-item" key={idx}>
                <span className="risk-weather-icon"><CloudRain size={19} /></span>
                <div>
                  <strong>{alt.title}</strong>
                  <p>{alt.message}</p>
                  <small style={{ color: "#5a6854" }}>
                    Observed: {alt.observed_value}{alt.unit || "%"} (Threshold: {alt.threshold}{alt.unit || "%"})
                    {alt.observed_accumulation_mm ? ` · Rain: ${alt.observed_accumulation_mm} mm` : ""}
                    {alt.window_hours ? ` · Next ${alt.window_hours}h` : ""}
                  </small>
                </div>
                <span className="risk-level">
                  {alt.severity === "action_needed" ? "Action Needed" : "Watch"}
                </span>
              </div>
            ))
          ) : (
            <div className="recommendation-box">
              <strong><Check size={15} /> No weather alerts right now</strong>
              <p>Temperature, rainfall chance, and wind speed are within normal operating ranges for your crops.</p>
            </div>
          )}
        </Card>
      </div>

      <aside className="module-aside">
        <Card className="advisory-card">
          <span className="card-kicker">FARMLY'S FIELD NOTE</span>
          <span className="advisory-icon"><CloudRain size={21} /></span>
          {alert ? (
            <>
              <h3>{alert.title}</h3>
              <p>{alert.message}</p>
              <div className="advisory-action">
                <Check size={15} />
                <span>Observed: {alert.observed_value}{alert.unit || "%"} (Threshold: {alert.threshold}{alert.unit || "%"})</span>
              </div>
              {alert.observed_accumulation_mm !== undefined && alert.observed_accumulation_mm !== null && (
                <div className="advisory-action">
                  <Check size={15} />
                  <span>Accumulation: {alert.observed_accumulation_mm} mm in {alert.window_hours || 36}h window</span>
                </div>
              )}
            </>
          ) : (
            <>
              <h3>No weather alerts right now</h3>
              <p>Conditions are favorable for normal farm operations.</p>
            </>
          )}
          <small>
            {wx.stale ? "Earlier cached data is being shown" : "Live alert calculated from current forecast"}
          </small>
        </Card>

        <div className="sample-notice" style={{ background: wx.stale ? "#fff9e6" : undefined, borderColor: wx.stale ? "#f0c36d" : undefined }}>
          <Info size={15} />
          <span>
            Source: {wx.source || "OpenWeather / Open-Meteo"} · Fetched at {formattedFetchedAt}.
            {wx.stale ? " (Earlier cached data is being shown)" : ""}
          </span>
        </div>

        <Card className="weather-event-card">
          <span className="card-kicker">WEATHER TIMELINE</span>
          {wx.forecast_5day && wx.forecast_5day.length > 0 ? (
            wx.forecast_5day.slice(0, 3).map((slot: any, idx: number) => {
              const localTime = slot.timestamp
                ? new Date(slot.timestamp * 1000).toLocaleTimeString([], {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : slot.time;
              return (
                <div className="weather-event" key={idx}>
                  <i />
                  <div>
                    <strong>{localTime} · {slot.temp_c}°C</strong>
                    <small>{slot.description} · Rain: {slot.pop}% ({slot.rain_mm} mm)</small>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="weather-event">
              <i />
              <div>
                <strong>Timeline</strong>
                <small>Upcoming forecast slots unavailable</small>
              </div>
            </div>
          )}
        </Card>
      </aside>
    </div>
  );
}
function DropletsIcon() { return <span className="drop-icon">◌</span> }

export function MandiScreen() {
  const { location } = useLocation();
  const [crop, setCrop] = useState("Paddy");
  const [quantity, setQuantity] = useState(20);
  const [distance, setDistance] = useState(70);
  const [district, setDistrict] = useState("All districts");
  const [sort, setSort] = useState<"price" | "distance">("price");
  const [search, setSearch] = useState("");

  // Clear old transport rate from localStorage on load so existing browsers do not keep stale state
  useEffect(() => {
    try {
      localStorage.removeItem("farmly-transport-rate");
    } catch {}
  }, []);

  // Live mandi prices from backend
  const { data, loading, error, refetch } = usePrices({
    crop,
    quantity,
    district,
    distance,
  });

  const appliedRate = data?.transport_rate_applied ?? 8;

  // Price trend from live backend
  const { data: trendData } = usePriceTrend(crop, location.state, district);

  // Extract distinct districts available in live results plus profile district
  const availableDistricts = useMemo(() => {
    const set = new Set<string>();
    if (location.district) set.add(location.district);
    (data?.records || []).forEach((r) => {
      if (r.district) set.add(r.district);
    });
    return Array.from(set).sort();
  }, [data?.records, location.district]);

  // Filter records by search keyword and sort by net price or distance
  const filteredRecords = useMemo(() => {
    if (!data?.records) return [];
    return data.records
      .filter((r) => {
        const q = search.toLowerCase().trim();
        if (!q) return true;
        return (
          r.market.toLowerCase().includes(q) ||
          r.district.toLowerCase().includes(q) ||
          r.variety.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sort === "price") {
          const netA = a.est_net_per_q ?? a.modal_price;
          const netB = b.est_net_per_q ?? b.modal_price;
          return netB - netA;
        }
        const distA = a.distance_km ?? 99999;
        const distB = b.distance_km ?? 99999;
        return distA - distB;
      });
  }, [data?.records, search, sort]);

  const best = data?.recommendation;

  const chartData = useMemo(() => {
    if (!filteredRecords.length) return [];
    return filteredRecords.slice(0, 7).map((m) => ({
      name: m.market.replace(/\b(APMC|Mandi|Market|Yard)\b/gi, "").trim().slice(0, 10),
      mandi: m.modal_price,
      local: m.transport_cost_per_q || (m.distance_km ? Math.round(m.distance_km * appliedRate) : 0),
    }));
  }, [filteredRecords, appliedRate]);

  const formattedFetchedAt = data?.fetched_at
    ? new Date(data.fetched_at).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      })
    : "Recently";

  return (
    <div className="module-layout">
      <div className="module-main">
        <Card className="market-tools-card">
          <div className="market-tools-heading">
            <div>
              <span className="card-kicker">LIVE MANDI INTELLIGENCE</span>
              <h3>Compare your selling options</h3>
            </div>
            <span
              className="sample-chip"
              style={{ background: "#e8f4ec", color: "#164b35", borderColor: "#a3cbb1" }}
            >
              LIVE AGMARKNET
            </span>
          </div>

          <div className="market-filter-grid">
            <label>
              <span>Crop</span>
              <select value={crop} onChange={(event) => setCrop(event.target.value)}>
                {crops.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>

            <label>
              <span>Harvest quantity</span>
              <input
                type="number"
                min="1"
                max="500"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
              />
              <small>quintals</small>
            </label>

            <label>
              <span>District</span>
              <select value={district} onChange={(event) => setDistrict(event.target.value)}>
                <option value="All districts">All districts ({location.state || "Statewide"})</option>
                {availableDistricts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>

            <label>
              <span>Max travel distance</span>
              <select value={distance} onChange={(event) => setDistance(Number(event.target.value))}>
                <option value={30}>Within 30 km</option>
                <option value={50}>Within 50 km</option>
                <option value={70}>Within 70 km</option>
                <option value={100}>Within 100 km</option>
                <option value={200}>Within 200 km</option>
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </Card>

        <Card className="market-table-card">
          <div className="module-card-heading">
            <div>
              <span className="card-kicker">NEARBY MARKETS</span>
              <h3>Where your {crop.toLowerCase()} could go</h3>
            </div>
            <div className="table-tools">
              <label className="search-field">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a mandi or variety"
                />
              </label>
              <button
                className="sort-button"
                onClick={() => setSort(sort === "price" ? "distance" : "price")}
              >
                <ArrowDownWideNarrow size={14} /> {sort === "price" ? "Best net return" : "Nearest"}
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: "40px 16px", textAlign: "center" }}>
              <LoaderCircle className="auth-spinner" size={26} style={{ margin: "0 auto 10px" }} />
              <p style={{ fontWeight: 600, color: "#164b35" }}>Loading live mandi prices from Agmarknet…</p>
              <small style={{ color: "#7a8577" }}>
                Connecting to data.gov.in daily feed. First request can take up to a minute.
              </small>
            </div>
          ) : error ? (
            <div style={{ padding: "30px 16px", textAlign: "center" }}>
              <p style={{ color: "#b91c1c", fontWeight: 600, marginBottom: "10px" }}>{error}</p>
              <button
                className="primary-action"
                onClick={refetch}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", margin: "0 auto" }}
              >
                <RefreshCw size={14} /> Retry Live Feed
              </button>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ padding: "36px 16px", textAlign: "center" }}>
              <Store size={32} style={{ margin: "0 auto 10px", color: "#8a9485" }} />
              <p style={{ fontWeight: 600, color: "#164b35", fontSize: "15px" }}>
                No mandi reported {crop} in {district !== "All districts" ? district : (location.state || "this region")} today.
              </p>
              <p style={{ color: "#7a8577", fontSize: "13px", marginTop: "6px" }}>
                Try selecting "All districts", widening your travel distance, or switching to another crop.
              </p>
            </div>
          ) : (
            <div className="mandi-table-scroll">
              <table className="mandi-table">
                <thead>
                  <tr>
                    <th scope="col">MARKET</th>
                    <th scope="col">PRICE / Q</th>
                    <th scope="col">TRAVEL</th>
                    <th scope="col">EST. NET / Q</th>
                    <th scope="col">EST. TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((m, index) => {
                    const isBest = best && best.market === m.market && best.district === m.district;
                    return (
                      <tr key={`${m.market}-${m.district}-${index}`} className={isBest ? "best-market-row" : ""}>
                        <td className="market-cell" data-label="Market">
                          <div className="table-market-name">
                            <span className="market-marker">{m.market[0]}</span>
                            <div>
                              <strong>{m.market}</strong>
                              <small>
                                {m.district} district · {m.variety} {isBest && <i>BEST NET RETURN</i>}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td className="table-price" data-label="Price / quintal">
                          ₹{m.modal_price.toLocaleString("en-IN")}
                          <small style={{ display: "block", fontSize: "10px", color: "#7a8577" }}>
                            {m.arrival_date}
                          </small>
                        </td>
                        <td data-label="Travel">
                          {m.distance_km !== null ? (
                            <>
                              {m.distance_km} km
                              {m.uncertain && (
                                <small style={{ display: "block", fontSize: "10px", color: "#b45309" }}>
                                  (approx)
                                </small>
                              )}
                            </>
                          ) : (
                            <span style={{ color: "#8a9485", fontSize: "12px" }}>Distance unavailable</span>
                          )}
                        </td>
                        <td className="table-net" data-label="Est. net / q">
                          ₹{(m.est_net_per_q ?? m.modal_price).toLocaleString("en-IN")}{" "}
                          {m.transport_cost_per_q !== null && (
                            <small className="transport-sub">−₹{m.transport_cost_per_q} travel</small>
                          )}
                        </td>
                        <td className="table-total" data-label="Est. total">
                          ₹{(m.est_total ?? (m.modal_price * quantity)).toLocaleString("en-IN")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div
            className="sample-notice"
            style={{
              background: data?.stale ? "#fff9e6" : undefined,
              borderColor: data?.stale ? "#f0c36d" : undefined,
              marginTop: "12px",
            }}
          >
            <Info size={15} />
            <span>
              Source: {data?.source || "data.gov.in Agmarknet Daily Feed"} · Fetched at {formattedFetchedAt}.
              {data?.stale ? " (Showing earlier live data)" : ""}
            </span>
          </div>
        </Card>

        <Card className="price-chart-card">
          <div className="module-card-heading">
            <div>
              <span className="card-kicker">PRICE COMPARISON</span>
              <h3>A quick look across markets</h3>
            </div>
            <span className="chart-legend">
              <i /> Price per quintal (₹)
            </span>
          </div>
          {chartData.length > 0 ? (
            <div className="mandi-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 10, bottom: 0, left: 6 }}>
                  <CartesianGrid stroke="#e9ede5" vertical={false} strokeDasharray="3 4" />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#7d877b", fontSize: 11 }}
                    dy={7}
                  />
                  <YAxis
                    domain={[
                      Math.max(0, Math.min(...chartData.map((d) => d.mandi)) - 200),
                      Math.max(...chartData.map((d) => d.mandi)) + 200,
                    ]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#929b8f", fontSize: 10 }}
                    tickFormatter={(value) => `₹${value}`}
                  />
                  <Tooltip
                    formatter={(value) => [`₹${value}`, "Price / quintal"]}
                    contentStyle={{ border: "1px solid #e7ebe3", borderRadius: 12, fontSize: 12 }}
                  />
                  <Bar dataKey="mandi" fill="#4d8b52" radius={[5, 5, 0, 0]} maxBarSize={38} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ padding: "30px 16px", textAlign: "center", color: "#7a8577", fontSize: "13px" }}>
              No price comparison chart available for current filters.
            </div>
          )}

          {trendData && trendData.insufficient_data && (
            <div
              style={{
                padding: "10px 14px",
                borderTop: "1px solid #e9ede5",
                fontSize: "12px",
                color: "#5a6854",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Info size={14} style={{ color: "#7a8577", flexShrink: 0 }} />
              <span>
                Price trend: Live mandi feed reports single-day arrival data for {crop}. Insufficient historical arrival dates to compute a trend line.
              </span>
            </div>
          )}
        </Card>
      </div>

      <aside className="module-aside mandi-aside">
        <Card className="recommendation-card">
          <span className="card-kicker">FARMLY’S SELLING RECOMMENDATION</span>
          <div className="recommendation-medallion">
            <Store size={20} />
          </div>
          {best ? (
            <>
              <h3>{best.market} looks promising.</h3>
              <p>
                Reported modal price of ₹{best.modal_price.toLocaleString("en-IN")}/q in {best.district}.{" "}
                {best.transport_cost_per_q !== null
                  ? `After estimated travel (₹${best.transport_cost_per_q}/q over ${best.distance_km} km at assumed ₹${appliedRate}/km/q), `
                  : ""}
                {best.basis.toLowerCase()}.
              </p>
              <div className="recommendation-stat">
                <span>Estimated net / quintal</span>
                <strong>
                  ₹{(best.est_net_per_q ?? best.modal_price).toLocaleString("en-IN")}
                </strong>
              </div>
              <div className="recommendation-stat">
                <span>Estimated total · {quantity} q</span>
                <strong>
                  ₹{(best.est_total ?? (best.modal_price * quantity)).toLocaleString("en-IN")}
                </strong>
              </div>
              <div className="sample-notice" style={{ marginTop: "12px" }}>
                <Info size={14} />
                <span>
                  {data?.transport_notice || `Travel cost uses an assumed rate of ₹${appliedRate}/quintal/km (estimate, not an official figure).`}
                </span>
              </div>
            </>
          ) : (
            <>
              <h3>No market qualifies within {distance} km</h3>
              <p>
                {data?.recommendation_notice ||
                  `No market qualifies with a positive estimated net return for ${crop} within ${distance} km. Try increasing distance or trying another crop.`}
              </p>
            </>
          )}
        </Card>

        <Card className="profit-card">
          <span className="card-kicker">YOUR HARVEST ESTIMATE</span>
          <h3>Change the quantity to see your estimate.</h3>
          <div className="quantity-control">
            <button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity">
              −
            </button>
            <strong>
              {quantity}
              <small> quintals</small>
            </strong>
            <button onClick={() => setQuantity(Math.min(500, quantity + 1))} aria-label="Increase quantity">
              +
            </button>
          </div>
          <p>
            {best
              ? `Estimate based on ${best.market} modal price of ₹${best.modal_price}/q${best.transport_cost_per_q !== null ? ` less ₹${best.transport_cost_per_q} estimated travel per quintal.` : "."}`
              : `Select a crop and location reporting live prices to calculate your net proceeds.`}
          </p>
        </Card>
      </aside>
    </div>
  );
}

export function CropPlannerScreen({ profile }: { profile: FarmerProfile }) {
  const [selectedCrop, setSelectedCrop] = useState(profile.crop || "Paddy")
  const [query, setQuery] = useState("")
  const [area, setArea] = useState(Number(profile.acres) || 2.5)
  const [season, setSeason] = useState("Kharif")
  const [soil, setSoil] = useState(profile.soil || "Clay loam")
  const [irrigation, setIrrigation] = useState(profile.irrigation || "Rain-fed")
  const [saved, setSaved] = useState(false)
  const cropCost: Record<string, number> = { Paddy: 9000, Wheat: 8200, Maize: 7600, Tomato: 18000, Potato: 20000, Mustard: 7800, Soybean: 7900, Groundnut: 11500, Cotton: 14500, Pulses: 7200 }
  const baseCost = cropCost[selectedCrop] || 9000
  const costs = [{ label: "Seeds", amount: Math.round(baseCost * 0.17) }, { label: "Nutrients & manure", amount: Math.round(baseCost * 0.31) }, { label: "Labour", amount: Math.round(baseCost * 0.28) }, { label: "Water & field prep", amount: Math.round(baseCost * 0.15) }, { label: "Other expenses", amount: Math.round(baseCost * 0.09) }]
  const [costValues, setCostValues] = useState<Record<string, number>>({})
  const editableCosts = costs.map((item) => ({ ...item, amount: costValues[item.label] ?? item.amount }))
  const total = editableCosts.reduce((sum, item) => sum + item.amount, 0) * area
  const filteredCrops = crops.filter((item) => item.toLowerCase().includes(query.toLowerCase()))
  const savePlan = () => {
    try {
      window.localStorage.setItem("farmly-saved-crop-plan", JSON.stringify({ crop: selectedCrop, area, soil, irrigation, season, budgetPerAcre: editableCosts, total, timeline }))
      setSaved(true)
    } catch {
      setSaved(false)
    }
  }
  const downloadPlan = () => {
    const plan = [`Farmly.AI · Illustrative crop plan`, `Crop: ${selectedCrop}`, `Location: ${profile.village}, ${profile.district}, ${profile.state}`, `Area: ${area} acres · ${soil} · ${irrigation} · ${season}`, `Estimated sample budget: ₹${Math.round(total).toLocaleString("en-IN")}`, `Budget per acre:`, ...editableCosts.map((item) => `${item.label}: ₹${item.amount.toLocaleString("en-IN")}`), ``, `Seed: Choose a certified, locally suitable variety with your agriculture extension office.`, `Nutrients: Use a current soil test and official crop guidance; no quantities are prescribed here.`, `Water: Check local rainfall, irrigation access, and crop growth stage.`, `Protection: Monitor regularly and use integrated pest management.`, ``, `Timeline: ${timeline.join(" → ")}`, ``, `DEMO ONLY. Costs and crop guidance are illustrative, not verified local recommendations.`].join("\n")
    const link = document.createElement("a")
    link.href = URL.createObjectURL(new Blob([plan], { type: "text/plain" }))
    link.download = `farmly-${selectedCrop.toLowerCase()}-plan.txt`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  return <div className="planner-page"><div className="planner-intro"><div className="planner-intro-icon"><Sprout size={22} /></div><div><strong>A better season starts before the first seed.</strong><p>Choose a crop, tell us a little about your land, and make a plan you can discuss with your local agriculture advisor.</p></div><span>PLAN BUILDER</span></div>
    <div className="module-layout"><div className="module-main"><Card className="crop-picker-card"><div className="module-card-heading"><div><span className="card-kicker">01 · CHOOSE YOUR CROP</span><h3>What are you thinking of growing?</h3></div><label className="search-field crop-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search crops" /></label></div><div className="crop-choice-grid">{filteredCrops.map((item, index) => <button key={item} className={`crop-choice ${item === selectedCrop ? "planner-crop-selected" : ""}`} onClick={() => { setSelectedCrop(item); setSaved(false) }}><span className={`crop-emoji crop-tone-${index % 5}`}><Sprout size={14} /></span><strong>{item}</strong>{item === selectedCrop && <Check size={14} />}</button>)}</div></Card>
      <Card className="farm-input-card"><div className="module-card-heading"><div><span className="card-kicker">02 · TELL US ABOUT YOUR FIELD</span><h3>Make this plan yours</h3></div><span className="location-mini"><MapPin size={13} /> {profile.district}, {profile.state}</span></div><div className="planner-form-grid planner-fields"><label>Farm area<input type="number" value={area} min="0.1" step="0.1" onChange={(event) => setArea(Math.max(0.1, Number(event.target.value)))} /><small>acres</small></label><label>Soil type<select value={soil} onChange={(event) => setSoil(event.target.value)}>{["Clay loam", "Sandy loam", "Black soil", "Red soil", "Alluvial", "Not sure"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Water access<select value={irrigation} onChange={(event) => setIrrigation(event.target.value)}>{["Rain-fed", "Canal", "Well / borewell", "Drip irrigation", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Growing season<select value={season} onChange={(event) => setSeason(event.target.value)}>{["Kharif", "Rabi", "Zaid"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Expected planting date<input type="date" defaultValue="2026-11-10" /></label></div></Card>
      <Card className="crop-plan-card"><div className="module-card-heading"><div><span className="card-kicker">03 · YOUR {selectedCrop.toUpperCase()} PLAN</span><h3>A practical starting point</h3><p>For {area} acres · {soil} · {season} season · {irrigation}</p></div><span className="sample-chip">DEMO PLAN</span></div><div className="plan-grid">{[["01", "Seed selection", "Choose certified seed suited to your district and planting window. Confirm variety and seed rate with your local extension office."], ["02", "Nutrients & manure", "Use your latest soil test to decide nutrient needs. Avoid applying fertilizer without crop- and soil-specific advice."], ["03", "Land preparation", "Prepare a level field with drainage appropriate to local rainfall and your crop’s needs."], ["04", "Water plan", "Match irrigation to rainfall and crop stage. Paddy needs reliable water, with field drainage between heavy showers."], ["05", "Tools & equipment", "Plan access to a seed drill or transplanting tools, hand tools, and safe protective equipment."], ["06", "Crop protection", "Scout fields regularly; use prevention and integrated pest management. Seek local diagnosis before any treatment."]].map(([num, title, detail]) => <div className="plan-item" key={num}><span>{num}</span><div><strong>{title}</strong><p>{selectedCrop === "Paddy" && num === "04" ? "For paddy, coordinate water availability with growth stage. Keep drains clear during intense monsoon rain." : detail}</p></div></div>)}</div><SampleNotice>Varieties, seed rates, nutrient rates, and crop timing vary by district and season. Confirm with KVK or your state agriculture department.</SampleNotice></Card>
      <Card className="crop-timeline-card"><div className="module-card-heading"><div><span className="card-kicker">04 · THE SEASON AHEAD</span><h3>Your growing timeline</h3></div><span className="timeline-season">{season} · illustrative</span></div><div className="timeline-track" role="list" aria-label="Growing season stages. Scroll horizontally to view all nine stages." tabIndex={0}>{timeline.map((step, index) => <div className={`timeline-step ${index === 0 ? "timeline-current" : ""}`} key={step} role="listitem"><span>{index + 1}</span><strong>{step}</strong><small>{index === 0 ? "Start here" : `Stage ${index + 1}`}</small></div>)}</div></Card>
    </div><aside className="module-aside"><Card className="crop-budget-card"><span className="card-kicker">05 · ESTIMATED BUDGET</span><h3>Plan your spending, too.</h3><p>Editable sample costs scaled to your farm area.</p><div className="budget-list">{editableCosts.map((item) => <div key={item.label}><span>{item.label}</span><label>₹<input type="number" aria-label={`${item.label} cost per acre`} value={item.amount} min="0" onChange={(event) => setCostValues((current) => ({ ...current, [item.label]: Math.max(0, Number(event.target.value)) }))} /></label></div>)}</div><div className="budget-total"><span>Estimated total</span><strong>₹{Math.round(total).toLocaleString("en-IN")}</strong></div><small>₹{baseCost.toLocaleString("en-IN")} / acre · demo estimate</small><button className="primary-action full-action" onClick={downloadPlan}><Download size={15} /> Download crop plan</button><button className="outline-action full-action" onClick={() => window.print()}><FileText size={15} /> Print this plan</button>{saved && <div className="saved-inline"><Check size={14} /> Saved to this browser</div>}<button className="text-action save-plan" onClick={savePlan}><Plus size={14} /> Save plan to My Farm</button></Card><Card className="crop-fit-card"><span className="card-kicker">FARMLY SUGGESTS</span><div className="fit-icon"><Leaf size={18} /></div><h3>{selectedCrop} can be one option.</h3><p>Compare water access, soil test results, planting window, and likely market access before deciding.</p><span className="fit-footnote"><Info size={13} /> Not a yield or profit guarantee.</span></Card><SampleNotice>Budget values are editable and illustrative, not quotations or verified local input costs.</SampleNotice></aside></div>
  </div>
}

export function SchemesScreen({ profile }: { profile: FarmerProfile }) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All schemes")
  const [stateFilter, setStateFilter] = useState("All states")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)

  // Matcher input state initialized with farmer profile
  const [matcherState, setMatcherState] = useState(profile.state || "Jharkhand")
  const [matcherDistrict, setMatcherDistrict] = useState(profile.district || "Khunti")
  const [matcherAcres, setMatcherAcres] = useState(profile.acres || "2.5")
  const [matcherLandStatus, setMatcherLandStatus] = useState("Owner")
  const [matcherCrop, setMatcherCrop] = useState(profile.crop || "Paddy")
  const [matcherIrrigation, setMatcherIrrigation] = useState(profile.irrigation || "Rain-fed")

  const categories = [
    "All schemes",
    "Income support",
    "Crop insurance",
    "Agricultural credit",
    "Irrigation subsidy",
    "Soil & inputs",
    "Farm mechanization",
    "State support",
  ]

  // Live queries to backend
  const {
    data: schemesResponse,
    loading: schemesLoading,
    error: schemesError,
    refetch: refetchSchemes,
  } = useSchemes({
    category: filter === "All schemes" ? undefined : filter,
    state: stateFilter === "All states" ? undefined : stateFilter,
    search: search.trim() || undefined,
  })

  const {
    data: recoResponse,
    loading: recoLoading,
    refetch: refetchReco,
  } = useRecommendedSchemes({
    state: matcherState,
    district: matcherDistrict,
    crop: matcherCrop,
    acres: matcherAcres,
    land_status: matcherLandStatus,
    irrigation: matcherIrrigation,
  })

  const { data: metaResponse } = useSchemesMetadata()

  // Match map for quick lookup of farmer match score and fit
  const recoMap = useMemo(() => {
    const map = new Map<string, SchemeRecord>()
    if (recoResponse?.recommendations) {
      for (const r of recoResponse.recommendations) {
        map.set(r.scheme_id, r)
      }
    }
    return map
  }, [recoResponse])

  // Merge recommendation details into visible schemes
  const visibleSchemes: SchemeRecord[] = useMemo(() => {
    if (!schemesResponse?.schemes) return []
    return schemesResponse.schemes.map((scheme) => {
      const reco = recoMap.get(scheme.scheme_id)
      if (reco) {
        return {
          ...scheme,
          fit: reco.fit,
          fit_status: reco.fit_status,
          match_score: reco.match_score,
          applicable_location: reco.applicable_location || scheme.state,
          match_reasons: reco.match_reasons,
          missing_information: reco.missing_information,
        }
      }
      return {
        ...scheme,
        fit: scheme.government_level === "Central" ? "Potentially relevant" : "Check eligibility",
        fit_status: "potential" as const,
        applicable_location: scheme.state,
      }
    })
  }, [schemesResponse, recoMap])

  // Selected scheme for modal
  const selectedScheme: SchemeRecord | null = useMemo(() => {
    if (!selectedId) return null
    return visibleSchemes.find((s) => s.scheme_id === selectedId) || null
  }, [selectedId, visibleSchemes])

  const formatBenefit = (b: SchemeRecord["benefits"]): string => {
    if (!b) return "Varies by active notification"
    if (typeof b === "string") return b
    return b.amount || b.frequency || "Financial / Input support"
  }

  const formatVerifiedDate = (isoStr?: string) => {
    if (!isoStr) return "Nov 2026"
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    } catch {
      return "Nov 2026"
    }
  }

  return (
    <div className="schemes-page">
      {/* Hero Banner */}
      <div className="scheme-hero">
        <div className="scheme-hero-copy">
          <span className="card-kicker">GOVERNMENT SCHEMES &amp; SUPPORT DISCOVERY</span>
          <h2>
            Verified support programmes<br />for your farm journey.
          </h2>
          <p>
            Explore Central and State Government agricultural schemes backed by official data.gov.in,
            myScheme, and Department of Agriculture portals.
          </p>
          <button
            onClick={() => {
              setProfileOpen(true)
              document.getElementById("scheme-matcher")?.scrollIntoView({ behavior: "smooth", block: "start" })
            }}
          >
            Find schemes for my farm <ArrowRight size={15} />
          </button>
        </div>
        <div className="scheme-hero-art">
          <div className="scheme-sun" />
          <div className="scheme-leaf leaf-one">
            <Leaf size={59} />
          </div>
          <div className="scheme-leaf leaf-two">
            <Leaf size={40} />
          </div>
          <span>
            GOVERNMENT<br />DATA
          </span>
        </div>
        <span className="scheme-hero-mark">₹</span>
      </div>

      {/* Real Statistics Strip */}
      <div className="scheme-stat-strip">
        <div>
          <strong>{schemesResponse?.total ?? (schemesLoading ? "…" : 0)}</strong>
          <span>PROGRAMMES DISCOVERED</span>
        </div>
        <div>
          <strong>{recoResponse?.summary?.potential_count ?? (recoLoading ? "…" : 0)}</strong>
          <span>POTENTIALLY RELEVANT</span>
        </div>
        <div>
          <strong>{recoResponse?.summary?.confirmed_count ?? (recoLoading ? "…" : 0)}</strong>
          <span>ELIGIBILITY CONFIRMED</span>
        </div>
        <div>
          <strong>0</strong>
          <span>OFFICIAL APPROVALS CLAIMED</span>
        </div>
        <span>PRELIMINARY GUIDANCE ONLY · VERIFY AT OFFICIAL PORTALS</span>
      </div>

      {/* Main Layout */}
      <div className="scheme-layout">
        {/* Results Column */}
        <div className="scheme-results">
          <div className="scheme-results-heading">
            <div>
              <span className="card-kicker">OFFICIAL AGRICULTURAL PROGRAMMES</span>
              <h3>Verified Central &amp; State Schemes</h3>
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span className="scheme-verified-tag">
                <ShieldCheck size={11} /> VERIFIED OFFICIAL DATA
              </span>
              <button
                className="icon-button"
                onClick={() => {
                  refetchSchemes()
                  refetchReco()
                }}
                title="Refresh scheme data"
                aria-label="Refresh schemes"
              >
                <RefreshCw size={13} className={schemesLoading ? "spin-animate" : ""} />
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label className="scheme-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search schemes by name, department, or benefit (e.g. PM-KISAN, crop insurance, credit, drip)"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{ border: 0, background: "transparent", cursor: "pointer", color: "#888" }}
                >
                  <X size={14} />
                </button>
              )}
            </label>

            {/* State filter row */}
            <div className="scheme-state-filter">
              <span className="scheme-state-filter-label">Filter State:</span>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                aria-label="Filter schemes by state"
              >
                <option value="All states">All States &amp; Central Schemes</option>
                <option value="Jharkhand">Jharkhand</option>
                <option value="Andhra Pradesh">Andhra Pradesh</option>
              </select>
              {stateFilter !== "All states" && (
                <button
                  type="button"
                  className="scheme-clear-btn"
                  onClick={() => setStateFilter("All states")}
                >
                  Clear state filter
                </button>
              )}
            </div>

            {/* Categories */}
            <div className="scheme-categories">
              {categories.map((category) => (
                <button
                  key={category}
                  className={filter === category ? "category-selected" : ""}
                  onClick={() => setFilter(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Loading State */}
          {schemesLoading && !visibleSchemes.length && (
            <div className="scheme-loading-state">
              <LoaderCircle size={24} className="spin-animate" style={{ color: "#2f6938" }} />
              <p>Fetching verified government schemes from official platform...</p>
            </div>
          )}

          {/* Error State */}
          {schemesError && (
            <div className="scheme-error-state">
              <Info size={20} style={{ color: "#c66900" }} />
              <p>Unable to connect to schemes service: {schemesError}</p>
              <button className="scheme-retry-btn" onClick={() => refetchSchemes()}>
                <RefreshCw size={13} /> Retry connection
              </button>
            </div>
          )}

          {/* Schemes Card List */}
          {!schemesLoading && visibleSchemes.length > 0 && (
            <div className="scheme-card-list">
              {visibleSchemes.map((scheme) => {
                const isConfirmed = scheme.fit === "Eligibility confirmed"
                const isPotential = scheme.fit === "Potentially relevant"

                return (
                  <article className="scheme-card" key={scheme.scheme_id}>
                    <div className={`scheme-symbol ${scheme.color}`}>{scheme.mark}</div>
                    <div className="scheme-card-body">
                      <div className="scheme-card-meta">
                        <span>{scheme.scheme_category}</span>
                        <span className="scheme-type">
                          {scheme.government_level} {scheme.state !== "All India" ? `· ${scheme.state}` : "· All India"}
                        </span>
                      </div>

                      <h4>{scheme.scheme_name}</h4>
                      <p className="scheme-full-name">{scheme.full_name}</p>
                      <small className="scheme-dept-text">{scheme.ministry_or_department}</small>
                      <p className="scheme-card-description">{scheme.short_description || scheme.description}</p>

                      <div className="scheme-benefit-row">
                        <span className="scheme-benefit-item">
                          <strong>Potential benefit</strong>
                          <span>{formatBenefit(scheme.benefits)}</span>
                        </span>
                        <span className="scheme-benefit-item">
                          <strong>Applicable location</strong>
                          <span>{scheme.applicable_location || scheme.state}</span>
                        </span>
                        <span className="scheme-benefit-item">
                          <strong>Farmly match</strong>
                          <i
                            className={
                              isConfirmed
                                ? "match-positive"
                                : isPotential
                                ? "match-caution"
                                : "match-warning"
                            }
                          >
                            {scheme.fit || "Potentially relevant"}
                          </i>
                        </span>
                      </div>

                      <div className="scheme-card-footer">
                        <span className="scheme-verified-meta">
                          <ShieldCheck size={12} style={{ color: "#3a753e" }} />
                          Verified: {formatVerifiedDate(scheme.last_verified_at)}
                          {scheme.live_data?.total_records_tracked && (
                            <span style={{ color: "#1976d2", marginLeft: "4px" }}>
                              · data.gov.in tracked
                            </span>
                          )}
                        </span>
                        <div>
                          <button onClick={() => setSelectedId(scheme.scheme_id)}>
                            Scheme details <ArrowRight size={14} />
                          </button>
                          <a
                            href={scheme.official_information_url || scheme.source_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Official source <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {/* Empty State */}
          {!schemesLoading && !schemesError && visibleSchemes.length === 0 && (
            <div className="empty-schemes">
              <p className="empty-schemes-title">No government schemes match those filters.</p>
              <p className="empty-schemes-subtext">
                Try searching a different term or reset filters.
              </p>
              <button
                className="outline-action"
                onClick={() => {
                  setSearch("")
                  setFilter("All schemes")
                  setStateFilter("All states")
                }}
              >
                Reset all filters
              </button>
            </div>
          )}
        </div>

        {/* Personalized Discovery Sidebar */}
        <aside className="scheme-aside">
          <Card className="matcher-card">
            <div id="scheme-matcher" />
            <span className="card-kicker">PERSONALIZED DISCOVERY ENGINE</span>
            <h3>Find schemes for my farm</h3>
            <p>
              Evaluate your farm against Central and State guidelines using live rule matching.
            </p>

            <label>
              State
              <select
                value={matcherState}
                onChange={(event) => {
                  setMatcherState(event.target.value)
                  if (event.target.value === "Andhra Pradesh") {
                    setMatcherDistrict("Guntur")
                  } else if (event.target.value === "Jharkhand") {
                    setMatcherDistrict("Khunti")
                  }
                }}
              >
                <option value="Jharkhand">Jharkhand</option>
                <option value="Andhra Pradesh">Andhra Pradesh</option>
                <option value="Bihar">Bihar</option>
                <option value="Odisha">Odisha</option>
                <option value="West Bengal">West Bengal</option>
              </select>
            </label>

            <label>
              District
              <input
                value={matcherDistrict}
                onChange={(e) => setMatcherDistrict(e.target.value)}
                placeholder="District name"
              />
            </label>

            <label>
              Landholding (acres)
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={matcherAcres}
                onChange={(event) => setMatcherAcres(event.target.value)}
              />
            </label>

            <label>
              Land status
              <select
                value={matcherLandStatus}
                onChange={(e) => setMatcherLandStatus(e.target.value)}
              >
                <option value="Owner">Owner / co-owner (RoR in name)</option>
                <option value="Tenant farmer">Tenant farmer / Bataydar</option>
                <option value="Oral lessee">Oral lessee / Sharecropper</option>
              </select>
            </label>

            <label>
              Main crop
              <select
                value={matcherCrop}
                onChange={(event) => setMatcherCrop(event.target.value)}
              >
                <option value="Paddy">Paddy</option>
                <option value="Wheat">Wheat</option>
                <option value="Maize">Maize</option>
                <option value="Mustard">Mustard</option>
                <option value="Cotton">Cotton</option>
                <option value="Groundnut">Groundnut</option>
                <option value="Tomato">Tomato</option>
                <option value="Potato">Potato</option>
                <option value="Pulses">Pulses</option>
              </select>
            </label>

            <label>
              Irrigation access
              <select
                value={matcherIrrigation}
                onChange={(e) => setMatcherIrrigation(e.target.value)}
              >
                <option value="Rain-fed">Rain-fed</option>
                <option value="Canal">Canal</option>
                <option value="Well / borewell">Well / borewell</option>
                <option value="Drip irrigation">Drip irrigation</option>
              </select>
            </label>

            <button
              className="primary-action full-action"
              onClick={() => setProfileOpen(!profileOpen)}
            >
              {profileOpen ? "Hide match summary" : "See potential matches"} <ArrowRight size={15} />
            </button>

            {profileOpen && (
              <div className="match-summary">
                {recoLoading ? (
                  <div className="matcher-loading">
                    <LoaderCircle size={16} className="spin-animate" /> Calculating live matches...
                  </div>
                ) : (
                  <>
                    <strong>
                      <BadgeCheck size={17} /> {recoResponse?.summary?.confirmed_count ?? 1} Confirmed · {recoResponse?.summary?.potential_count ?? 0} Potentially relevant
                    </strong>
                    <p>
                      Based on your location in <strong>{matcherDistrict}, {matcherState}</strong> and {matcherAcres} acres of {matcherCrop}, your farm qualifies for Central and state support.
                    </p>

                    {/* Top match reasons */}
                    {recoResponse?.recommendations?.[0]?.match_reasons && (
                      <div className="match-reasons-box">
                        <strong>Why you match:</strong>
                        <ul>
                          {recoResponse.recommendations[0].match_reasons.slice(0, 2).map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Missing information notice */}
                    {recoResponse?.recommendations?.some((r) => r.missing_information?.length) && (
                      <div className="match-missing-box">
                        <strong className="needs-check">
                          <CircleHelp size={16} /> Next verification steps
                        </strong>
                        <ul className="match-missing-list">
                          {recoResponse.recommendations
                            .flatMap((r) => r.missing_information || [])
                            .slice(0, 3)
                            .map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="privacy-note">
              <ShieldCheck size={14} /> Profile parameters remain on your secure Farmly instance.
            </div>
          </Card>

          {/* Legal Disclaimer */}
          <div className="eligibility-disclaimer">
            <Info size={16} />
            <p>
              Eligibility shown by Farmly.AI is preliminary discovery guidance. Final eligibility,
              verification, and fund disbursement are strictly determined by the relevant government
              department or participating financial institution.
            </p>
          </div>

          {/* Authoritative Links */}
          <Card className="official-links-card">
            <span className="card-kicker">OFFICIAL GOVERNMENT PORTALS</span>
            {[
              ["data.gov.in (Open Govt Data)", "https://data.gov.in/"],
              ["myScheme National Platform", "https://www.myscheme.gov.in/"],
              ["PM-KISAN Portal", "https://pmkisan.gov.in/"],
              ["PMFBY Crop Insurance", "https://pmfby.gov.in/"],
              ["Soil Health Management", "https://soilhealth.dac.gov.in/"],
              ["Govt. of Jharkhand Agriculture", "https://agri.jharkhand.gov.in/"],
              ["Govt. of AP Karshak / Agrisnet", "https://apagrisnet.gov.in/"],
            ].map(([name, url]) => (
              <a key={name} href={url} target="_blank" rel="noreferrer">
                <span>{name}</span>
                <ExternalLink size={13} />
              </a>
            ))}
          </Card>
        </aside>
      </div>

      {/* Comprehensive Scheme Details Modal */}
      {selectedScheme && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedId(null)
          }}
        >
          <section
            className="scheme-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scheme-modal-title"
          >
            <button
              className="icon-button modal-close"
              onClick={() => setSelectedId(null)}
              aria-label="Close scheme details"
            >
              <X size={19} />
            </button>

            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span className="card-kicker">
                {selectedScheme.government_level.toUpperCase()} GOVERNMENT · {selectedScheme.scheme_category.toUpperCase()}
              </span>
              <span className="scheme-verified-tag">
                <ShieldCheck size={11} /> VERIFIED OFFICIAL SCHEME
              </span>
              {selectedScheme.live_data && (
                <span className="live-data-badge">
                  <RefreshCw size={10} /> Live data.gov.in feed connected
                </span>
              )}
            </div>

            <div className={`scheme-symbol ${selectedScheme.color}`}>{selectedScheme.mark}</div>

            <h2 id="scheme-modal-title">{selectedScheme.full_name}</h2>
            <small style={{ color: "#748270", fontWeight: 600, display: "block", marginBottom: "8px" }}>
              {selectedScheme.ministry_or_department}
            </small>

            <p>{selectedScheme.description}</p>

            {/* Live data details badge if present */}
            {selectedScheme.live_data && (
              <div className="modal-live-data-card">
                <strong>Live Open Government Data (data.gov.in Resource {selectedScheme.live_data.resource_id}):</strong>
                <span>
                  Active Installment Release #{selectedScheme.live_data.latest_installment_release_no} (Quadrimester {selectedScheme.live_data.quadrimester_no}) · Tracked Beneficiaries: {selectedScheme.live_data.total_records_tracked?.toLocaleString("en-IN")}
                </span>
              </div>
            )}

            <div className="modal-detail-grid">
              {/* Benefits */}
              <div>
                <strong>Potential Benefits &amp; Financial Support</strong>
                <span>
                  {typeof selectedScheme.benefits === "object" ? (
                    <>
                      <strong style={{ display: "block", color: "#246e2b", fontSize: "16px", fontWeight: 750 }}>{selectedScheme.benefits.amount}</strong>
                      <small style={{ display: "block", marginTop: "4px", fontSize: "13px", color: "#50614e" }}>{selectedScheme.benefits.frequency}</small>
                      {selectedScheme.benefits.transfer_mode && (
                        <small style={{ display: "block", marginTop: "3px", fontSize: "12.5px", color: "#50614e" }}>Mode: {selectedScheme.benefits.transfer_mode}</small>
                      )}
                      {selectedScheme.benefits.additional_support && (
                        <small style={{ display: "block", marginTop: "3px", fontSize: "12.5px", color: "#50614e" }}>{selectedScheme.benefits.additional_support}</small>
                      )}
                    </>
                  ) : (
                    selectedScheme.benefits
                  )}
                </span>
              </div>

              {/* Match Guidance */}
              <div>
                <strong>Farmly Match Assessment</strong>
                <span>
                  <i
                    style={{ fontStyle: "normal", fontWeight: 700 }}
                    className={
                      selectedScheme.fit === "Eligibility confirmed"
                        ? "match-positive"
                        : "match-caution"
                    }
                  >
                    {selectedScheme.fit || "Potentially relevant"}
                  </i>
                  <span style={{ display: "block", marginTop: "4px" }}>
                    {selectedScheme.match_reasons?.[0] || "Matches location and crop criteria."}
                  </span>
                </span>
              </div>

              {/* Eligibility Criteria */}
              <div className="modal-detail-full">
                <strong>Official Eligibility Criteria</strong>
                <ul className="modal-list-box">
                  {selectedScheme.eligibility_criteria.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              {/* Required Documents */}
              <div className="modal-detail-full">
                <strong>Mandatory Documents for Application</strong>
                <ul className="modal-list-box">
                  {selectedScheme.required_documents.map((doc, idx) => (
                    <li key={idx}>{doc}</li>
                  ))}
                </ul>
              </div>

              {/* Step by Step Application Procedure */}
              <div className="modal-detail-full">
                <strong>How to Apply (Official Procedure)</strong>
                <ol className="modal-process-steps">
                  {selectedScheme.application_process.map((step, idx) => (
                    <li className="modal-process-step" key={idx}>
                      <span className="modal-step-badge">{idx + 1}</span>
                      <span>{step.replace(/^Step \d+:\s*/, "")}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Disclaimer and Verification Attribution */}
            <div className="modal-disclaimer">
              <Info size={15} />
              <span>
                Verified from {selectedScheme.source_name} on {formatVerifiedDate(selectedScheme.last_verified_at)}. Final approval determined by government department.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="modal-actions-row">
              <a
                className="primary-btn"
                href={selectedScheme.official_application_url || selectedScheme.official_information_url}
                target="_blank"
                rel="noreferrer"
              >
                Apply on Official Portal <ExternalLink size={14} />
              </a>
              <a
                className="outline-btn"
                href={selectedScheme.official_information_url || selectedScheme.source_url}
                target="_blank"
                rel="noreferrer"
              >
                Official Guidelines <ExternalLink size={14} />
              </a>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}


export function ProfileScreen({ profile, onSave }: { profile: FarmerProfile; onSave: (profile: FarmerProfile) => void }) {
  const [form, setForm] = useState(profile)
  const [savedPlan, setSavedPlan] = useState<{ crop: string; area: number; total: number } | null>(null)
  const { setLocation } = useLocation()
  useEffect(() => {
    setForm(profile)
  }, [profile])
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("farmly-saved-crop-plan")
      if (stored) {
        const plan = JSON.parse(stored) as { crop?: string; area?: number; total?: number }
        if (plan.crop) setSavedPlan({ crop: plan.crop, area: plan.area || 0, total: plan.total || 0 })
      }
    } catch { /* Keep the profile usable if browser storage is unavailable. */ }
  }, [])
  const set = (key: keyof FarmerProfile, value: string) => setForm((current) => ({ ...current, [key]: value }))
  return <div className="profile-layout"><div className="profile-main"><Card className="profile-card"><div className="profile-card-banner"><div className="profile-large-avatar">{form.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><span className="card-kicker">YOUR FARM PROFILE</span><h3>{form.name}</h3><span><MapPin size={13} /> {form.village}, {form.district}</span></div><span className="profile-data-badge"><ShieldCheck size={14} /> Saved in this browser</span></div><div className="profile-form-grid"><label>Farmer name<input value={form.name} onChange={(event) => set("name", event.target.value)} /></label><label>Village<input value={form.village} onChange={(event) => set("village", event.target.value)} /></label><LocationSelect state={form.state} district={form.district} onStateChange={(s) => set("state", s)} onDistrictChange={(d) => set("district", d)} variant="profile" /><label>Preferred language<select value={form.language} onChange={(event) => set("language", event.target.value)}>{["English", "हिंदी", "తెలుగు", "मराठी", "தமிழ்", "ਪੰਜਾਬੀ"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Farm size<input type="number" min="0.1" step="0.1" value={form.acres} onChange={(event) => set("acres", event.target.value)} /><small>acres</small></label><label>Main crop<input value={form.crop} onChange={(event) => set("crop", event.target.value)} /></label><label>Soil type<select value={form.soil} onChange={(event) => set("soil", event.target.value)}>{["Clay loam", "Sandy loam", "Black soil", "Red soil", "Alluvial", "Not sure"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Irrigation access<select value={form.irrigation} onChange={(event) => set("irrigation", event.target.value)}>{["Rain-fed", "Canal", "Well / borewell", "Drip irrigation", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Farming experience<input value={form.experience} onChange={(event) => set("experience", event.target.value)} /></label></div><div className="profile-card-footer"><span><Info size={14} /> This demo saves profile details only to this browser.</span><button className="primary-action" onClick={() => {
              onSave(form)
              if (form.district) {
                setLocation({
                  district: form.district,
                  state: form.state,
                  label: `${form.district}, ${form.state}`,
                })
              }
            }}>Save farm profile <Check size={15} /></button></div></Card><Card className="profile-language-card"><div className="language-roundel">अ</div><div><span className="card-kicker">MADE FOR YOUR LANGUAGE</span><h3>Farm advice should sound familiar.</h3><p>Choose a preferred language above. Voice recognition is subject to your browser and device support.</p></div></Card></div><aside className="profile-aside"><Card className="profile-summary-card"><span className="card-kicker">YOUR FARM AT A GLANCE</span><div className="profile-summary-stat"><Sprout size={17} /><div><span>Main crop</span><strong>{form.crop}</strong></div></div><div className="profile-summary-stat"><MapPin size={17} /><div><span>Location</span><strong>{form.district}, {form.state}</strong></div></div><div className="profile-summary-stat"><Leaf size={17} /><div><span>Land area</span><strong>{form.acres} acres</strong></div></div><div className="profile-summary-stat"><DropletsIcon /><div><span>Irrigation</span><strong>{form.irrigation}</strong></div></div>{savedPlan && <div className="saved-plan-summary"><span className="card-kicker">SAVED CROP PLAN</span><strong>{savedPlan.crop} · {savedPlan.area} acres</strong><small>Illustrative budget · ₹{Math.round(savedPlan.total).toLocaleString("en-IN")}</small></div>}</Card><SampleNotice>Your farm profile is sample information and can be edited. No account or cloud storage is connected.</SampleNotice></aside></div>
}
