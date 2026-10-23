import type { ParticipantRole } from './ParticipantRole';

export interface VirtualMrParticipant {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  isAiAgent: boolean;
  roles: ParticipantRole[];
}

