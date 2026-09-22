/**
 * UrbanPulse Shared Command & Action Layer
 * Normalizes input from Text, Voice, and Hand Gestures into canonical application actions.
 */

export type UrbanPulseActionType =
  | 'NAVIGATE'
  | 'NEXT_PAGE'
  | 'PREVIOUS_PAGE'
  | 'QUERY_NEXUS'
  | 'CONFIRM'
  | 'TOGGLE_LAYER'
  | 'CLICK_AT';

export interface UrbanPulseAction {
  type: UrbanPulseActionType;
  payload?: any;
}

export type ActionHandler = (action: UrbanPulseAction) => void;

class CommandDispatcher {
  private handlers: Set<ActionHandler> = new Set();

  public subscribe(handler: ActionHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  public dispatch(action: UrbanPulseAction): void {
    this.handlers.forEach((handler) => {
      try {
        handler(action);
      } catch (err) {
        console.warn('[CommandDispatcher] Error in action handler:', err);
      }
    });
  }

  /**
   * Normalizes a voice or text command into an UrbanPulse action
   */
  public parseNaturalCommand(text: string): UrbanPulseAction | null {
    const query = text.toLowerCase().trim();

    // Navigation triggers
    if (query.includes('overview') || query.includes('home') || query.includes('अवलोकन') || query.includes('ಅವಲೋಕನ')) {
      return { type: 'NAVIGATE', payload: { path: '/overview' } };
    }
    if (query.includes('updates') || query.includes('pulsewire') || query.includes('news') || query.includes('अपडेट') || query.includes('ನವೀಕರಣ')) {
      return { type: 'NAVIGATE', payload: { path: '/updates' } };
    }
    if (query.includes('analytics') || query.includes('condition') || query.includes('intel') || query.includes('ಬುದ್ಧಿಮತ್ತೆ')) {
      return { type: 'NAVIGATE', payload: { path: '/analytics' } };
    }
    if (query.includes('nexus') || query.includes('simulate') || query.includes('copilot') || query.includes('agent')) {
      return { type: 'NAVIGATE', payload: { path: '/simulate' } };
    }
    if (query.includes('georag') || query.includes('satellite')) {
      return { type: 'NAVIGATE', payload: { path: '/georag' } };
    }
    if (query.includes('crisisrag') || query.includes('emergency') || query.includes('crisis')) {
      return { type: 'NAVIGATE', payload: { path: '/crisisrag' } };
    }
    if (query.includes('aquarag') || query.includes('water') || query.includes('flood')) {
      return { type: 'NAVIGATE', payload: { path: '/aquarag' } };
    }
    if (query.includes('research')) {
      return { type: 'NAVIGATE', payload: { path: '/research' } };
    }

    // Next / Previous triggers
    if (query.includes('next page') || query.includes('next panel') || query.includes('अगला') || query.includes('ಮುಂದಿನ')) {
      return { type: 'NEXT_PAGE' };
    }
    if (query.includes('previous page') || query.includes('back') || query.includes('पिछला') || query.includes('ಹಿಂದಿನ')) {
      return { type: 'PREVIOUS_PAGE' };
    }

    // Confirmation
    if (query === 'yes' || query === 'confirm' || query === 'हाँ' || query === 'ಹೌದು') {
      return { type: 'CONFIRM' };
    }

    // Default to Nexus query
    return { type: 'QUERY_NEXUS', payload: { query: text } };
  }
}

export const commandDispatcher = new CommandDispatcher();
