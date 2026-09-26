// In-memory quota and plan store for serverless API handlers

export interface SessionData {
  used: number;
  plan: 'free' | 'standard' | 'premium' | 'vip';
}

declare global {
  // eslint-disable-next-line no-var
  var __medservice_sessions: Map<string, SessionData> | undefined;
}

if (!global.__medservice_sessions) {
  global.__medservice_sessions = new Map<string, SessionData>();
}

export const sessionStore = global.__medservice_sessions;
export const FREE_SEARCH_LIMIT = 20;

export function getSessionData(sessionId: string): SessionData {
  if (!sessionStore.has(sessionId)) {
    sessionStore.set(sessionId, { used: 0, plan: 'free' });
  }
  return sessionStore.get(sessionId)!;
}

export function incrementSearchUsage(sessionId: string): { blocked: boolean; used: number; limit: number; plan: string; remaining: number } {
  const session = getSessionData(sessionId);
  const isUnlimited = session.plan !== 'free';

  if (!isUnlimited && session.used >= FREE_SEARCH_LIMIT) {
    return {
      blocked: true,
      used: session.used,
      limit: FREE_SEARCH_LIMIT,
      plan: session.plan,
      remaining: 0,
    };
  }

  session.used += 1;
  const remaining = isUnlimited ? 9999 : Math.max(0, FREE_SEARCH_LIMIT - session.used);

  return {
    blocked: false,
    used: session.used,
    limit: FREE_SEARCH_LIMIT,
    plan: session.plan,
    remaining,
  };
}

export function upgradeSessionPlan(sessionId: string, plan: 'free' | 'standard' | 'premium' | 'vip') {
  const session = getSessionData(sessionId);
  session.plan = plan;
  return session;
}
