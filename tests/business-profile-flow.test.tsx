// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { BusinessProfile } from "@/components/profile/business-profile";
import { missingRequiredProfileFields } from "@/lib/profile";
import { profileSchema } from "@/lib/schemas";

const navigation = vi.hoisted(() => ({
  path: "/app/profile",
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.path,
  useRouter: () => navigation,
}));

const almostComplete = () =>
  profileSchema.parse({
    businessName: "Northstar Coffee",
    basics: {
      industry: "Food and beverage",
      description: "A neighborhood coffee shop.",
    },
    offerings: { main: ["Coffee"] },
  });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

async function showProfile(dismissGuide = true) {
  const result = render(
    <AppShell
      user={{ name: "Avery", email: "avery@example.com" }}
      initialConversations={[]}
      initialMissingFields={missingRequiredProfileFields(almostComplete())}
    >
      <BusinessProfile />
    </AppShell>,
  );
  if (dismissGuide) {
    const guide = await screen.findByRole("dialog", {
      name: "Start with just five details",
    });
    fireEvent.click(
      within(guide).getByRole("button", { name: "Start profile" }),
    );
  }
  return result;
}

function continueFromDocuments() {
  fireEvent.click(screen.getByRole("button", { name: /Business documents/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to advisor" }));
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  navigation.path = "/app/profile";
  navigation.push.mockReset();
  navigation.replace.mockReset();
});

describe("required profile setup", () => {
  it("shows completion once and keeps return visits free of completion notices", async () => {
    let storedProfile = almostComplete();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options?: RequestInit) => {
        if (options?.method === "PUT") {
          storedProfile = profileSchema.parse(
            JSON.parse(options.body as string),
          );
          return Promise.resolve(json({ saved: true }));
        }
        return Promise.resolve(json({ profile: storedProfile }));
      }),
    );
    const firstVisit = await showProfile();
    fireEvent.click(
      screen.getByRole("button", { name: /Customers and market/ }),
    );
    fireEvent.change(screen.getByLabelText(/Ideal customer/), {
      target: { value: "Local workers" },
    });
    const completion = await screen.findByRole(
      "dialog",
      { name: "You’re ready to start" },
      { timeout: 5000 },
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    fireEvent.click(
      within(completion).getByRole("button", { name: "Keep editing" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    firstVisit.unmount();
    await showProfile(false);
    await screen.findByLabelText(/Business name/);
    expect(
      screen.queryByRole("dialog", { name: "You’re ready to start" }),
    ).toBeNull();
    expect(
      screen.queryByText(/Your required details are filled in/),
    ).toBeNull();
  });
  it("saves newer edits after an in-flight save and continues with the latest profile", async () => {
    const saves: Array<{
      name: string;
      resolve: (response: Response) => void;
    }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, options?: RequestInit) => {
        if (options?.method !== "PUT")
          return Promise.resolve(
            json(
              url === "/api/documents"
                ? { documents: [] }
                : { profile: almostComplete() },
            ),
          );
        return new Promise<Response>((resolve) =>
          saves.push({
            name: JSON.parse(options.body as string).businessName,
            resolve,
          }),
        );
      }),
    );
    await showProfile();
    const businessName = await screen.findByLabelText(/Business name/);
    fireEvent.change(businessName, { target: { value: "First draft" } });
    await waitFor(() => expect(saves).toHaveLength(1), { timeout: 5000 });
    fireEvent.change(businessName, {
      target: { value: "Final business name" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Customers and market/ }),
    );
    fireEvent.change(screen.getByLabelText(/Ideal customer/), {
      target: { value: "Local workers" },
    });
    continueFromDocuments();
    expect(saves).toHaveLength(1);
    saves[0].resolve(json({ saved: true }));
    await waitFor(() => expect(saves).toHaveLength(2));
    expect(saves[1].name).toBe("Final business name");
    expect(
      screen
        .getByRole("button", { name: "Home" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(navigation.push).not.toHaveBeenCalled();
    saves[1].resolve(json({ saved: true }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/app"));
  });
  it("blocks direct access and explains disabled navigation", async () => {
    navigation.path = "/app/tasks";
    render(
      <AppShell
        user={{ name: "Avery", email: "avery@example.com" }}
        initialConversations={[]}
        initialMissingFields={missingRequiredProfileFields(almostComplete())}
      >
        <p>Private workspace content</p>
      </AppShell>,
    );
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/app/profile"),
    );
    expect(screen.queryByText("Private workspace content")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(
      screen.getByRole("dialog", { name: "Finish your business profile" }),
    ).toBeTruthy();
    expect(
      screen.queryByText("A few required details unlock your advisor."),
    ).toBeNull();
  });

  it("keeps navigation locked until the last required detail saves, then continues", async () => {
    let resolveSave!: (response: Response) => void;
    const fetchMock = vi.fn((url: string, options?: RequestInit) =>
      options?.method === "PUT"
        ? new Promise<Response>((resolve) => {
            resolveSave = resolve;
          })
        : Promise.resolve(
            json(
              url === "/api/documents"
                ? { documents: [] }
                : { profile: almostComplete() },
            ),
          ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await showProfile();
    await screen.findByLabelText(/Business name/);
    fireEvent.click(
      screen.getByRole("button", { name: /Customers and market/ }),
    );
    fireEvent.change(screen.getByLabelText(/Ideal customer/), {
      target: { value: "Nearby office workers" },
    });
    continueFromDocuments();
    await waitFor(() => expect(resolveSave).toBeTypeOf("function"));
    expect(
      screen
        .getByRole("button", { name: "Home" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(navigation.push).not.toHaveBeenCalled();
    resolveSave(json({ saved: true }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/app"));
    expect(screen.getByRole("link", { name: "Home" })).toBeTruthy();
    expect(
      JSON.parse(
        fetchMock.mock.calls.find(
          ([, options]) => options?.method === "PUT",
        )![1]!.body as string,
      ).customers.idealCustomer,
    ).toBe("Nearby office workers");
  });

  it("allows a failed save to be retried without leaving the profile", async () => {
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, options?: RequestInit) =>
        Promise.resolve(
          options?.method === "PUT"
            ? ++attempts === 1
              ? json({ error: "Connection lost. Please retry." }, 503)
              : json({ saved: true })
            : json(
                url === "/api/documents"
                  ? { documents: [] }
                  : { profile: almostComplete() },
              ),
        ),
      ),
    );
    await showProfile();
    await screen.findByLabelText(/Business name/);
    fireEvent.click(
      screen.getByRole("button", { name: /Customers and market/ }),
    );
    fireEvent.change(screen.getByLabelText(/Ideal customer/), {
      target: { value: "Nearby office workers" },
    });
    continueFromDocuments();
    await screen.findByText("Connection lost. Please retry.");
    expect(navigation.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Home" })).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to advisor" }),
    );
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/app"));
    expect(attempts).toBe(2);
  });

  it("takes an incomplete user from documents to the missing required field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          json(
            url === "/api/documents"
              ? { documents: [] }
              : { profile: almostComplete() },
          ),
        ),
      ),
    );
    await showProfile();
    await screen.findByLabelText(/Business name/);
    fireEvent.click(screen.getByRole("button", { name: /Business documents/ }));
    expect(screen.getByText(/File uploads are optional/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to advisor" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Add the required details" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Go to next required field" }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByLabelText(/Ideal customer/),
      ),
    );
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("preserves the stored profile when loading fails and offers a retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: "Profile unavailable" }, 503))
      .mockImplementation(() =>
        Promise.resolve(json({ profile: almostComplete() })),
      );
    vi.stubGlobal("fetch", fetchMock);
    await showProfile(false);
    await screen.findByText("Profile unavailable");
    expect(screen.queryByLabelText(/Business name/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try loading again" }));
    expect(
      (await screen.findByLabelText(/Business name/)) as HTMLInputElement,
    ).toHaveProperty("value", "Northstar Coffee");
    expect(
      fetchMock.mock.calls.every(([, options]) => options?.method !== "PUT"),
    ).toBe(true);
  });
});
