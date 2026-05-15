
/**
 * Decodes a base64 string to a Uint8Array.
 */
export function decode(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes a Uint8Array to a base64 string.
 */
export function encode(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes audio data into an AudioBuffer. 
 * Supports both raw PCM (Gemini) and encoded formats (Google TTS MP3).
 */
export async function decodeAudioData(
  data,
  ctx,
  sampleRate,
  numChannels,
) {
  // 1. Try Native Decoder (for MP3, AAC, etc.)
  // We detect if it's likely an encoded format by checking for common headers
  // or just trying to decode it.
  const isMP3 = (data[0] === 0xFF && (data[1] & 0xE0) === 0xE0) ||
    (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33); // ID3 or Sync

  if (isMP3) {
    try {
      // NOTE: ctx.decodeAudioData requires an ArrayBuffer and is async
      // We must copy the buffer because decodeAudioData might detatch it
      const bufferCopy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      return await ctx.decodeAudioData(bufferCopy);
    } catch (e) {
      console.warn("[Audio] Native decode failed, attempting PCM fallback", e);
    }
  }

  // 2. Fallback to Raw PCM (Int16)
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Converts Float32Array PCM data from AudioContext to a base64 encoded Blob-like object for Gemini.
 */
export function createPcmBlob(data) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Map float range [-1, 1] to Int16 range [-32768, 32767]
    int16[i] = Math.max(-32768, Math.min(32767, data[i] * 32768));
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
