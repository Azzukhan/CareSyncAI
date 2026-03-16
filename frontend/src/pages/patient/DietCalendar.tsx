import AgentCalendarPage from "@/components/patient/AgentCalendarPage";

export default function DietCalendar() {
  return (
    <AgentCalendarPage
      planType="diet"
      title="Diet Calendar"
      subtitle="Review planned meals, their timing, and which ones were completed or missed."
    />
  );
}
