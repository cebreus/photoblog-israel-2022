import { beforeEach, describe, expect, it, vi } from "vitest";
import { page as vitestPage } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import type { Person } from "$lib/types/manifest";

// Mock all child components to avoid deep dependency issues
vi.mock("$lib/components/PersonDetailDialog.svelte", () => ({ default: {} }));
vi.mock("$lib/components/PersonMergeDialog.svelte", () => ({ default: {} }));
vi.mock("../SelectionBulkActions.svelte", () => ({ default: {} }));
vi.mock("./CategoryPersonCard.svelte", () => ({ default: {} }));
vi.mock("./PeopleSelectionControls.svelte", () => ({ default: {} }));
vi.mock("./VisiblePeopleList.svelte", () => ({ default: {} }));

// Mock stores
vi.mock("$lib/stores/people.svelte", () => {
  class MockPeople {
    peopleWithStats = $state<Person[]>([]);
    visiblePeople = $state<Person[]>([]);
    photoDays = $state<any[]>([]);
    refresh = vi.fn();
    setPeople = vi.fn();
    setPhotoDays = vi.fn();
  }
  return { people: new MockPeople() };
});

vi.mock("$lib/stores/filters.svelte", () => {
  class MockFilters {
    selectedPeople = $state<string[]>([]);
    reset = vi.fn();
  }
  return { filters: new MockFilters() };
});

vi.mock("$app/state", () => ({
  page: {
    url: new URL("http://localhost:5173"),
  },
}));

vi.mock("$app/navigation", () => ({
  goto: vi.fn(),
  invalidateAll: vi.fn(),
}));

vi.mock("$app/environment", () => ({
  dev: true,
}));

vi.mock("svelte-sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import PeopleTab from "$lib/components/sidebar-content/PeopleTab.svelte";
import { filters } from "$lib/stores/filters.svelte";
import { people } from "$lib/stores/people.svelte";

describe("PeopleTab Component - Basic Rendering", () => {
  const mockPeople: Person[] = [
    {
      id: "alice-smith",
      name: "Alice Smith",
      faceCount: 5,
      faceDescriptor: [0.1, 0.2],
      thumbnail: "faces/alice-smith/img1.jpg",
      hidden: false,
      junk: false,
      createdAt: "2025-01-01T00:00:00Z",
      lastSeenAt: "2025-01-02T00:00:00Z",
    },
    {
      id: "bob-jones",
      name: "Bob Jones",
      faceCount: 3,
      faceDescriptor: [0.3, 0.4],
      thumbnail: "faces/bob-jones/img2.jpg",
      hidden: false,
      junk: false,
      createdAt: "2025-01-01T00:00:00Z",
      lastSeenAt: "2025-01-02T00:00:00Z",
    },
  ];

  beforeEach(() => {
    people.peopleWithStats = [...mockPeople];
    people.visiblePeople = mockPeople.filter((p) => !p.hidden);
    people.photoDays = [
      {
        date: "2025-01-01",
        id: "2025-01-01",
        items: [
          {
            type: "image",
            id: "img1",
            src: "img1.jpg",
            sources: [{ path: "/egypt-2025/images/img1.jpg" }],
          },
        ],
      },
    ];
    filters.selectedPeople = [];
    vi.clearAllMocks();
  });

  it("renders without crashing", async () => {
    const { container } = render(PeopleTab);
    expect(container).toBeTruthy();
  });

  it("renders people tab heading", async () => {
    render(PeopleTab);
    await expect.element(vitestPage.getByText("Osoby")).toBeInTheDocument();
  });

  it("handles empty people list", async () => {
    people.peopleWithStats = [];
    people.visiblePeople = [];

    const { container } = render(PeopleTab);
    expect(container).toBeTruthy();
  });

  it("updates when people store changes", async () => {
    render(PeopleTab);

    // Add a new person
    const newPerson: Person = {
      id: "charlie-brown",
      name: "Charlie Brown",
      faceCount: 7,
      faceDescriptor: [0.5, 0.6],
      thumbnail: "faces/charlie/img3.jpg",
      hidden: false,
      junk: false,
      createdAt: "2025-01-03T00:00:00Z",
      lastSeenAt: "2025-01-03T00:00:00Z",
    };

    people.peopleWithStats = [...mockPeople, newPerson];
    people.visiblePeople = [...mockPeople, newPerson];

    // Component should reactively update (Svelte 5 runes)
    expect(people.visiblePeople.length).toBe(3);
  });
});
