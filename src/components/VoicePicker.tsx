import { Check, Headphones, LoaderCircle, Pause, Play, RefreshCw, Volume2 } from 'lucide-react';
import { voiceAccent } from '../lib/speech';
import type { ReaderVoice } from '../types';

interface Props {
  voices: ReaderVoice[];
  selectedId: string;
  previewing: string;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onSelect: (voice: ReaderVoice) => void;
  onPreview: (voice: ReaderVoice) => void;
}

export default function VoicePicker({
  voices,
  selectedId,
  previewing,
  loading,
  error,
  onRefresh,
  onSelect,
  onPreview,
}: Props) {
  return (
    <>
      <span className="modal-symbol">
        <Headphones size={28} />
      </span>
      <div className="eyebrow">FIND YOUR STORYTELLER</div>
      <h2>换一个讲故事的声音</h2>
      <p>先试听同一小段英文，再选你喜欢的音色。</p>
      <div className="voice-list-heading">
        <span>{loading ? '正在读取设备音色…' : `${voices.length} 个本机英文音色`}</span>
        <button className="text-button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          刷新音色
        </button>
      </div>
      <div className="voice-list" aria-label="英文音色列表">
        {loading && !voices.length ? (
          <div className="voice-empty">
            <LoaderCircle className="spin" size={22} />
            正在读取英文声音
          </div>
        ) : (
          voices.map((voice, index) => (
            <div
              className={`voice-row ${selectedId === voice.id ? 'selected' : ''}`}
              key={voice.id}
            >
              <button
                className="voice-select"
                aria-label={`选择音色 ${voice.name} ${voiceAccent(voice.lang)} ${index + 1}`}
                aria-pressed={selectedId === voice.id}
                onClick={() => onSelect(voice)}
              >
                <span className="voice-radio">
                  {selectedId === voice.id && <Check size={12} />}
                </span>
                <span>
                  <strong>
                    {voice.name}
                    {index === 0 && <small>推荐</small>}
                  </strong>
                  <span>
                    {voiceAccent(voice.lang)} · 本机离线
                    {voices.filter((item) => item.name === voice.name).length > 1
                      ? ` · 音色 ${index + 1}`
                      : ''}
                  </span>
                </span>
              </button>
              <button
                className="voice-preview"
                aria-label={`${previewing === voice.id ? '停止试听' : '试听'} ${voice.name} ${index + 1}`}
                onClick={() => onPreview(voice)}
              >
                {previewing === voice.id ? <Pause size={14} /> : <Play size={14} />}
                <span>{previewing === voice.id ? '停止' : '试听'}</span>
              </button>
            </div>
          ))
        )}
        {!loading && !voices.length && (
          <div className="voice-empty">
            <Volume2 size={25} />
            <span>
              {error || '当前没有合适的离线英文音色。请先在系统语音设置中下载，再刷新列表。'}
            </span>
          </div>
        )}
      </div>
      {error && voices.length > 0 && (
        <p className="voice-error" role="status">
          {error}
        </p>
      )}
      <p className="small-print">
        已过滤已知的搞怪特效音色。声音由设备合成，无 API
        费用；下载系统增强版音色可能改善音质，实际效果以试听为准。
      </p>
    </>
  );
}
