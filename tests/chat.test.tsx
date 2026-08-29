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
  it("builds an editable guided prompt without losing an existing draft", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<Chat />);

    const composer = screen.getByLabelText("Message your business consultant");
    fireEvent.change(composer, {
      target: { value: "Please keep this opening note." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Build a guided prompt" }),
    );
    fireEvent.change(screen.getByLabelText(/Goal or challenge/), {
      target: { value: "Increase quiet weekday sales" },
    });
    fireEvent.change(screen.getByLabelText("Relevant background"), {
      target: { value: "Tuesday afternoons are slow." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(
      (
        screen.getByLabelText(
          "Message your business consultant",
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("Please keep this opening note.");

    fireEvent.click(
      screen.getByRole("button", { name: "Build a guided prompt" }),
    );
    expect(
      (screen.getByLabelText(/Goal or challenge/) as HTMLTextAreaElement).value,
    ).toBe("Increase quiet weekday sales");
    fireEvent.click(
      screen.getByRole("button", { name: "Build editable prompt" }),
    );

    const built = (
      screen.getByLabelText(
        "Message your business consultant",
      ) as HTMLTextAreaElement
    ).value;
    expect(built).toContain("Please keep this opening note.");
    expect(built).toContain(
      "My goal or challenge:\nIncrease quiet weekday sales",
    );
    expect(built).toContain(
      "Relevant background:\nTuesday afternoons are slow.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("turns an actionable response into one editable, idempotent proposal", async () => {
    const conversationId = "66666666-6666-4666-8666-666666666666";
    const sourceMessageId = "77777777-7777-4777-8777-777777777777";
    const proposalId = "88888888-8888-4888-8888-888888888888";
    const plan = {
      goal: {
        title: "Increase Weekday Sales",
        description: "Test one focused offer.",
        targetDate: undefined,
      },
      tasks: [
        {
          title: "Measure afternoon traffic",
          description: "Create a baseline.",
          dueDate: undefined,
          priority: "high",
          order: 0,
        },
      ],
    };
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url === `/api/conversations/${conversationId}`)
        return response({
          conversation: { id: conversationId, title: "Weekday Sales" },
          messages: [
            {
              id: "55555555-5555-4555-8555-555555555556",
              role: "user",
              content: "How can I improve weekday sales?",
              created_at: "2026-08-28",
            },
            {
              id: sourceMessageId,
              role: "assistant",
              content: "Measure traffic, test one offer, and compare results.",
              created_at: "2026-08-28",
              metadata: {
                can_create_task_plan: true,
                task_plan_status: "available",
              },
            },
          ],
          proposal: null,
          completionProposal: null,
        });
      if (url === "/api/chat" && options?.method === "POST")
        return response({
          conversationId,
          message: {
            id: "99999999-9999-4999-8999-999999999999",
            role: "assistant",
            content: "I prepared the plan for your review.",
            created_at: "2026-08-28",
            metadata: { proposal_id: proposalId },
          },
          proposal: { id: proposalId, ...plan },
          completionProposal: null,
        });
      if (
        url === `/api/task-plans/${proposalId}` &&
        options?.method === "PATCH"
      )
        return response({ saved: true, proposal: { id: proposalId, ...plan } });
      if (
        url === `/api/task-plans/${proposalId}/approve` &&
        options?.method === "POST"
      )
        return response({
          approved: true,
          goal: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
          tasks: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }],
        });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Chat conversationId={conversationId} />);

    await screen.findByText(
      "Measure traffic, test one offer, and compare results.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Create goal & tasks" }),
    );
    await screen.findByRole("heading", { name: "Review goal and tasks" });

    const chatCall = fetchMock.mock.calls.find(
      ([url, options]) => url === "/api/chat" && options?.method === "POST",
    )!;
    expect(JSON.parse(chatCall[1]!.body as string)).toEqual({
      conversationId,
      message:
        "Create a goal and practical task list from your previous recommendation for my review.",
      taskPlanSourceMessageId: sourceMessageId,
    });
    expect(
      screen.queryByRole("button", { name: "Create goal & tasks" }),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("Goal title"), {
      target: { value: "Increase Tuesday Sales" },
    });
    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Measure Tuesday afternoon traffic" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save goal & tasks" }));
    await screen.findByText(/1 task added successfully/);

    const patchCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        url === `/api/task-plans/${proposalId}` && options?.method === "PATCH",
    )!;
    const edited = JSON.parse(patchCall[1]!.body as string);
    expect(edited.goal.title).toBe("Increase Tuesday Sales");
    expect(edited.tasks[0].title).toBe("Measure Tuesday afternoon traffic");
    expect(
      screen.getByRole("link", { name: "View tasks" }).getAttribute("href"),
    ).toBe("/app/tasks?goal=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("persists cancellation of a proposed goal and task plan", async () => {
    const conversationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const proposalId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url === `/api/conversations/${conversationId}`)
        return response({
          conversation: { id: conversationId, title: "Plan Review" },
          messages: [
            {
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              role: "assistant",
              content: "I prepared the plan for your review.",
              created_at: "2026-08-28",
              metadata: {
                proposal_id: proposalId,
                task_plan_status: "proposed",
              },
            },
          ],
          proposal: {
            id: proposalId,
            goal: { title: "Improve retention" },
            tasks: [
              {
                title: "Review repeat visits",
                priority: "medium",
                order: 0,
              },
            ],
          },
          completionProposal: null,
        });
      if (
        url === `/api/task-plans/${proposalId}` &&
        options?.method === "DELETE"
      )
        return response({ cancelled: true });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<Chat conversationId={conversationId} />);

    await screen.findByRole("heading", { name: "Review goal and tasks" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Review goal and tasks" }),
      ).toBeNull(),
    );
    expect(fetchMock).toHaveBeenCalledWith(`/api/task-plans/${proposalId}`, {
      method: "DELETE",
    });
  });

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
