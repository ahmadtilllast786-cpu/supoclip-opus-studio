import React from 'react';
import {
  Subtitles,
  Type,
  Palette,
  Sliders,
  Check,
  Sparkles,
  Heading,
  Eye,
} from 'lucide-react';
import {
  CaptionTemplate,
  CaptionTemplateId,
} from '../../types/timeline';
import {
  SUPOCLIP_CAPTION_TEMPLATES,
  getCaptionTemplate,
} from '../../core/captions/supoClipTemplates';

interface CaptionCustomizerPanelProps {
  template: CaptionTemplate;
  setTemplate: React.Dispatch<React.SetStateAction<CaptionTemplate>>;
  hookTitle: string | null;
  setHookTitle: (title: string | null) => void;
  showCaptions: boolean;
  setShowCaptions: (show: boolean) => void;
}

export const CaptionCustomizerPanel: React.FC<CaptionCustomizerPanelProps> = ({
  template,
  setTemplate,
  hookTitle,
  setHookTitle,
  showCaptions,
  setShowCaptions,
}) => {
  const templateList = Object.values(SUPOCLIP_CAPTION_TEMPLATES);

  const handleSelectTemplate = (id: CaptionTemplateId) => {
    const base = getCaptionTemplate(id);
    setTemplate(base);
  };

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center">
          <Subtitles className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
          SupoClip Caption Templates
        </span>
        <label className="flex items-center space-x-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showCaptions}
            onChange={(e) => setShowCaptions(e.target.checked)}
            className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0"
          />
          <span className="text-[10px] text-slate-300">Visible</span>
        </label>
      </div>

      <p className="text-[10px] text-slate-400 leading-relaxed">
        Word-synced animated subtitles rendered with active karaoke pop, background pills, and viral headlines.
      </p>

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
        <div className="text-[9px] text-slate-500">
          Displayed dynamically during the opening 4.5s hook of each short.
        </div>
      </div>

      {/* Template Grid */}
      <div>
        <div className="text-[11px] font-bold text-slate-300 mb-2">Style Presets (7 Templates)</div>
        <div className="grid grid-cols-1 gap-2 max-h-[calc(100vh-420px)] overflow-y-auto pr-1">
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
                  {/* Mini Preview Dot/Pill */}
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
      <div className="space-y-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
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
            min="0.60"
            max="0.88"
            step="0.02"
            value={template.position_y}
            onChange={(e) =>
              setTemplate((prev) => ({ ...prev, position_y: Number(e.target.value) }))
            }
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 text-[11px]">
            <input
              type="checkbox"
              checked={template.uppercase}
              onChange={(e) =>
                setTemplate((prev) => ({ ...prev, uppercase: e.target.checked }))
              }
              className="rounded bg-slate-950 border-slate-700 text-indigo-500"
            />
            <span>Uppercase</span>
          </label>

          <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300 text-[11px]">
            <input
              type="checkbox"
              checked={template.emoji}
              onChange={(e) =>
                setTemplate((prev) => ({ ...prev, emoji: e.target.checked }))
              }
              className="rounded bg-slate-950 border-slate-700 text-indigo-500"
            />
            <span>Auto Emojis</span>
          </label>
        </div>
      </div>
    </div>
  );
};
