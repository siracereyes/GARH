import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { SYSTEM_INSTRUCTION } from '../constants';

interface LiveClientCallbacks {
  onOpen: () => void;
  onClose: () => void;
  onError: (error: Error) => void;
  onAudioData: (isPlaying: boolean) => void;
  onTranscript: (speaker: 'user' | 'model', text: string, isFinal: boolean) => void;
}

interface ConnectConfig {
  voiceName?: string;
  systemInstruction?: string;
}

export class GeminiLiveClient {
  private ai: GoogleGenAI;
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private isConnected = false;
  private callbacks: LiveClientCallbacks;
  
  // Transcript accumulation
  private currentModelText = "";
  private currentUserText = "";

  constructor(callbacks: LiveClientCallbacks) {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.callbacks = callbacks;
  }

  public async connect(configOpts?: ConnectConfig) {
    if (this.isConnected) return;

    try {
      // Initialize Audio Contexts
      // Try to request 16kHz, but accept whatever the browser gives us
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: configOpts?.systemInstruction || SYSTEM_INSTRUCTION,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: configOpts?.voiceName || 'Puck' } }, 
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      };

      const sessionPromise = this.ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            this.isConnected = true;
            this.currentModelText = "";
            this.currentUserText = "";
            this.callbacks.onOpen();
            this.startAudioInput(sessionPromise);
          },
          onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
          onclose: () => {
            this.isConnected = false;
            this.cleanup();
            this.callbacks.onClose();
          },
          onerror: (err: any) => {
            console.error("Gemini Live API Error:", err);
            if (this.isConnected) {
                this.callbacks.onError(new Error(err.message || "Network error or connection lost"));
            }
            this.disconnect();
          }
        }
      });
      
      this.session = sessionPromise;

    } catch (error) {
      console.error("Connection failed", error);
      this.callbacks.onError(error as Error);
    }
  }

  public disconnect() {
    if (this.session) {
      this.isConnected = false;
      // Mark session as potentially closed on client side
    }
    this.cleanup();
    this.callbacks.onClose();
  }

  private startAudioInput(sessionPromise: Promise<any>) {
    if (!this.inputAudioContext || !this.stream) return;

    // Ensure context is active (prevent browser auto-suspend)
    if (this.inputAudioContext.state === 'suspended') {
      this.inputAudioContext.resume();
    }

    this.source = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    // Capture actual sample rate to use in MIME type
    const currentSampleRate = this.inputAudioContext.sampleRate;

    this.processor.onaudioprocess = (e) => {
      if (!this.isConnected) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = this.createBlob(inputData, currentSampleRate);

      sessionPromise.then((session) => {
        if (this.isConnected) {
             session.sendRealtimeInput({ media: pcmBlob });
        }
      }).catch(err => {
          // Avoid logging if we already know we are disconnected
          if (this.isConnected) {
            console.warn("Failed to send audio chunk", err);
          }
      });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    // Handle Audio Output
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    
    if (audioData) {
      this.callbacks.onAudioData(true);
      if (!this.outputAudioContext) return;

      // Ensure output context is running
      if (this.outputAudioContext.state === 'suspended') {
         await this.outputAudioContext.resume();
      }

      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      
      const audioBuffer = await this.decodeAudioData(
        this.decode(audioData),
        this.outputAudioContext,
        24000,
        1
      );

      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputAudioContext.destination);
      
      source.addEventListener('ended', () => {
        this.sources.delete(source);
        if (this.sources.size === 0) {
             this.callbacks.onAudioData(false);
        }
      });

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.sources.add(source);
    }

    // Handle Interruptions
    const interrupted = message.serverContent?.interrupted;
    if (interrupted) {
      this.sources.forEach(s => s.stop());
      this.sources.clear();
      this.nextStartTime = 0;
      this.callbacks.onAudioData(false);
      
      // If we have accumulated text, mark it as final (interrupted)
      if (this.currentModelText) {
        this.callbacks.onTranscript('model', this.currentModelText, true);
      }
      this.currentModelText = "";
    }

    // Handle Transcription
    const modelTranscriptChunk = message.serverContent?.outputTranscription?.text;
    const userTranscriptChunk = message.serverContent?.inputTranscription?.text;
    const turnComplete = message.serverContent?.turnComplete;

    // Trigger callback if there is new text OR if the turn is complete (even if no new text)
    if (modelTranscriptChunk || (turnComplete && this.currentModelText)) {
      if (modelTranscriptChunk) {
        this.currentModelText += modelTranscriptChunk;
      }
      this.callbacks.onTranscript('model', this.currentModelText, !!turnComplete);
    }
    
    if (turnComplete) {
        // Reset model text buffer after turn is complete
        this.currentModelText = "";
        this.currentUserText = "";
    }

    if (userTranscriptChunk) {
      this.currentUserText += userTranscriptChunk;
      this.callbacks.onTranscript('user', this.currentUserText, false);
    }
  }

  private createBlob(data: Float32Array, sampleRate: number): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      let sample = data[i];
      
      // Dither noise to prevent silence timeouts
      if (sample === 0) {
         sample = (Math.random() * 0.0002) - 0.0001; 
      }
      
      // Clamp to [-1, 1]
      sample = Math.max(-1, Math.min(1, sample));
      
      // Convert to 16-bit PCM
      int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    
    return {
      data: this.encode(new Uint8Array(int16.buffer)),
      mimeType: `audio/pcm;rate=${sampleRate}`,
    };
  }

  private encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private async decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
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

  private cleanup() {
    if (this.processor && this.source) {
      this.source.disconnect();
      this.processor.disconnect();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
    }
    this.sources.forEach(s => s.stop());
    this.sources.clear();
    
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
      this.inputAudioContext.close();
    }
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
      this.outputAudioContext.close();
    }
  }
}
