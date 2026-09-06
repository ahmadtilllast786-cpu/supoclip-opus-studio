import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import {
  CaptionTemplate,
  CaptionTemplateId,
  TranscriptWord,
} from '../../types/timeline';
import {
  SUPOCLIP_CAPTION_TEMPLATES,
  getCaptionTemplate,
} from '../../core/captions/supoClipTemplates';
import {
  SUPPORTED_LANGUAGES,
  detectAudioLanguage,
  transcribeLiveSpeech,
  translateTranscriptWords,
  exportToSrt,
  exportToAss,
  parseSrt,
} from '../../core/ai/captionTranscriber';

interface CaptionCustomizerPanelProps {
  template: CaptionTemplate;
  setTemplate: React.Dispatch<React.SetStateAction<CaptionTemplate>>;
  hookTitle: string | null;
  setHookTitle: (title: string | null) => void;
  showCaptions: boolean;
  setShowCaptions: (show: boolean) => void;
  words: TranscriptWord[];
  setWords: React.Dispatch<React.SetStateAction<TranscriptWord[]>>;
  currentTime: number;
  onSeek: (time: number) => void;
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
  currentTime,
  onSeek,
}) => {
  const [activeTab, setActiveTab] = useState<'styles' | 'words' | 'language'>('styles');
  const [searchQuery, setSearchQuery] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [selectedTargetLang, setSelectedTargetLang] = useState('es');
  const srtInputRef = useRef<HTMLInputElement>(null);

  const templateList = Object.values(SUPOCLIP_CAPTION_TEMPLATES);

  // Auto-detect current language based on words
  const fullTranscript = words.map((w) => w.word).join(' ');
  const detectedLang = detectAudioLanguage(fullTranscript);

  const handleSelectTemplate = (id: CaptionTemplateId) => {
    const base = getCaptionTemplate(id);
    setTemplate(base);
  };

  // 1-Click Live Speech Transcription
  const handleLiveTranscribe = async () => {
    setIsTranscribing(true);
    try {
      const result = await transcribeLiveSpeech(detectedLang.code);
      if (result.words.length > 0) {
        setWords(result.words);
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
    setWords(translated);
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
          setWords(parsed);
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
      isEmphasis: true,
      emoji: '🔥',
    };
    const updated = [...words, newWord].sort((a, b) => a.start - b.start);
    setWords(updated);
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

            {/* Position Y Slider */}
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Vertical Position</span>
                <span className="font-mono text-indigo-400 font-bold">
                  {Math.round(template.position_y * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.55"
                max="0.88"
                step="0.02"
                value={template.position_y}
                onChange={(e) =>
                  setTemplate((prev) => ({ ...prev, position_y: Number(e.target.value) }))
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Interactive Word & Subtitle Editor */}
      {activeTab === 'words' && (
        <div className="space-y-3">
          {/* Action Bar: Search & Add Word */}
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
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition"
              title="Add Subtitle Word at Playhead"
            >
              <Plus className="w-3.5 h-3.5" />
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
                        setWords((prev) =>
                          prev.map((w, i) => (i === idx ? { ...w, word: val } : w))
                        );
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs font-bold text-slate-100 flex-1 focus:border-indigo-500"
                    />
                  </div>

                  {/* Controls: Emoji, Emphasis, Delete */}
                  <div className="flex items-center space-x-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setWords((prev) =>
                          prev.map((w, i) =>
                            i === idx ? { ...w, isEmphasis: !w.isEmphasis } : w
                          )
                        );
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
                        setWords((prev) => prev.filter((_, i) => i !== idx));
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

            <input
              ref={srtInputRef}
              type="file"
              accept=".srt"
              onChange={handleImportSrt}
              className="hidden"
            />
            <button
              onClick={() => srtInputRef.current?.click()}
              className="col-span-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-xs py-1.5 px-2 rounded-lg flex items-center justify-center space-x-1.5 transition"
            >
              <Upload className="w-3 h-3" />
              <span>Import External .SRT Subtitles</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Auto-Language Detection & AI Transcription */}
      {activeTab === 'language' && (
        <div className="space-y-3">
          {/* Language Detection Banner */}
          <div className="bg-slate-900/80 border border-indigo-500/40 p-3 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center">
                <Languages className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                Detected Language
              </span>
              <span className="text-[10px] font-mono bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-800">
                {detectedLang.confidence}% Confidence
              </span>
            </div>

            <div className="flex items-center space-x-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
              <span className="text-xl">{detectedLang.flag}</span>
              <div>
                <div className="text-xs font-bold text-white">{detectedLang.name}</div>
                <div className="text-[9px] text-slate-400">Automatic speech recognition audio matching</div>
              </div>
            </div>
          </div>

          {/* 1-Click Live Web Speech ASR */}
          <button
            onClick={handleLiveTranscribe}
            disabled={isTranscribing}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/20 transition active:scale-95"
          >
            <Mic className={`w-4 h-4 ${isTranscribing ? 'animate-pulse text-rose-400' : ''}`} />
            <span>{isTranscribing ? 'Listening & Transcribing...' : 'Live In-Browser Speech-to-Text'}</span>
          </button>

          {/* Multilingual Translation */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 space-y-2 text-xs">
            <div className="font-bold text-slate-300 flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>1-Click Subtitle Translation</span>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              Instantly translate all caption words and karaoke timings to reach global audiences on TikTok & Shorts.
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
