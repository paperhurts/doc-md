//! Pure audio chunking for streaming transcription.
//!
//! Accumulates 16 kHz mono f32 samples and decides when to hand a chunk to
//! Whisper:
//! - **Final** when the trailing audio has been silent for >= 700 ms and the
//!   buffer holds enough speech (natural pause = clean cut, no overlap
//!   bookkeeping needed), or when the buffer hits the 12 s hard cap.
//! - **Partial** snapshots of the growing buffer let the UI show live text.
//!
//! All-silence buffers are discarded, so quiet stretches cost nothing.

pub const SAMPLE_RATE: usize = 16_000;
const FRAME: usize = SAMPLE_RATE / 50; // 20 ms energy frames
const SILENCE_RMS: f32 = 0.01;
const SILENCE_FLUSH_MS: usize = 700;
const MIN_SPEECH_MS: usize = 300;
const MAX_WINDOW_MS: usize = 12_000;
const MIN_PARTIAL_MS: usize = 1_500;

#[derive(Debug, PartialEq)]
pub enum ChunkKind {
    Partial,
    Final,
}

#[derive(Debug)]
pub struct Chunk {
    pub samples: Vec<f32>,
    /// Stream offset of the chunk start (ms since session start).
    pub start_ms: u64,
    pub kind: ChunkKind,
}

pub struct Chunker {
    buf: Vec<f32>,
    /// Samples consumed (flushed or discarded) before `buf[0]`.
    consumed: u64,
}

fn rms(frame: &[f32]) -> f32 {
    if frame.is_empty() {
        return 0.0;
    }
    (frame.iter().map(|s| s * s).sum::<f32>() / frame.len() as f32).sqrt()
}

fn ms_to_samples(ms: usize) -> usize {
    ms * SAMPLE_RATE / 1000
}

impl Chunker {
    pub fn new() -> Self {
        Self { buf: Vec::new(), consumed: 0 }
    }

    fn start_ms(&self) -> u64 {
        self.consumed * 1000 / SAMPLE_RATE as u64
    }

    /// True when at least `MIN_SPEECH_MS` worth of frames exceed the
    /// silence threshold.
    fn has_speech(&self) -> bool {
        let needed = ms_to_samples(MIN_SPEECH_MS) / FRAME;
        self.buf
            .chunks(FRAME)
            .filter(|f| rms(f) > SILENCE_RMS)
            .take(needed)
            .count()
            >= needed
    }

    /// Trailing samples that are all below the silence threshold.
    fn trailing_silence_samples(&self) -> usize {
        let mut n = 0;
        for frame in self.buf.rchunks(FRAME) {
            if rms(frame) > SILENCE_RMS {
                break;
            }
            n += frame.len();
        }
        n
    }

    /// Feed samples; returns a Final chunk when a flush condition is met.
    pub fn push(&mut self, samples: &[f32]) -> Option<Chunk> {
        self.buf.extend_from_slice(samples);

        // Nothing but silence so far: discard, keeping one flush-window of
        // tail so a phrase that just started is never clipped.
        if !self.has_speech() {
            let keep = ms_to_samples(SILENCE_FLUSH_MS);
            if self.buf.len() > keep {
                let drop = self.buf.len() - keep;
                self.buf.drain(..drop);
                self.consumed += drop as u64;
            }
            return None;
        }

        let hard_cap = self.buf.len() >= ms_to_samples(MAX_WINDOW_MS);
        let pause = self.trailing_silence_samples() >= ms_to_samples(SILENCE_FLUSH_MS);
        if hard_cap || pause {
            return Some(self.flush());
        }
        None
    }

    /// Flush the whole buffer as a Final chunk.
    pub fn flush(&mut self) -> Chunk {
        let start_ms = self.start_ms();
        let samples = std::mem::take(&mut self.buf);
        self.consumed += samples.len() as u64;
        Chunk { samples, start_ms, kind: ChunkKind::Final }
    }

    /// Snapshot of the growing buffer for a live partial, or None while the
    /// buffer is too short / silent to be worth transcribing.
    pub fn partial(&self) -> Option<Chunk> {
        if self.buf.len() < ms_to_samples(MIN_PARTIAL_MS) || !self.has_speech() {
            return None;
        }
        Some(Chunk {
            samples: self.buf.clone(),
            start_ms: self.start_ms(),
            kind: ChunkKind::Partial,
        })
    }

    /// End-of-session: whatever speech remains, as a Final chunk.
    pub fn drain(&mut self) -> Option<Chunk> {
        if self.buf.is_empty() || !self.has_speech() {
            return None;
        }
        Some(self.flush())
    }
}

/// Linear resampler + channel downmix to 16 kHz mono. Linear interpolation
/// is plenty for speech-to-text input.
pub fn to_mono_16k(samples: &[f32], channels: usize, in_rate: usize) -> Vec<f32> {
    if samples.is_empty() || channels == 0 || in_rate == 0 {
        return Vec::new();
    }
    let mono: Vec<f32> = samples
        .chunks(channels)
        .map(|frame| frame.iter().sum::<f32>() / channels as f32)
        .collect();
    if in_rate == SAMPLE_RATE {
        return mono;
    }
    let out_len = (mono.len() as u64 * SAMPLE_RATE as u64 / in_rate as u64) as usize;
    let ratio = in_rate as f64 / SAMPLE_RATE as f64;
    (0..out_len)
        .map(|i| {
            let pos = i as f64 * ratio;
            let idx = pos as usize;
            let frac = (pos - idx as f64) as f32;
            let a = mono[idx.min(mono.len() - 1)];
            let b = mono[(idx + 1).min(mono.len() - 1)];
            a + (b - a) * frac
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tone(ms: usize, amp: f32) -> Vec<f32> {
        let n = ms_to_samples(ms);
        (0..n)
            .map(|i| amp * (i as f32 * 0.3).sin())
            .collect()
    }

    fn silence(ms: usize) -> Vec<f32> {
        vec![0.0; ms_to_samples(ms)]
    }

    #[test]
    fn silence_only_never_flushes_and_stays_bounded() {
        let mut c = Chunker::new();
        for _ in 0..20 {
            assert!(c.push(&silence(500)).is_none());
        }
        assert!(c.buf.len() <= ms_to_samples(SILENCE_FLUSH_MS) + ms_to_samples(500));
        assert!(c.partial().is_none());
        assert!(c.drain().is_none());
    }

    #[test]
    fn speech_then_pause_flushes_final() {
        let mut c = Chunker::new();
        assert!(c.push(&tone(2000, 0.5)).is_none());
        let chunk = c.push(&silence(800)).expect("pause should flush");
        assert_eq!(chunk.kind, ChunkKind::Final);
        assert!(chunk.samples.len() >= ms_to_samples(2000));
        // Next chunk starts after everything consumed so far
        assert!(c.push(&tone(2000, 0.5)).is_none());
        let chunk2 = c.push(&silence(800)).unwrap();
        assert!(chunk2.start_ms >= chunk.start_ms + 2000);
    }

    #[test]
    fn hard_cap_flushes_continuous_speech() {
        let mut c = Chunker::new();
        let mut flushed = None;
        for _ in 0..30 {
            if let Some(ch) = c.push(&tone(500, 0.5)) {
                flushed = Some(ch);
                break;
            }
        }
        let ch = flushed.expect("hard cap should flush");
        assert_eq!(ch.kind, ChunkKind::Final);
        assert!(ch.samples.len() >= ms_to_samples(MAX_WINDOW_MS));
    }

    #[test]
    fn partial_snapshots_growing_speech() {
        let mut c = Chunker::new();
        c.push(&tone(1000, 0.5));
        assert!(c.partial().is_none()); // too short
        c.push(&tone(1000, 0.5));
        let p = c.partial().expect("2s of speech should give a partial");
        assert_eq!(p.kind, ChunkKind::Partial);
        // partial does not consume the buffer
        assert!(c.partial().is_some());
    }

    #[test]
    fn leading_silence_is_discarded_from_timestamps_tail_kept() {
        let mut c = Chunker::new();
        for _ in 0..10 {
            c.push(&silence(1000));
        }
        c.push(&tone(2000, 0.5));
        let ch = c.push(&silence(800)).unwrap();
        // ~10s of silence consumed before speech; chunk starts near there
        assert!(ch.start_ms >= 8_000, "start_ms was {}", ch.start_ms);
    }

    #[test]
    fn to_mono_16k_downmixes_and_resamples() {
        // 48 kHz stereo, 1 second
        let stereo: Vec<f32> = (0..48_000)
            .flat_map(|_| [0.5f32, -0.5f32]) // L/R cancel to 0 when downmixed
            .collect();
        let out = to_mono_16k(&stereo, 2, 48_000);
        assert_eq!(out.len(), 16_000);
        assert!(out.iter().all(|s| s.abs() < 1e-6));

        // identity when already 16k mono
        let mono: Vec<f32> = (0..1600).map(|i| i as f32 / 1600.0).collect();
        let out = to_mono_16k(&mono, 1, 16_000);
        assert_eq!(out, mono);
    }
}
