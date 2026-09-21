import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthorityPage from "@/app/authority/page";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiFetch }));

describe("AuthorityPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiFetch.mockReset();
  });

  it("logs an authority in and requests only the authenticated authority's alerts", async () => {
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "authority-token", authority_id: 7, name: "Central Station" }),
      })
      .mockResolvedValue({ ok: true, json: async () => [] });

    render(<AuthorityPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "central" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("No alerts in this category")).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith("/authority/alerts");
    expect(sessionStorage.getItem("milaap-auth-session")).toContain("authority-token");
  });
});
