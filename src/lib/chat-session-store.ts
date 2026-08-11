import type { ChatMessage } from "@/lib/domain";
import type { TaskPlan } from "@/lib/schemas";

export type CompletionProposalView = {
  id: string;
  confirmationText: string;
  task: { id: string; title: string; status: string };
};

export type CachedChatSession = {
  messages: ChatMessage[];
  proposal: (TaskPlan & { id: string }) | null;
  completionProposal: CompletionProposalView | null;
};

const sessions = new Map<string, CachedChatSession>();

export function getCachedChatSession(conversationId?: string) {
  if (!conversationId) return null;
  const cached = sessions.get(conversationId);
  return cached
    ? {
        ...cached,
        messages: cached.messages.map((message) => ({ ...message })),
      }
    : null;
}

export function cacheChatSession(
  conversationId: string,
  session: CachedChatSession,
) {
  sessions.set(conversationId, {
    ...session,
    messages: session.messages.map((message) => ({ ...message })),
  });
}
