import { useState, useEffect } from 'react';

export function useProgress(isLoading: boolean, estimatedDurationSeconds = 10) {
  const [progress, setProgress] = useState(0);
  const [previous, setPrevious] = useState({ isLoading, estimatedDurationSeconds });
  if (previous.isLoading !== isLoading || previous.estimatedDurationSeconds !== estimatedDurationSeconds) {
    setPrevious({ isLoading, estimatedDurationSeconds });
    setProgress(0);
  }
  useEffect(() => {
    if (!isLoading) return;
    const startTime = Date.now();
    const durationMs = Math.max(1, estimatedDurationSeconds * 1000);
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min(98, Math.round(98 * (1 - Math.exp(-elapsed / (durationMs * 0.5))))));
    }, 150);
    return () => clearInterval(timer);
  }, [isLoading, estimatedDurationSeconds]);
  return progress;
}
