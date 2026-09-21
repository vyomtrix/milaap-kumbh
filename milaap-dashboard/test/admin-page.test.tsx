import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/admin/page";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiFetch }));
vi.mock("@/components/AlertsPanel", () => ({ default: () => <div>Alerts</div> }));
vi.mock("@/components/CameraGrid", () => ({ default: () => <div>Cameras</div> }));
vi.mock("@/components/ComplaintsTable", () => ({ default: () => <div>Complaints</div> }));
vi.mock("@/components/MapView", () => ({ default: () => <div>Map</div> }));

describe("AdminPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiFetch.mockReset();
  });

  it("authenticates through the server and persists the returned token", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "demo-token", role: "admin" }),
    });

    render(<AdminPage />);
    fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Control Center")).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith("/admin/login", expect.objectContaining({ method: "POST" }));
    expect(sessionStorage.getItem("milaap-auth-session")).toContain("demo-token");
  });
});
