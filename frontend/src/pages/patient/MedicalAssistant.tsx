import AgentWorkspace from "@/components/patient/AgentWorkspace";

export default function MedicalAssistant() {
  return (
    <AgentWorkspace
      agent="medical"
      title="CareSyncAI Medical"
      subtitle="Ask health questions with awareness of your current diet plan, exercise plan, and patient context."
      accentClass="text-cyan-300"
      quickPrompts={[
        "Summarize what I should pay attention to this week",
        "How could my current routine affect how I feel?",
        "What details should I track before speaking to a GP?",
        "Review my current exercise and diet plans together",
      ]}
    />
  );
}
