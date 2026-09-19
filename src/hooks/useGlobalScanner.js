import { useEffect, useRef } from 'react';

export function useGlobalScanner(inputRef, onSubmit) {
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const bufferRef = useRef('');
  const timerRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (bufferRef.current) {
          onSubmitRef.current(bufferRef.current);
          bufferRef.current = '';
        }
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { bufferRef.current = ''; }, 120);
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [inputRef]);
}
