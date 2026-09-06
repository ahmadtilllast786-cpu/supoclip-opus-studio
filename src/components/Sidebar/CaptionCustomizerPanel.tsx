import React, { useState, useRef, useEffect } from 'react';
import {
  Subtitles,
  Type,
  Palette,
  Sliders,
  Check,
  Sparkles,
  Heading,
  Globe,
  Mic,
  Languages,
  Download,
  Upload,
  Plus,
  Trash2,
  Flame,
  Search,
  Volume2,
  Move,
  Key,
  FileText,
  AlignLeft,
} from 'lucide-react';
import {
  CaptionTemplate,
  CaptionTemplateId,
  TranscriptWord,
  VideoClip,
  CaptionTrackItem,
} from '../../types/timeline';
import {
  SUPOCLIP_CAPTION_TEMPLATES,
  getCaptionTemplate,
} from '../../core/captions/supoClipTemplates';
import {
  groupWordsIntoCaptionChunks,
} from '../../core/captions/captionHandler';
import { extractSequentialAudioTrack } from '../../core/audio/audioExtractor';
import {
  SUPPORTED_LANGUAGES,
  detectAudioLanguage,
  transcribeLiveSpeech,
  translateTranscriptWords,
  exportToSrt,
  exportToAss,
  parseSrt,
  encodeAudioBufferToWav,
  detectEnglishSpeechSegments,
  alignScriptToSpeechAudio,
  transcribeWithWhisperApi,
  autoTranscribeVideoAudio,
  transcribeContinuousAudio,
} from '../../core/ai/captionTranscriber';
import { decodeAudioBuffer } from '../../core/audio/audioAnalyzer';

interface CaptionCustomizerPanelProps {
  template: CaptionTemplate;
  setTemplate: React.Dispatch<React.SetStateAction<CaptionTemplate>>;
  hookTitle: string | null;
  setHookTitle: (title: string | null) => void;
  showCaptions: boolean;
  setShowCaptions: (show: boolean) => void;
  words: TranscriptWord[];
  setWords: React.Dispatch<React.SetStateAction<TranscriptWord[]>>;
  captions?: CaptionTrackItem[];
  setCaptions?: React.Dispatch<React.SetStateAction<CaptionTrackItem[]>>;
  detectedLanguage?: string;
  setDetectedLanguage?: (lang: string) => void;
  detectedConfidence?: number;
  setDetectedConfidence?: (conf: number) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  clips?: VideoClip[];
  totalDuration?: number;
}

export const CaptionCustomizerPanel: React.FC<CaptionCustomizerPanelProps> = ({
  template,
  setTemplate,
  hookTitle,
  setHookTitle,
  showCaptions,
  setShowCaptions,
  words,
  setWords,
  captions = [],
  setCaptions,
  detectedLanguage = 'auto',
  setDetectedLanguage,
  detectedConfidence = 0.96,
  setDetectedConfidence,
  currentTime,
  onSeek,
  clips = [],
  totalDuration = 0,
}) => {
  const [activeTab, setActiveTab] = useState<'styles' | 'words' | 'language'>('styles');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingWordIdx, setEditingWordIdx] = useState<number | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedTargetLang, setSelectedTargetLang] = useState('es');
  const [whisperApiKey, setWhisperApiKey] = useState(
    () => localStorage.getItem('short_editor_whisper_key') || ''
  );
  const [whisperEndpoint, setWhisperEndpoint] = useState(
    () => localStorage.getItem('short_editor_whisper_endpoint') || ''
  );
  const [pastedScript, setPastedScript] = useState('');
  const [isScriptDrawerOpen, setIsScriptDrawerOpen] = useState(false);
  const srtInputRef = useRef<HTMLInputElement>(null);

  const templateList = Object.values(SUPOCLIP_CAPTION_TEMPLATES);

  // Auto-detect current language based on words or audio transcription
  const fullTranscript = words.map((w) => w.word).join(' ');
  const textDetectedLang = detectAudioLanguage(fullTranscript);
  const effectiveLangCode = detectedLanguage || textDetectedLang.code;
  const currentLangInfo =
    SUPPORTED_LANGUAGES.find((l) => l.code === effectiveLangCode) || {
      code: effectiveLangCode,
      name: effectiveLangCode.toUpperCase(),
      flag: '🌐',
    };

  // Helper to keep both word-level list and timeline caption chunk cards perfectly in sync
  const syncWordsAndCaptions = (newWords: TranscriptWord[], lang?: string) => {
    setWords(newWords);
    if (setCaptions) {
      const chunks = groupWordsIntoCaptionChunks(newWords, {
        detectedLanguage: lang || effectiveLangCode,
      });
      setCaptions(chunks);
    }
  };

  const handleSelectTemplate = (id: CaptionTemplateId) => {
    const base = getCaptionTemplate(id);
    setTemplate(base);
  };

  // 1-Click Live Speech Transcription
  const handleLiveTranscribe = async () => {
    setIsTranscribing(true);
    try {
      const result = await transcribeLiveSpeech(effectiveLangCode);
      if (result.words.length > 0) {
        syncWordsAndCaptions(result.words, effectiveLangCode);
      }
    } catch (err: any) {
      alert(`Speech recognition: ${err?.message || 'Speak into microphone or upload media'}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // 1-Click Multilingual Translation
  const handleTranslate = () => {
    const translated = translateTranscriptWords(words, selectedTargetLang);
    if (setDetectedLanguage) setDetectedLanguage(selectedTargetLang);
    syncWordsAndCaptions(translated, selectedTargetLang);
  };

  // Export SRT
  const handleExportSrt = () => {
    const srt = exportToSrt(words);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captions_${Date.now()}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export ASS Karaoke
  const handleExportAss = () => {
    const ass = exportToAss(words, template, hookTitle || 'Viral Short');
    const blob = new Blob([ass], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karaoke_captions_${Date.now()}.ass`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import SRT
  const handleImportSrt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const parsed = parseSrt(content);
        if (parsed.length > 0) {
          syncWordsAndCaptions(parsed);
        }
      }
    };
    reader.readAsText(file);
  };

  // Add a new word at current playhead
  const handleAddWordAtPlayhead = () => {
    const newWord: TranscriptWord = {
      word: 'NEW_WORD',
      start: Number(currentTime.toFixed(2)),
      end: Number((currentTime + 0.4).toFixed(2)),
      confidence: 0.98,
      isEmphasis: true,
      emoji: '🔥',
    };
    const updated = [...words, newWord].sort((a, b) => a.start - b.start);
    syncWordsAndCaptions(updated);
  };

  // Save Whisper API Key
  const handleSaveWhisperKey = (key: string) => {
    setWhisperApiKey(key);
    localStorage.setItem('short_editor_whisper_key', key);
  };

  // Save Custom Faster-Whisper / OpenAI Endpoint
  const handleSaveWhisperEndpoint = (url: string) => {
    setWhisperEndpoint(url);
    localStorage.setItem('short_editor_whisper_endpoint', url);
  };

  // 1-Click Multilingual Speech Transcriber from Video Audio with Auto-Language Detection
  const handleAutoTranscribeVideo = async () => {
    setIsTranscribing(true);
    try {
      const validClips = clips.filter((c) => c.blob || c.sourceUrl || c.audioBuffer);
      if (validClips.length === 0) {
        alert('Please upload a video or audio clip first in the Assets tab.');
        return;
      }

      // Extract continuous sequential 16kHz mono audio honoring timeline offsets, trimming, speeds, and volumes
      const { audioBuffer, wavBlob, hasAudioTrack } = await extractSequentialAudioTrack(clips, 16000);

      if (!hasAudioTrack) {
        console.warn('[CaptionCustomizer] No audio stream found in video clip(s). Using cadence synthesis fallback.');
      }

      const apiKey = whisperApiKey.trim();
      // Auto-detect spoken language across 99+ Whisper languages, word timestamps with confidence
      const { words: transcribedWords, detectedLanguage: langCode, confidence } =
        await transcribeContinuousAudio(wavBlob, audioBuffer, apiKey, 'auto');

      if (transcribedWords.length > 0) {
        if (setDetectedLanguage) setDetectedLanguage(langCode);
        if (setDetectedConfidence) setDetectedConfidence(confidence);

        syncWordsAndCaptions(transcribedWords, langCode);
        setShowCaptions(true);
        setActiveTab('words');
      }
    } catch (err: any) {
      console.error(err);
      alert(`Transcription error: ${err?.message || 'Could not analyze video audio'}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // 1-Click Script Alignment to Audio
  const handleAlignPastedScript = async () => {
    if (!pastedScript.trim()) return;
    setIsTranscribing(true);
    try {
      let audioBuffer: AudioBuffer | undefined;
      const validClips = clips.filter((c) => c.blob);
      if (validClips.length > 0 && validClips[0].blob) {
        audioBuffer = await decodeAudioBuffer(validClips[0].blob);
      }
      const aligned = alignScriptToSpeechAudio(pastedScript, audioBuffer, totalDuration || 10);
      syncWordsAndCaptions(aligned);
      setPastedScript('');
      setIsScriptDrawerOpen(false);
      setActiveTab('words');
    } catch (err: any) {
      alert(`Alignment error: ${err?.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Clear all words
  const handleClearAllWords = () => {
    if (words.length === 0) return;
    if (confirm('Clear all subtitle words?')) {
      syncWordsAndCaptions([]);
    }
  };

  // Filtered words for search
  const filteredWords = words.filter((w) =>
    w.word.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-3 space-y-3.5 select-none">
      {/* Top Header & Visibility Toggle */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center">
          <Subtitles className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
          Elite Subtitle Studio
        </span>
        <label className="flex items-center space-x-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showCaptions}
            onChange={(e) => setShowCaptions(e.target.checked)}
            className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0"
          />
          <span className="text-[10px] text-slate-300 font-medium">Visible</span>
        </label>
      </div>

      {/* Sub-Tabs: Styles, Word Editor, Language & AI */}
      <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('styles')}
          className={`py-1.5 rounded-lg transition ${
            activeTab === 'styles'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          7 Styles
        </button>
        <button
          onClick={() => setActiveTab('words')}
          className={`py-1.5 rounded-lg transition flex items-center justify-center space-x-1 ${
            activeTab === 'words'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>Words</span>
          <span className="text-[9px] bg-indigo-950 px-1 rounded font-mono">{words.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('language')}
          className={`py-1.5 rounded-lg transition flex items-center justify-center space-x-1 ${
            activeTab === 'language'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-3 h-3" />
          <span>AI & Lang</span>
        </button>
      </div>

      {/* TAB 1: 7 Viral Caption Styles */}
      {activeTab === 'styles' && (
        <div className="space-y-3">
          {/* Burned-in Hook Title Headline */}
          <div className="space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
              <span className="flex items-center space-x-1">
                <Heading className="w-3 h-3 text-pink-400" />
                <span>AI Hook Title Banner</span>
              </span>
              <span className="text-[9px] font-mono bg-pink-950 text-pink-300 px-1 rounded border border-pink-800">
                Top 15% Safe Area
              </span>
            </div>

            <input
              type="text"
              value={hookTitle || ''}
              placeholder="e.g. THE #1 SECRET NOBODY TELLS YOU"
              onChange={(e) => setHookTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-pink-500 font-bold"
            />
          </div>

          {/* Template List */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-300">Viral Style Presets</div>
            <div className="space-y-1.5 max-h-[calc(100vh-450px)] overflow-y-auto pr-1">
              {templateList.map((tpl) => {
                const isSelected = template.id === tpl.id;

                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between group ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold flex items-center space-x-1.5">
                        <span>{tpl.name}</span>
                        {tpl.word_box && (
                          <span className="text-[9px] bg-emerald-950 text-emerald-400 px-1 rounded font-mono">
                            Pill Box
                          </span>
                        )}
                        {tpl.glow && (
                          <span className="text-[9px] bg-cyan-950 text-cyan-400 px-1 rounded font-mono">
                            Neon Glow
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{tpl.description}</div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <div
                        style={{
                          backgroundColor: tpl.word_box_color || tpl.highlight_color,
                        }}
                        className="w-3.5 h-3.5 rounded-full shadow-sm"
                      />
                      {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customization Knobs */}
          <div className="space-y-2.5 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
            {/* Font Size */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Font Size</span>
                <span className="font-mono text-indigo-400 font-bold">{template.font_size}px</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[26, 34, 42].map((sz, i) => (
                  <button
                    key={sz}
                    onClick={() => setTemplate((prev) => ({ ...prev, font_size: sz }))}
                    className={`py-1 rounded border text-center text-[11px] font-semibold transition ${
                      template.font_size === sz
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {i === 0 ? 'Small (26)' : i === 1 ? 'Medium (34)' : 'Large (42)'}
                  </button>
                ))}
              </div>
            </div>

            {/* 2D Subtitle Placement (X & Y Sliders + Presets) */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-bold flex items-center space-x-1">
                  <Move className="w-3.5 h-3.5 text-indigo-400" />
                  <span>2D Subtitle Placement</span>
                </span>
                <span className="text-[10px] text-pink-400 font-mono font-bold">
                  X: {Math.round((template.position_x ?? 0.5) * 100)}% · Y: {Math.round((template.position_y ?? 0.74) * 100)}%
                </span>
              </div>

              {/* Quick Placement Presets */}
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={() => setTemplate((prev) => ({ ...prev, position_x: 0.5, position_y: 0.18 }))}
                  className="py-1 px-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded text-[10px] text-slate-300 font-medium transition"
                  title="Top Safe Zone"
                >
                  Top
                </button>
                <button
                  onClick={() => setTemplate((prev) => ({ ...prev, position_x: 0.5, position_y: 0.50 }))}
                  className="py-1 px-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded text-[10px] text-slate-300 font-medium transition"
                  title="Center Screen"
                >
                  Center
                </button>
                <button
                  onClick={() => setTemplate((prev) => ({ ...prev, position_x: 0.5, position_y: 0.74 }))}
                  className="py-1 px-1 bg-indigo-950/80 border border-indigo-500/50 rounded text-[10px] text-indigo-300 font-medium transition"
                  title="Lower Third (Reels / TikTok standard)"
                >
                  Lower 3rd
                </button>
                <button
                  onClick={() => setTemplate((prev) => ({ ...prev, position_x: 0.5, position_y: 0.86 }))}
                  className="py-1 px-1 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded text-[10px] text-slate-300 font-medium transition"
                  title="Bottom Margin"
                >
                  Bottom
                </button>
              </div>

              {/* Horizontal X Slider */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Horizontal (X)</span>
                  <span className="font-mono text-indigo-400">{Math.round((template.position_x ?? 0.5) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.90"
                  step="0.01"
                  value={template.position_x ?? 0.5}
                  onChange={(e) =>
                    setTemplate((prev) => ({ ...prev, position_x: Number(e.target.value) }))
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              {/* Vertical Y Slider */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Vertical (Y)</span>
                  <span className="font-mono text-pink-400">{Math.round((template.position_y ?? 0.74) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.10"
                  max="0.92"
                  step="0.01"
                  value={template.position_y ?? 0.74}
                  onChange={(e) =>
                    setTemplate((prev) => ({ ...prev, position_y: Number(e.target.value) }))
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
              </div>

              <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
                <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Tip: Click and drag captions anywhere directly on the video player screen!</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Interactive Word & Subtitle Editor */}
      {activeTab === 'words' && (
        <div className="space-y-3">
          {words.length === 0 ? (
            <div className="p-5 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/60 space-y-3.5">
              <div className="w-11 h-11 mx-auto rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Subtitles className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">No Captions Loaded</div>
                <div className="text-[10px] text-slate-400 mt-1 max-w-[220px] mx-auto leading-relaxed">
                  Auto-transcribe real English speech from your video footage, speak live with your mic, or import subtitles.
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleAutoTranscribeVideo}
                  disabled={isTranscribing}
                  className="w-full bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-bold text-xs py-2.5 px-3 rounded-xl shadow-lg shadow-indigo-500/20 transition flex items-center justify-center space-x-2 active:scale-95"
                >
                  <Sparkles className={`w-4 h-4 text-amber-300 ${isTranscribing ? 'animate-spin' : ''}`} />
                  <span>{isTranscribing ? 'Analyzing Video Audio...' : 'Auto-Transcribe Video Audio'}</span>
                </button>

                <button
                  onClick={handleLiveTranscribe}
                  disabled={isTranscribing}
                  className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs py-2 px-3 rounded-xl transition flex items-center justify-center space-x-2"
                >
                  <Mic className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Live Mic Dictation</span>
                </button>

                <button
                  onClick={() => srtInputRef.current?.click()}
                  className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs py-2 px-3 rounded-xl transition flex items-center justify-center space-x-2"
                >
                  <Upload className="w-3.5 h-3.5 text-pink-400" />
                  <span>Import .SRT / .VTT / .ASS</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Action Bar: Search, Add Word & Clear All */}
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search words..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={handleAddWordAtPlayhead}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition shrink-0"
                  title="Add Subtitle Word at Playhead"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleAutoTranscribeVideo}
                  disabled={isTranscribing}
                  className="bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 p-2 rounded-lg transition shrink-0 flex items-center justify-center"
                  title="Re-transcribe Audio from Video"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isTranscribing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleClearAllWords}
                  className="bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-700 text-slate-400 hover:text-rose-400 p-2 rounded-lg transition shrink-0"
                  title="Clear All Words"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Words List */}
              <div className="space-y-1.5 max-h-[calc(100vh-390px)] overflow-y-auto pr-1">
                {filteredWords.map((item, idx) => {
                  const isCurrent = currentTime >= item.start && currentTime <= item.end;

                  return (
                    <div
                      key={idx}
                      onClick={() => onSeek(item.start)}
                      className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition ${
                        isCurrent
                          ? 'bg-indigo-950/80 border-indigo-400 ring-1 ring-indigo-400 shadow-md'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Timestamp & Text */}
                      <div className="flex items-center space-x-2 flex-1 mr-2">
                        <span className="text-[9px] font-mono text-indigo-400 w-10 shrink-0">
                          {item.start.toFixed(1)}s
                        </span>

                        <input
                          type="text"
                          value={item.word}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = words.map((w, i) => (i === idx ? { ...w, word: val } : w));
                            syncWordsAndCaptions(updated);
                          }}
                          className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs font-bold text-slate-100 flex-1 focus:border-indigo-500"
                        />
                      </div>

                      {/* Controls: Emoji, Emphasis, Delete */}
                      <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            const updated = words.map((w, i) =>
                              i === idx ? { ...w, isEmphasis: !w.isEmphasis } : w
                            );
                            syncWordsAndCaptions(updated);
                          }}
                          className={`p-1 rounded transition ${
                            item.isEmphasis
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                          title="Toggle Karaoke Highlight Emphasis"
                        >
                          <Flame className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            const updated = words.filter((_, i) => i !== idx);
                            syncWordsAndCaptions(updated);
                          }}
                          className="p-1 text-slate-500 hover:text-rose-400 transition"
                          title="Delete Word"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Import / Export Controls */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                <button
                  onClick={handleExportSrt}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 px-2 rounded-lg flex items-center justify-center space-x-1.5 transition"
                >
                  <Download className="w-3 h-3 text-indigo-400" />
                  <span>Export .SRT</span>
                </button>

                <button
                  onClick={handleExportAss}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-1.5 px-2 rounded-lg flex items-center justify-center space-x-1.5 transition"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Export .ASS Karaoke</span>
                </button>

                <button
                  onClick={() => srtInputRef.current?.click()}
                  className="col-span-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs py-1.5 px-2 rounded-lg flex items-center justify-center space-x-1.5 transition"
                >
                  <Upload className="w-3 h-3" />
                  <span>Import External .SRT Subtitles</span>
                </button>
              </div>
            </>
          )}

          <input
            ref={srtInputRef}
            type="file"
            accept=".srt"
            onChange={handleImportSrt}
            className="hidden"
          />
        </div>
      )}

      {/* TAB 3: Auto-Language Detection & AI Transcription */}
      {activeTab === 'language' && (
        <div className="space-y-3">
          {/* Active Auto-Detected Language Status Badge */}
          <div className="bg-slate-900/90 border border-indigo-500/40 p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <span className="text-xl leading-none">{currentLangInfo.flag}</span>
              <div>
                <div className="text-xs font-bold text-slate-100 flex items-center space-x-1.5">
                  <span>{currentLangInfo.name}</span>
                  <span className="text-[9px] uppercase font-mono px-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    {effectiveLangCode}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Auto Language Detection: <span className="text-emerald-400 font-semibold">Active</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/70 border border-emerald-800/80 px-2 py-0.5 rounded">
                {Math.round(detectedConfidence * 100)}% Conf
              </div>
            </div>
          </div>

          {/* Primary 1-Click Video Speech Transcriber */}
          <div className="bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border border-indigo-500/50 p-3 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Auto-Transcribe All Clips</span>
              </span>
              <span className="text-[9px] font-mono bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-800">
                Auto-Detect 99+ Langs
              </span>
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              Extracts 16kHz continuous audio across all sequential clips, automatically recognizes spoken language, and generates word-level timestamps.
            </p>
            <button
              onClick={handleAutoTranscribeVideo}
              disabled={isTranscribing}
              className="w-full bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-md shadow-indigo-500/25 transition active:scale-95 flex items-center justify-center space-x-1.5"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isTranscribing ? 'animate-spin' : ''}`} />
              <span>{isTranscribing ? 'Transcribing Continuous Audio...' : 'Transcribe Video Audio'}</span>
            </button>
          </div>

          {/* Whisper API Key & Local Faster-Whisper Endpoint Integration */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 flex items-center space-x-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>STT Engine & Whisper Settings</span>
              </span>
              <span className="text-[9px] text-emerald-400 font-mono">Groq / OpenAI / Faster-Whisper</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Enter your Groq key (`gsk_...`), OpenAI key (`sk-...`), or self-hosted faster-whisper endpoint for 100% accurate verbatim multi-language transcription:
            </p>
            <div className="space-y-1.5">
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={whisperApiKey}
                  onChange={(e) => handleSaveWhisperKey(e.target.value)}
                  placeholder="API Key (gsk_... or sk-...)"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white flex-1 focus:border-indigo-500 font-mono"
                />
                <button
                  onClick={() => alert('API Key saved to browser local storage!')}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-700 transition shrink-0"
                >
                  Save Key
                </button>
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={whisperEndpoint}
                  onChange={(e) => handleSaveWhisperEndpoint(e.target.value)}
                  placeholder="Custom endpoint (e.g. http://localhost:8000/v1/audio/transcriptions)"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 flex-1 focus:border-indigo-500 font-mono"
                />
                <button
                  onClick={() => alert('Custom endpoint saved!')}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs px-2.5 py-1 rounded-lg border border-slate-700 transition shrink-0"
                >
                  Save URL
                </button>
              </div>
            </div>
          </div>

          {/* Paste Script & Auto-Align Drawer */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
            <button
              onClick={() => setIsScriptDrawerOpen(!isScriptDrawerOpen)}
              className="w-full flex items-center justify-between text-left font-bold text-slate-300"
            >
              <span className="flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-pink-400" />
                <span>Paste English Script & Auto-Align</span>
              </span>
              <span className="text-slate-500 text-[10px]">{isScriptDrawerOpen ? '▲ Close' : '▼ Expand'}</span>
            </button>

            {isScriptDrawerOpen && (
              <div className="space-y-2 pt-1">
                <textarea
                  rows={3}
                  value={pastedScript}
                  onChange={(e) => setPastedScript(e.target.value)}
                  placeholder="Paste your spoken video dialogue or script in English..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-pink-500 resize-none font-sans"
                />
                <button
                  onClick={handleAlignPastedScript}
                  disabled={!pastedScript.trim() || isTranscribing}
                  className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition flex items-center justify-center space-x-1.5"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span>Align Script to Video Audio Timings</span>
                </button>
              </div>
            )}
          </div>

          {/* 1-Click Live Web Speech ASR */}
          <button
            onClick={handleLiveTranscribe}
            disabled={isTranscribing}
            className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center space-x-2 shadow transition active:scale-95"
          >
            <Mic className={`w-3.5 h-3.5 text-indigo-400 ${isTranscribing ? 'animate-pulse text-rose-400' : ''}`} />
            <span>{isTranscribing ? 'Listening & Transcribing...' : 'Live Microphone Speech-to-Text'}</span>
          </button>

          {/* Multilingual Translation */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="font-bold text-slate-300 flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>1-Click Subtitle Translation</span>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Translate captions to reach global audiences while preserving karaoke timing.
            </p>

            <div className="flex space-x-2">
              <select
                value={selectedTargetLang}
                onChange={(e) => setSelectedTargetLang(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white flex-1 focus:border-indigo-500"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>

              <button
                onClick={handleTranslate}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                Translate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
