// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chat } from "@/components/chat";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const response = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  replace.mockReset();
});

describe("persistent conversations", () => {
  it("removes an unsaved blocked message and leaves it available to edit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        response(
          {
            code: "SENSITIVE_DATA_DETECTED",
            error: "Remove the payment-card number before sending.",
          },
          false,
        ),
      ),
    );
    render(<Chat />);
    const input = screen.getByLabelText("Message your business consultant");
    fireEvent.change(input, {
      target: { value: "My card is 4111 1111 1111 1111" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("Remove the payment-card number before sending.");
    expect(
      screen.queryByText("My card is 4111 1111 1111 1111", {
        selector: "span",
      }),
    ).toBeNull();
    expect((input as HTMLTextAreaElement).value).toBe(
      "My card is 4111 1111 1111 1111",
    );
    expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
  });

  it("loads the selected conversation and keeps additional messages on the same ID", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const fetchMock = vi
      .fn()
      .mockImplementation((url: string, options?: RequestInit) => {
        if (url === `/api/conversations/${id}`)
          return response({
            conversation: { id, title: "Increasing Weekday Sales" },
            messages: [
              {
                id: "m1",
                role: "user",
                content: "How can I increase weekday sales?",
                created_at: "2026-01-01",
              },
              {
                id: "m2",
                role: "assistant",
                content: "Start by measuring demand by hour.",
                created_at: "2026-01-01",
              },
            ],
          });
        if (url === "/api/chat" && options?.method === "POST")
          return response({
            conversationId: id,
            message: {
              id: "m3",
              role: "assistant",
              content: "Test one offer at a time.",
              created_at: "2026-01-01",
            },
          });
        throw new Error(`Unexpected request: ${url}`);
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<Chat conversationId={id} />);
    await screen.findByText("Start by measuring demand by hour.");
    fireEvent.change(
      screen.getByLabelText("Message your business consultant"),
      { target: { value: "What should I test first?" } },
    );
    beforeEach(() => {
      Element.prototype.scrollIntoView = vi.fn();
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("Test one offer at a time.");
    const request = JSON.parse(
      fetchMock.mock.calls.find((call) => call[0] === "/api/chat")![1]
        .body as string,
    );
    expect(request).toEqual({
      conversationId: id,
      message: "What should I test first?",
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("adopts the stable server conversation ID after the first exchange", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        response({
          conversationId: id,
          title: "Reducing Fuel Costs",
          message: {
            id: "m2",
            role: "assistant",
            content: "Track idle time by crew and route.",
            created_at: "2026-01-01",
          },
        }),
      ),
    );
    render(<Chat />);
    fireEvent.change(
      screen.getByLabelText("Message your business consultant"),
      {
        target: { value: "How can my landscaping company reduce fuel costs?" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("Track idle time by crew and route.");
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/app/conversations/${id}`),
    );
  });

  it("keeps the completed exchange visible while the conversation route remounts", async () => {
    const id = "55555555-5555-4555-8555-555555555555";
    let resolveConversation: ((value: Response) => void) | undefined;
    const pendingConversation = new Promise<Response>((resolve) => {
      resolveConversation = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            conversationId: id,
            title: "Weekday Offers",
            message: {
              id: "assistant-1",
              role: "assistant",
              content: "Start with one measurable afternoon offer.",
              created_at: "2026-07-13",
            },
          }),
      } as Response)
      .mockImplementationOnce(() => pendingConversation);
    vi.stubGlobal("fetch", fetchMock);

    const initial = render(<Chat />);
    fireEvent.change(
      screen.getByLabelText("Message your business consultant"),
      { target: { value: "What offer should I test?" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("Start with one measurable afternoon offer.");
    initial.unmount();

    render(<Chat conversationId={id} />);
    expect(screen.getByText("What offer should I test?")).toBeTruthy();
    expect(
      screen.getByText("Start with one measurable afternoon offer."),
    ).toBeTruthy();
    expect(screen.queryByText("Loading consultation…")).toBeNull();
    expect(screen.queryByText(/How can I help .* today\?/)).toBeNull();

    resolveConversation?.(
      (await response({
        conversation: { id, title: "Weekday Offers" },
        messages: [
          {
            id: "user-1",
            role: "user",
            content: "What offer should I test?",
            created_at: "2026-07-13",
          },
          {
            id: "assistant-1",
            role: "assistant",
            content: "Start with one measurable afternoon offer.",
            created_at: "2026-07-13",
          },
        ],
      })) as Response,
    );
  });
});
