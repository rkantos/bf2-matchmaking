import { spawn } from 'node:child_process';
import OpusScript from 'opusscript';
import { info, warn } from '@bf2-matchmaking/logging';
import { getAdminClient } from './admin-client';

/**
 * Speaks gather instructions into TeamSpeak through the admin client.
 *
 * Players are in a voice channel, not reading chat, so the moment that actually
 * needs their attention - the summon - is the one they are least likely to see.
 * Saying it out loud reaches them where they already are.
 *
 * espeak-ng renders the text and opus encodes it, because TeamSpeak carries
 * voice as opus frames. Both are optional at runtime: without the binary this
 * stays silent rather than failing, since a missing voice line must never take
 * a gather down with it.
 */

/** TeamSpeak's codec id for opus voice, as opposed to opus music (5). */
const OPUS_VOICE_CODEC = 4;
/** Opus operates on 48kHz here; 20ms of it is 960 samples. */
const SAMPLE_RATE = 48_000;
const FRAME_SAMPLES = 960;
const FRAME_MS = 20;
const SPEECH_WORDS_PER_MINUTE = process.env.GATHER_VOICE_WPM || '150';
const VOICE = process.env.GATHER_VOICE_NAME || 'en';

let available: boolean | null = null;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function run(command: string, args: Array<string>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    const stdout: Array<Uint8Array<ArrayBuffer>> = [];
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => stdout.push(new Uint8Array(chunk)));
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + String(chunk)).slice(-500);
    });
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0
        ? resolve(Buffer.concat(stdout))
        : reject(new Error(`${command} exited ${code}: ${stderr}`))
    );
  });
}

/** Whether espeak-ng is installed. Probed once; the answer cannot change. */
export async function isSpeechAvailable() {
  if (available !== null) {
    return available;
  }
  try {
    await run('espeak-ng', ['--version']);
    available = true;
  } catch (e) {
    available = false;
    warn(
      'voice',
      'espeak-ng is not installed, gather voice announcements are disabled'
    );
  }
  return available;
}

/**
 * Extract mono 16-bit samples from a RIFF/WAVE buffer.
 *
 * espeak-ng writes a plain PCM wav, but the header is not a fixed length -
 * walking the chunks is what makes this safe against the extra chunks some
 * builds emit before the data.
 */
function decodeWav(buffer: Buffer) {
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error('espeak-ng did not return a wav');
  }
  let offset = 12;
  let sampleRate = 22_050;
  let channels = 1;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;

    if (id === 'fmt ') {
      channels = buffer.readUInt16LE(body + 2);
      sampleRate = buffer.readUInt32LE(body + 4);
    }
    if (id === 'data') {
      const samples = new Int16Array(size / 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = buffer.readInt16LE(body + i * 2);
      }
      return { samples, sampleRate, channels };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('wav has no data chunk');
}

/**
 * Resample to 48kHz, linearly.
 *
 * espeak-ng renders at 22.05kHz, which opus does not accept. Linear
 * interpolation is crude for music and inaudible on a synthetic voice, and it
 * avoids carrying a resampler - or ffmpeg - into the image for one short line.
 */
function resample(samples: Int16Array, from: number, to: number) {
  if (from === to) {
    return samples;
  }
  const ratio = from / to;
  const out = new Int16Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const next = Math.min(index + 1, samples.length - 1);
    const drift = position - index;
    out[i] = samples[index] + (samples[next] - samples[index]) * drift;
  }
  return out;
}

/** Average the channels, since espeak can be built to emit stereo. */
function toMono(samples: Int16Array, channels: number) {
  if (channels <= 1) {
    return samples;
  }
  const out = new Int16Array(Math.floor(samples.length / channels));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += samples[i * channels + c];
    out[i] = sum / channels;
  }
  return out;
}

/** Render text to the 20ms opus frames TeamSpeak expects. */
export async function encodeSpeech(text: string): Promise<Array<Uint8Array>> {
  const wav = await run('espeak-ng', [
    '--stdout',
    '-v',
    VOICE,
    '-s',
    SPEECH_WORDS_PER_MINUTE,
    text,
  ]);
  const { samples, sampleRate, channels } = decodeWav(wav);
  const pcm = resample(toMono(samples, channels), sampleRate, SAMPLE_RATE);

  const encoder = new OpusScript(SAMPLE_RATE, 1, OpusScript.Application.VOIP);
  const frames: Array<Uint8Array> = [];
  try {
    // A partial final frame is padded with silence: opus only encodes whole
    // frames, and dropping it would clip the last word.
    for (let offset = 0; offset < pcm.length; offset += FRAME_SAMPLES) {
      const frame = new Int16Array(FRAME_SAMPLES);
      frame.set(pcm.subarray(offset, offset + FRAME_SAMPLES));
      frames.push(new Uint8Array(encoder.encode(Buffer.from(frame.buffer), FRAME_SAMPLES)));
    }
  } finally {
    encoder.delete();
  }
  return frames;
}

/**
 * Say something in whichever channel the admin client is sitting in.
 *
 * Frames go out on the wall clock rather than in a burst: voice is a real-time
 * stream, and a client that receives a minute of audio at once plays noise.
 */
export async function speak(text: string) {
  if (!(await isSpeechAvailable())) {
    return false;
  }
  const client = await getAdminClient();
  if (!client) {
    warn('voice', 'No admin client connected, cannot speak');
    return false;
  }

  try {
    const frames = await encodeSpeech(text);
    const startedAt = Date.now();
    for (let i = 0; i < frames.length; i++) {
      client.sendVoice(frames[i], OPUS_VOICE_CODEC);
      // Schedule against the start rather than sleeping a flat 20ms, so encode
      // and send time cannot accumulate into a drawl.
      const nextAt = startedAt + (i + 1) * FRAME_MS;
      const delay = nextAt - Date.now();
      if (delay > 0) await wait(delay);
    }
    info('voice', `Said "${text}" in ${frames.length * FRAME_MS}ms`);
    return true;
  } catch (e) {
    warn('voice', `Failed to speak: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}
