"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type HeaderSlotContextValue = {
  headerContent: ReactNode;
  setHeaderContent: (content: ReactNode) => void;
};

const HeaderSlotContext = createContext<HeaderSlotContextValue | null>(null);

export function HeaderSlotProvider({ children }: { children: ReactNode }) {
  const [headerContent, setHeaderContentState] = useState<ReactNode>(null);

  const setHeaderContent = useCallback((content: ReactNode) => {
    setHeaderContentState(() => content);
  }, []);

  const value = useMemo(
    () => ({ headerContent, setHeaderContent }),
    [headerContent, setHeaderContent]
  );

  return (
    <HeaderSlotContext.Provider value={value}>
      {children}
    </HeaderSlotContext.Provider>
  );
}

export function useHeaderSlot() {
  const context = useContext(HeaderSlotContext);
  if (!context) {
    return null;
  }
  return context;
}

export function HeaderSlotRenderer() {
  const context = useHeaderSlot();
  if (!context) return null;
  return <>{context.headerContent}</>;
}
