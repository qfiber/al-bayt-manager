const API_URL = import.meta.env.VITE_API_URL || '/api';

interface ChallengeResponse {
  challengeId: string;
  difficulty: number;
  prefix: string;
}

export interface PowProgress {
  nonce: string;
  hash: string;
  done: boolean;
}

export async function solveChallenge(
  onProgress?: (progress: PowProgress) => void,
): Promise<{ challengeId: string; nonce: string }> {
  const res = await fetch(`${API_URL}/auth/challenge`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch challenge');
  const challenge: ChallengeResponse = await res.json();

  const worker = new Worker(
    new URL('./pow-worker.ts', import.meta.url),
    { type: 'module' },
  );

  return new Promise<{ challengeId: string; nonce: string }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('PoW timeout'));
    }, 30_000);

    worker.onmessage = (e: MessageEvent<PowProgress>) => {
      onProgress?.(e.data);

      if (e.data.done) {
        clearTimeout(timeout);
        worker.terminate();
        resolve({ challengeId: challenge.challengeId, nonce: e.data.nonce });
      }
    };

    worker.onerror = (err) => {
      clearTimeout(timeout);
      worker.terminate();
      reject(err);
    };

    worker.postMessage({ prefix: challenge.prefix, difficulty: challenge.difficulty });
  });
}
