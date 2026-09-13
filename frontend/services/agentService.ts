import { AgentInteractionRequest, AgentInteractionResponse } from '@shared/types';
import { apiClient } from './apiClient';

export const agentService = {
  async interact(request: AgentInteractionRequest): Promise<AgentInteractionResponse> {
    const response = await apiClient.post<AgentInteractionResponse>('/agent/interact', request);
    return response;
  },
};
