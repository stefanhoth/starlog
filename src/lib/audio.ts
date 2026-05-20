export type RecorderState = 'idle' | 'recording' | 'stopped';

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Prefer mp4/aac for broader Gemini support; fall back to webm
    const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
      ? 'audio/mp4'
      : 'audio/webm';
    this.mediaRecorder = new MediaRecorder(stream, { mimeType });
    this.chunks = [];
    this.mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(250); // collect chunks every 250ms
  }

  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return reject(new Error('Not recording'));
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder!.mimeType });
        // Release mic
        this.mediaRecorder!.stream.getTracks().forEach(t => t.stop());
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }
}
