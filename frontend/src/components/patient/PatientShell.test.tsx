import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";

import PatientShell from "@/components/patient/PatientShell";

describe("PatientShell", () => {
  it("renders CareSyncAI as an expandable navigation group", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/patient/ai/medical"]}>
        <PatientShell title="Patient Dashboard" patientName="Test Patient" onLogout={() => {}}>
          <div>Body</div>
        </PatientShell>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("CareSyncAI").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "CareSyncAI" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CareSync Calendar" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Diet Calendar" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CareSyncAI Medical" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CareSyncAI Exercise" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CareSyncAI Diet" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("auto-expands the CareSync Calendar group on calendar routes", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/patient/calendar/diet"]}>
        <PatientShell title="Diet Calendar" patientName="Test Patient" onLogout={() => {}}>
          <div>Body</div>
        </PatientShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "CareSync Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Exercise Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Diet Calendar" })).toBeInTheDocument();
  });
});
