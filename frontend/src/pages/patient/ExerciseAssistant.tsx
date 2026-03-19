import AgentWorkspace from "@/components/patient/AgentWorkspace";

export default function ExerciseAssistant() {
  return (
    <AgentWorkspace
      agent="exercise"
      planType="exercise"
      title="CareSyncAI Exercise"
      subtitle="Revise your plan using pain, mobility, missed sessions, motivation, equipment, and schedule feedback."
      quickPrompts={[
        "Based on my recent steps, how much should I increase activity this week?",
        "Create a gentler plan for this week",
        "I missed yesterday because I felt low energy",
        "Replace one session with a knee-safe option",
        "Shorten all sessions to 20 minutes",
      ]}
    />
  );
}
