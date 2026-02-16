/**
 * Buddy Realtime Audio Processor
 * This runs in a separate thread to ensure glitch-free audio capture
 * even when the main UI thread is busy.
 */
class BuddyAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.ptr = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            const channelData = input[0]; // Use mono channel

            for (let i = 0; i < channelData.length; i++) {
                this.buffer[this.ptr++] = channelData[i];

                if (this.ptr >= this.bufferSize) {
                    // Downsample and convert to Int16 for efficiency
                    const int16Buffer = this.float32ToInt16(this.buffer);
                    this.port.postMessage(int16Buffer);
                    this.ptr = 0;
                }
            }
        }
        return true;
    }

    float32ToInt16(buffer) {
        const l = buffer.length;
        const buf = new Int16Array(l);
        for (let i = 0; i < l; i++) {
            buf[i] = Math.min(1, Math.max(-1, buffer[i])) * 0x7FFF;
        }
        return buf.buffer;
    }
}

registerProcessor('buddy-audio-processor', BuddyAudioProcessor);
