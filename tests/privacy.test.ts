import { describe, expect, it, vi } from "vitest";
import { buildAIContext } from "@/lib/ai/context-builder";
import { privacyScopedRetrievalToolNames } from "@/lib/ai/retrieval-tools";
import { hasValidUploadSignature } from "@/lib/file-security";
import { createSafetyIdentifier, detectHighRiskSecret } from "@/lib/privacy";

describe("high-risk secret detection", () => {
  it("blocks common government, payment, and credential secrets", () => {
    expect(detectHighRiskSecret("SSN 123-45-6789")).toBe(
      "social_security_number",
    );
    expect(detectHighRiskSecret("Card 4111 1111 1111 1111")).toBe(
      "payment_card",
    );
    expect(
      detectHighRiskSecret(
        "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----",
      ),
    ).toBe("private_key");
    expect(detectHighRiskSecret("Monthly revenue was $41,111")).toBeNull();
  });

  it("creates stable pseudonymous safety identifiers", async () => {
    const first = await createSafetyIdentifier("user-one@example.test");
    const repeat = await createSafetyIdentifier("user-one@example.test");
    const other = await createSafetyIdentifier("user-two@example.test");
    expect(first).toBe(repeat);
    expect(first).not.toBe(other);
    expect(first).not.toContain("user-one");
    expect(first.length).toBeLessThanOrEqual(64);
  });
});

describe("AI context privacy controls", () => {
  it("keeps the current conversation but skips disabled workspace sources", async () => {
    const source = {
      getBusinessSnapshot: vi.fn(),
      getPrimaryGoal: vi.fn(),
      getActiveTasks: vi.fn(),
      getPreviousConversationSummaries: vi.fn(),
      getRecentCompletedItems: vi.fn(),
      getCurrentConversationMemory: vi.fn().mockResolvedValue({
        summary: null,
        messages: [
          {
            id: "m1",
            role: "user",
            content: "Current question",
            created_at: "2026-08-20",
          },
        ],
      }),
    };
    const result = await buildAIContext({
      source,
      conversationId: "c1",
      privacySettings: {
        workspaceContextEnabled: false,
        crossConversationEnabled: false,
        documentSearchEnabled: false,
      },
    });
    expect(source.getCurrentConversationMemory).toHaveBeenCalled();
    expect(source.getBusinessSnapshot).not.toHaveBeenCalled();
    expect(source.getPreviousConversationSummaries).not.toHaveBeenCalled();
    expect(result.messages).toEqual([
      { role: "user", content: "Current question" },
    ]);
    expect(result.instructionsContext).toContain(
      "disabled by the workspace privacy setting",
    );
  });

  it("removes disabled retrieval capabilities instead of trusting the model", () => {
    const none = privacyScopedRetrievalToolNames({
      workspaceContextEnabled: false,
      crossConversationEnabled: false,
    });
    expect(none.size).toBe(0);
    const workspaceOnly = privacyScopedRetrievalToolNames({
      workspaceContextEnabled: true,
      crossConversationEnabled: false,
    });
    expect(workspaceOnly.has("list_tasks")).toBe(true);
    expect(workspaceOnly.has("get_conversation_details")).toBe(false);
  });
});

describe("upload signatures", () => {
  it("rejects disguised files and accepts matching headers", () => {
    expect(
      hasValidUploadSignature({
        name: "report.pdf",
        mimeType: "application/pdf",
        bytes: new TextEncoder().encode("%PDF-1.7").buffer,
      }),
    ).toBe(true);
    expect(
      hasValidUploadSignature({
        name: "report.pdf",
        mimeType: "application/pdf",
        bytes: new TextEncoder().encode("<script>").buffer,
      }),
    ).toBe(false);
  });
});
