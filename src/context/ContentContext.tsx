import { createContext, useContext, type ReactNode } from 'react';
import type { ContentData } from '../services/contentApi';

interface ContentContextType {
  content: ContentData | null;
  loading: boolean;
  error: string | null;
}

const ContentContext = createContext<ContentContextType>({
  content: null,
  loading: false,
  error: null,
});

export function ContentProvider({ children }: { children: ReactNode }) {
  return (
    <ContentContext.Provider value={{ content: null, loading: false, error: null }}>
      {children}
    </ContentContext.Provider>
  );
}

export function useContent() {
  return useContext(ContentContext);
}

export function useHeroStats() {
  const { content } = useContent();
  return content?.heroStats ?? [];
}

export function useNavLinks() {
  const { content } = useContent();
  return content?.navLinks ?? [];
}

export function useProblemStats() {
  const { content } = useContent();
  return content?.problemStats ?? [];
}

export function useProducts() {
  const { content } = useContent();
  return content?.products ?? [];
}

export function useHowSteps() {
  const { content } = useContent();
  return content?.howSteps ?? [];
}

export function useAudience() {
  const { content } = useContent();
  return content?.audience ?? [];
}

export function useTestimonials() {
  const { content } = useContent();
  return content?.testimonials ?? [];
}

export function usePricing() {
  const { content } = useContent();
  return content?.pricing ?? [];
}
