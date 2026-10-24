import { afterEach, describe, expect, it, vi } from "vitest";
import {
  completeDemoWelcome,
  getDemoProfile,
  getDemoTasksAndGoals,
  getDemoWorkspace,
  listDemoConversations,
  listDemoDocuments,
  resetDemoState,
  shouldShowDemoWelcome,
} from "@/lib/demo-store";
import { profileCompletion } from "@/lib/profile";

afterEach(() => {
  vi.unstubAllEnvs();
  resetDemoState();
});

describe("fresh account demo", () => {
  it("resets the workspace and welcome together, and remembers welcome dismissal", () => {
    vi.stubEnv("ENABLE_DEMO_MODE", "true");
    vi.stubEnv("ENABLE_DEMO_ONBOARDING", "true");
    resetDemoState();
    const firstId = getDemoWorkspace().user.id;
    expect(profileCompletion(getDemoProfile())).toBe(20);
    expect(listDemoDocuments()).toEqual([]);
    expect(listDemoConversations()).toEqual([]);
    expect(getDemoTasksAndGoals()).toEqual({ tasks: [], goals: [] });
    expect(shouldShowDemoWelcome()).toBe(true);
    completeDemoWelcome();
    expect(shouldShowDemoWelcome()).toBe(false);
    resetDemoState();
    expect(getDemoWorkspace().user.id).not.toBe(firstId);
    expect(shouldShowDemoWelcome()).toBe(true);
  });
});
