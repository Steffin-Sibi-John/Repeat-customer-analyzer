import { useRef, useState } from "react";

export function useComposition() {
  const isComposingRef = useRef(false);
  const [, forceUpdate] = useState(0);

  const onCompositionStart = () => {
    isComposingRef.current = true;
  };

  const onCompositionEnd = () => {
    isComposingRef.current = false;
    forceUpdate(n => n + 1);
  };

  return {
    isComposing: isComposingRef.current,
    onCompositionStart,
    onCompositionEnd,
  };
}
