import AgentWorkspace from "@/components/patient/AgentWorkspace";

export default function DietAssistant() {
  return (
    <AgentWorkspace
      agent="diet"
      planType="diet"
      title="CareSyncAI Diet"
      subtitle="Improve your meal plan using allergies, appetite, skipped meals, cravings, schedule timing, and adherence feedback."
      quickPrompts={[
        "Create a simpler meal plan for this week",
        "I skipped breakfast yesterday and got hungry later",
        "Replace one dinner with a higher-protein option",
        "Adjust meal timing for my work schedule",
      ]}
    />
  );
}
