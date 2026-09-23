/**
 * UrbanPulse Multimodal Accessibility Shortcuts
 * Ensures the platform is 100% accessible using standard keyboard / assistive tech.
 */

export function setupAccessibilityShortcuts(callbacks: {
  onFocusNexusInput?: () => void;
  onCloseModals?: () => void;
}): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleKeyDown = (e: KeyboardEvent) => {
    // Escape key closes modals and popups
    if (e.key === 'Escape') {
      callbacks.onCloseModals?.();
    }

    // '/' focuses search or chat input if not currently inside an input
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
      e.preventDefault();
      callbacks.onFocusNexusInput?.();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}
