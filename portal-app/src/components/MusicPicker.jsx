import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import Icon from './Icon.jsx';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB — matches the API's audio limit

function fmt(s) {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Uploads the background-music track and lets the couple trim it — pick an
 * in-point and an out-point on the uploaded file — instead of typing a raw
 * URL and a start-second by hand. Nothing is re-encoded: `startAt`/`endAt`
 * are just playback markers the invitation site loops between (see
 * web-ui's Music.astro), so "crop" here means "trim points", not a new file.
 *
 * `value` is the music object ({ track, startAt, endAt, volume }); `onChange`
 * receives the next one whole, the same shape ContentEditor already stores.
 */
export default function MusicPicker({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const fileInput = useRef(null);

  const { track = '', startAt = 0, endAt = 0, volume = 0.5 } = value || {};
  const effectiveEnd = endAt > startAt ? endAt : duration;

  useEffect(() => {
    setDuration(0);
    setPlaying(false);
  }, [track]);

  const set = (patch) => onChange({ track, startAt, endAt, volume, ...patch });

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError(new Error(`"${file.name}" is too large — audio must be ${MAX_FILE_SIZE / (1024 * 1024)}MB or smaller.`));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', 'music');
      fd.append('alt', file.name.replace(/\.[^.]+$/, ''));
      const uploaded = await api.images.upload(fd);
      onChange({ track: uploaded.url, startAt: 0, endAt: 0, volume });
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
    }
  }

  function onLoadedMetadata() {
    const d = audioRef.current?.duration || 0;
    setDuration(d);
  }

  function playTrimmed() {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = startAt;
    a.play();
    setPlaying(true);
  }

  function stopPreview() {
    const a = audioRef.current;
    if (a) a.pause();
    setPlaying(false);
  }

  // While previewing, loop back to the in-point once the out-point is hit —
  // the same trim behaviour the live invitation site uses.
  function onTimeUpdate() {
    const a = audioRef.current;
    if (!a || !playing) return;
    if (a.currentTime >= effectiveEnd) {
      a.currentTime = startAt;
    }
  }

  return (
    <div className="music-picker">
      {track ? (
        <div className="music-picker__track">
          <audio
            ref={audioRef}
            src={track}
            preload="metadata"
            onLoadedMetadata={onLoadedMetadata}
            onTimeUpdate={onTimeUpdate}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
          <div className="music-picker__row">
            <span className="music-picker__name" title={track}>{track.split('/').pop()}</span>
            <button type="button" onClick={() => (playing ? stopPreview() : playTrimmed())} disabled={!duration}>
              {playing ? <><Icon name="pause" /> Stop</> : <><Icon name="play" /> Preview trim</>}
            </button>
            <label className="music-picker__replace">
              {uploading ? 'Uploading…' : 'Replace'}
              <input ref={fileInput} type="file" accept="audio/*" hidden disabled={uploading} onChange={handleFile} />
            </label>
          </div>

          {duration > 0 ? (
            <div className="music-picker__trim">
              <div className="music-picker__trim-labels">
                <span>Start {fmt(startAt)}</span>
                <span>End {endAt > startAt ? fmt(endAt) : fmt(duration)}</span>
              </div>
              <div className="music-picker__sliders">
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={Math.min(startAt, duration)}
                  onChange={(e) => {
                    const v = Math.min(Number(e.target.value), (endAt > startAt ? endAt : duration) - 0.5);
                    set({ startAt: Math.max(0, v) });
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={endAt > startAt ? endAt : duration}
                  onChange={(e) => {
                    const v = Math.max(Number(e.target.value), startAt + 0.5);
                    set({ endAt: Math.min(duration, v) });
                  }}
                />
              </div>
              <p className="muted music-picker__hint">
                The invitation plays from {fmt(startAt)} and loops back once it reaches {endAt > startAt ? fmt(endAt) : fmt(duration)}.
              </p>
            </div>
          ) : (
            <p className="muted music-picker__hint">Loading track length…</p>
          )}

          <label className="music-picker__volume">
            Volume
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => set({ volume: Number(e.target.value) })}
            />
            <span className="muted">{Math.round(volume * 100)}%</span>
          </label>
        </div>
      ) : (
        <button
          type="button"
          className="music-picker__upload"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
        >
          <input ref={fileInput} type="file" accept="audio/*" hidden disabled={uploading} onChange={handleFile} />
          {uploading
            ? 'Uploading…'
            : <><Icon name="music" /> Upload a track <span className="muted">MP3, up to 15MB</span></>}
        </button>
      )}

      {error && <p className="error">{String(error.message)}</p>}
    </div>
  );
}
