import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ApiError } from "./lib/api";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import About from "./pages/About";
import HealthTips from "./pages/HealthTips";
import Login from "./pages/Login";
import PatientSignup from "./pages/PatientSignup";
import SignupSuccess from "./pages/SignupSuccess";
import PatientDashboard from "./pages/patient/Dashboard";
import MedicalAssistant from "./pages/patient/MedicalAssistant";
import ExerciseAssistant from "./pages/patient/ExerciseAssistant";
import DietAssistant from "./pages/patient/DietAssistant";
import ExerciseCalendar from "./pages/patient/ExerciseCalendar";
import DietCalendar from "./pages/patient/DietCalendar";
import { PatientHistoryPage } from "./pages/patient/MedicalHistory";
import GPDashboard from "./pages/gp/Dashboard";
import SpecialistDashboard from "./pages/specialist/Dashboard";
import LabDashboard from "./pages/lab/Dashboard";
import PharmacyDashboard from "./pages/pharmacy/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status === 401) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout><Landing /></Layout>} />
          <Route path="/about" element={<Layout><About /></Layout>} />
          <Route path="/health-tips" element={<Layout><HealthTips /></Layout>} />
          <Route path="/login" element={<Layout><Login /></Layout>} />
          <Route path="/signup" element={<Layout><PatientSignup /></Layout>} />
          <Route path="/signup/success" element={<Layout><SignupSuccess /></Layout>} />
          <Route path="/dashboard/patient" element={<PatientDashboard />} />
          <Route path="/dashboard/patient/ai-assistant" element={<MedicalAssistant />} />
          <Route path="/dashboard/patient/exercise-planner" element={<ExerciseAssistant />} />
          <Route path="/dashboard/patient/diet-planner" element={<DietAssistant />} />
          <Route path="/dashboard/patient/calendar" element={<ExerciseCalendar />} />
          <Route path="/dashboard/patient/ai/medical" element={<MedicalAssistant />} />
          <Route path="/dashboard/patient/ai/medical/:conversationId" element={<MedicalAssistant />} />
          <Route path="/dashboard/patient/ai/exercise" element={<ExerciseAssistant />} />
          <Route path="/dashboard/patient/ai/exercise/:conversationId" element={<ExerciseAssistant />} />
          <Route path="/dashboard/patient/ai/diet" element={<DietAssistant />} />
          <Route path="/dashboard/patient/ai/diet/:conversationId" element={<DietAssistant />} />
          <Route path="/dashboard/patient/calendar/exercise" element={<ExerciseCalendar />} />
          <Route path="/dashboard/patient/calendar/diet" element={<DietCalendar />} />
          <Route path="/dashboard/patient/history" element={<PatientHistoryPage filter="all" />} />
          <Route path="/dashboard/patient/history/labs" element={<PatientHistoryPage filter="labs" />} />
          <Route path="/dashboard/patient/history/medicine" element={<PatientHistoryPage filter="medicine" />} />
          <Route path="/dashboard/patient/history/gp-visits" element={<PatientHistoryPage filter="gp-visits" />} />
          <Route path="/dashboard/patient/history/specialist" element={<PatientHistoryPage filter="specialist" />} />
          <Route path="/dashboard/gp" element={<GPDashboard />} />
          <Route path="/dashboard/specialist" element={<SpecialistDashboard />} />
          <Route path="/dashboard/lab" element={<LabDashboard />} />
          <Route path="/dashboard/pharmacy" element={<PharmacyDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
