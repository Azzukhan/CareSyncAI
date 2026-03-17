export type UserRole = "patient" | "gp" | "specialist" | "lab" | "pharmacy";

export interface AuthUser {
  id: string;
  nhs_healthcare_id: string;
  full_name: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface PatientProfileInput {
  dateOfBirth?: string;
  phoneNumber?: string;
  address?: string;
  bloodGroup?: string;
  allergies?: string;
  chronicConditions?: string;
}

export interface HealthTip {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  read_time: string;
  image: string;
}

export interface PatientSummary {
  user_id: string;
  nhs_healthcare_id: string;
  full_name: string;
  email: string;
  date_of_birth: string | null;
  phone_number: string | null;
  address: string | null;
  blood_group: string | null;
  allergies: string[];
  chronic_conditions: string[];
}

export type HistoryRecordSource =
  | "gp_visit"
  | "specialist_referral"
  | "lab_report"
  | "medication_order";

export interface PatientVisit {
  id: string;
  source_kind: Extract<HistoryRecordSource, "gp_visit" | "specialist_referral">;
  patient_user_id: string;
  provider_user_id: string;
  provider_name: string;
  provider_role: UserRole;
  record_type: string;
  notes: string;
  is_hidden_by_patient: boolean;
  shared_with_gp: boolean;
  shared_with_specialist: boolean;
  created_at: string;
}

export interface PatientLabReport {
  id: string;
  lab_order_id: string;
  test_description: string;
  ordered_by_name: string;
  status: string;
  report_summary: string;
  file_url: string | null;
  shared_with_gp: boolean;
  shared_with_specialist: boolean;
  created_at: string;
}

export interface PatientMedication {
  id: string;
  patient_user_id: string;
  prescribed_by_user_id: string;
  prescribed_by_name: string;
  medicine_name: string;
  dosage_instruction: string;
  status: string;
  shared_with_gp: boolean;
  shared_with_specialist: boolean;
  created_at: string;
}

export interface PatientDashboardResponse {
  patient: PatientSummary;
  qr_payload: string;
  visits: PatientVisit[];
  lab_reports: PatientLabReport[];
  medications: PatientMedication[];
}

export interface GPDashboardPatient {
  nhs_healthcare_id: string;
  full_name: string;
  last_visit_at: string;
}

export interface GPDashboardResponse {
  gp_user_id: string;
  todays_patient_count: number;
  todays_visits: number;
  recent_patients: GPDashboardPatient[];
  generated_at: string;
}

export interface LabOrder {
  id: string;
  patient_user_id: string;
  requested_by_user_id: string;
  test_description: string;
  status: string;
}

export interface LabOrdersResponse {
  items: LabOrder[];
}

export interface PharmacyMedicationOrder {
  id: string;
  patient_user_id: string;
  prescribed_by_user_id: string;
  medicine_name: string;
  dosage_instruction: string;
  status: string;
}

export interface PharmacyMedicationsResponse {
  items: PharmacyMedicationOrder[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const ACCESS_TOKEN_KEY = "caresync_access_token";
const USER_KEY = "caresync_user";
export const AUTH_UNAUTHORIZED_EVENT = "caresync:unauthorized";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data?.detail ?? message;
    } catch {
      // Ignore JSON parse errors.
    }

    if (response.status === 401) {
      clearAuthSession();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
      }
    }

    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function storeAuthSession(token: string, user: AuthUser): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function login(identifier: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  return apiRequest<AuthUser>("/api/v1/auth/me", {
    headers: authHeaders(token),
  });
}

export async function registerPatient(input: {
  nhsHealthcareId: string;
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  return apiRequest<AuthUser>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({
      nhs_healthcare_id: input.nhsHealthcareId,
      full_name: input.fullName,
      email: input.email,
      password: input.password,
      role: "patient",
    }),
  });
}

export async function updatePatientProfile(
  token: string,
  input: PatientProfileInput,
): Promise<void> {
  await apiRequest("/api/v1/patients/me/profile", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({
      date_of_birth: input.dateOfBirth,
      phone_number: input.phoneNumber,
      address: input.address,
      blood_group: input.bloodGroup,
      allergies: input.allergies,
      chronic_conditions: input.chronicConditions,
    }),
  });
}

export async function getMyPatientProfile(token: string): Promise<PatientSummary> {
  return apiRequest<PatientSummary>("/api/v1/patients/me/profile", {
    headers: authHeaders(token),
  });
}

export async function getHealthTips(): Promise<HealthTip[]> {
  return apiRequest<HealthTip[]>("/api/v1/content/health-tips");
}

export async function getPatientDashboard(
  token: string,
  nhsHealthcareId: string,
): Promise<PatientDashboardResponse> {
  return apiRequest<PatientDashboardResponse>(
    `/api/v1/patients/${encodeURIComponent(nhsHealthcareId)}/dashboard`,
    { headers: authHeaders(token) },
  );
}

export async function updateVisitVisibility(
  token: string,
  visitId: string,
  isHiddenByPatient: boolean,
): Promise<void> {
  await updateHistoryAccess(token, visitId, {
    recordSource: "gp_visit",
    isHiddenByPatient,
  });
}

export async function updateHistoryAccess(
  token: string,
  recordId: string,
  input: {
    recordSource: HistoryRecordSource;
    isHiddenByPatient?: boolean;
    sharedWithGp?: boolean;
    sharedWithSpecialist?: boolean;
  },
): Promise<void> {
  await apiRequest(`/api/v1/patients/me/history/${input.recordSource}/${recordId}/access`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      is_hidden_by_patient: input.isHiddenByPatient,
      shared_with_gp: input.sharedWithGp,
      shared_with_specialist: input.sharedWithSpecialist,
    }),
  });
}

export async function bulkUpdateHistoryAccess(
  token: string,
  input: { sharedWithGp?: boolean; sharedWithSpecialist?: boolean },
): Promise<void> {
  await apiRequest("/api/v1/patients/me/history/access", {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      shared_with_gp: input.sharedWithGp,
      shared_with_specialist: input.sharedWithSpecialist,
    }),
  });
}

export async function getGpDashboard(token: string): Promise<GPDashboardResponse> {
  return apiRequest<GPDashboardResponse>("/api/v1/gp/dashboard", {
    headers: authHeaders(token),
  });
}

export async function createGpVisit(
  token: string,
  input: { patientNhsHealthcareId: string; notes: string },
): Promise<void> {
  await apiRequest("/api/v1/gp/visits", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      patient_nhs_healthcare_id: input.patientNhsHealthcareId,
      notes: input.notes,
    }),
  });
}

export async function createGpSpecialistReferral(
  token: string,
  input: { patientNhsHealthcareId: string; specialistNotes: string },
): Promise<void> {
  await apiRequest("/api/v1/gp/referrals/specialist", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      patient_nhs_healthcare_id: input.patientNhsHealthcareId,
      specialist_notes: input.specialistNotes,
    }),
  });
}

export async function createGpLabOrder(
  token: string,
  input: { patientNhsHealthcareId: string; testDescription: string },
): Promise<void> {
  await apiRequest("/api/v1/gp/referrals/lab", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      patient_nhs_healthcare_id: input.patientNhsHealthcareId,
      test_description: input.testDescription,
    }),
  });
}

export async function createGpMedication(
  token: string,
  input: { patientNhsHealthcareId: string; medicineName: string; dosageInstruction: string },
): Promise<void> {
  await apiRequest("/api/v1/gp/medications", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      patient_nhs_healthcare_id: input.patientNhsHealthcareId,
      medicine_name: input.medicineName,
      dosage_instruction: input.dosageInstruction,
    }),
  });
}

export async function createSpecialistNote(
  token: string,
  input: { patientNhsHealthcareId: string; specialistNotes: string },
): Promise<void> {
  await apiRequest("/api/v1/specialist/notes", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      patient_nhs_healthcare_id: input.patientNhsHealthcareId,
      specialist_notes: input.specialistNotes,
    }),
  });
}

export async function createSpecialistLabOrder(
  token: string,
  input: { patientNhsHealthcareId: string; testDescription: string },
): Promise<void> {
  await apiRequest("/api/v1/specialist/referrals/lab", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      patient_nhs_healthcare_id: input.patientNhsHealthcareId,
      test_description: input.testDescription,
    }),
  });
}

export async function createSpecialistMedication(
  token: string,
  input: { patientNhsHealthcareId: string; medicineName: string; dosageInstruction: string },
): Promise<void> {
  await apiRequest("/api/v1/specialist/medications", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      patient_nhs_healthcare_id: input.patientNhsHealthcareId,
      medicine_name: input.medicineName,
      dosage_instruction: input.dosageInstruction,
    }),
  });
}

export async function listLabOrders(token: string): Promise<LabOrdersResponse> {
  return apiRequest<LabOrdersResponse>("/api/v1/lab/orders", {
    headers: authHeaders(token),
  });
}

export async function uploadLabReport(
  token: string,
  input: { labOrderId: string; reportSummary: string; reportFile?: File | null },
): Promise<void> {
  const formData = new FormData();
  formData.append("lab_order_id", input.labOrderId);
  formData.append("report_summary", input.reportSummary);
  if (input.reportFile) {
    formData.append("report_file", input.reportFile);
  }

  await apiRequest("/api/v1/lab/reports", {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

export async function listPharmacyMedications(
  token: string,
): Promise<PharmacyMedicationsResponse> {
  return apiRequest<PharmacyMedicationsResponse>("/api/v1/pharmacy/medications", {
    headers: authHeaders(token),
  });
}

export async function dispenseMedication(token: string, medicationId: string): Promise<void> {
  await apiRequest("/api/v1/pharmacy/medications/dispense", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ medication_id: medicationId }),
  });
}

export function dashboardRouteForRole(role: UserRole): string {
  const roleToRoute: Record<UserRole, string> = {
    patient: "/dashboard/patient",
    gp: "/dashboard/gp",
    specialist: "/dashboard/specialist",
    lab: "/dashboard/lab",
    pharmacy: "/dashboard/pharmacy",
  };
  return roleToRoute[role];
}

// ── Health Data Types ──────────────────────────────────────────────

export interface HealthFileUpload {
  id: string;
  filename: string;
  file_url: string;
  file_type: string;
  parsed_status: string;
  records_imported: number;
  created_at: string;
}

export interface HealthMetricEntry {
  id: string;
  metric_type: string;
  value: number;
  unit: string;
  recorded_date: string;
  source: string;
  created_at: string;
}

export interface HealthMetricsSummary {
  date: string;
  steps?: number | null;
  heart_rate?: number | null;
  calories?: number | null;
  sleep_hours?: number | null;
  weight?: number | null;
  active_minutes?: number | null;
  distance_km?: number | null;
}

// ── AI Assistant Types ─────────────────────────────────────────────

export interface ChatMessageEntry {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface ExerciseItem {
  id: string;
  day_of_week: string;
  exercise_name: string;
  duration_minutes: number;
  intensity: string;
  notes?: string | null;
}

export interface DietMealItem {
  id: string;
  meal_type: string;
  food_items: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes?: string | null;
}

export type ExerciseSchedule = ExerciseItem;
export type DietPlan = DietMealItem;

// ── Calendar Types ─────────────────────────────────────────────────

export interface CalendarEventEntry {
  id: string;
  title: string;
  description?: string | null;
  event_type: string;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  is_recurring: boolean;
  recurrence_rule?: string | null;
  created_at: string;
}

// ── Health Data API ────────────────────────────────────────────────

export async function uploadHealthFile(token: string, file: File): Promise<HealthFileUpload> {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<HealthFileUpload>("/api/v1/health-data/upload", {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

export async function getHealthFiles(token: string): Promise<{ items: HealthFileUpload[] }> {
  return apiRequest<{ items: HealthFileUpload[] }>("/api/v1/health-data/files", {
    headers: authHeaders(token),
  });
}

export async function logHealthMetric(
  token: string,
  input: { metric_type: string; value: number; unit: string; recorded_date: string },
): Promise<HealthMetricEntry> {
  return apiRequest<HealthMetricEntry>("/api/v1/health-data/metrics", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function getHealthMetrics(
  token: string,
  params?: { metric_type?: string; start_date?: string; end_date?: string },
): Promise<{ items: HealthMetricEntry[] }> {
  const qs = new URLSearchParams();
  if (params?.metric_type) qs.set("metric_type", params.metric_type);
  if (params?.start_date) qs.set("start_date", params.start_date);
  if (params?.end_date) qs.set("end_date", params.end_date);
  const query = qs.toString();
  return apiRequest<{ items: HealthMetricEntry[] }>(
    `/api/v1/health-data/metrics${query ? `?${query}` : ""}`,
    { headers: authHeaders(token) },
  );
}

export async function getHealthMetricsSummary(
  token: string,
  targetDate: string,
): Promise<HealthMetricsSummary> {
  return apiRequest<HealthMetricsSummary>(
    `/api/v1/health-data/metrics/summary?target_date=${encodeURIComponent(targetDate)}`,
    { headers: authHeaders(token) },
  );
}

// ── AI Assistant API ───────────────────────────────────────────────

export async function sendAIMessage(
  token: string,
  input: {
    message: string;
    include_medical_history?: boolean;
    include_medications?: boolean;
    include_health_metrics?: boolean;
  },
): Promise<ChatMessageEntry> {
  return apiRequest<ChatMessageEntry>("/api/v1/ai/chat", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function getChatHistory(
  token: string,
): Promise<{ messages: ChatMessageEntry[] }> {
  return apiRequest<{ messages: ChatMessageEntry[] }>("/api/v1/ai/chat/history", {
    headers: authHeaders(token),
  });
}

export async function clearChatHistory(token: string): Promise<void> {
  await apiRequest("/api/v1/ai/chat/history", {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function generateExercisePlan(
  token: string,
  input: {
    fitness_level?: string;
    goals?: string;
    available_days?: string[];
    session_duration_minutes?: number;
  },
): Promise<{ items: ExerciseItem[]; ai_summary: string }> {
  return apiRequest<{ items: ExerciseItem[]; ai_summary: string }>(
    "/api/v1/ai/exercise-plan",
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(input),
    },
  );
}

export async function generateDietPlan(
  token: string,
  input: {
    dietary_restrictions?: string[];
    target_calories?: number;
    meals_per_day?: number;
    include_snacks?: boolean;
  },
): Promise<{ items: DietMealItem[]; total_calories: number; ai_summary: string }> {
  return apiRequest<{ items: DietMealItem[]; total_calories: number; ai_summary: string }>(
    "/api/v1/ai/diet-plan",
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(input),
    },
  );
}

// ── Calendar API ───────────────────────────────────────────────────

export async function getCalendarEvents(
  token: string,
  params?: { start_date?: string; end_date?: string },
): Promise<{ items: CalendarEventEntry[] }> {
  const qs = new URLSearchParams();
  if (params?.start_date) qs.set("start_date", params.start_date);
  if (params?.end_date) qs.set("end_date", params.end_date);
  const query = qs.toString();
  return apiRequest<{ items: CalendarEventEntry[] }>(
    `/api/v1/calendar/events${query ? `?${query}` : ""}`,
    { headers: authHeaders(token) },
  );
}

export async function createCalendarEvent(
  token: string,
  input: {
    title: string;
    event_date: string;
    description?: string;
    event_type?: string;
    start_time?: string;
    end_time?: string;
    is_recurring?: boolean;
    recurrence_rule?: string;
  },
): Promise<CalendarEventEntry> {
  return apiRequest<CalendarEventEntry>("/api/v1/calendar/events", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function updateCalendarEvent(
  token: string,
  eventId: string,
  input: Record<string, unknown>,
): Promise<CalendarEventEntry> {
  return apiRequest<CalendarEventEntry>(`/api/v1/calendar/events/${eventId}`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function deleteCalendarEvent(
  token: string,
  eventId: string,
): Promise<void> {
  await apiRequest(`/api/v1/calendar/events/${eventId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function syncExerciseToCalendar(
  token: string,
  weekStart: string,
): Promise<{ items: CalendarEventEntry[] }> {
  return apiRequest<{ items: CalendarEventEntry[] }>(
    `/api/v1/calendar/events/sync-exercise?week_start=${encodeURIComponent(weekStart)}`,
    { method: "POST", headers: authHeaders(token) },
  );
}

// ── Agentic Patient AI API ────────────────────────────────────────

export type CareAgentType = "medical" | "exercise" | "diet";
export type PreferredPanel = "summary" | "plan" | "calendar" | "history";
export type CarePlanType = "exercise" | "diet";
export type CarePlanStatus = "active" | "archived" | "draft";
export type CarePlanItemType = "exercise" | "meal";
export type CarePlanCheckinStatus = "completed" | "missed" | "skipped" | "replaced";

export interface YesterdaySummary {
  date: string;
  planned_count: number;
  completed_count: number;
  missed_count: number;
  skipped_count: number;
  replaced_count: number;
}

export interface PatientAgentProfile {
  id: string;
  goals: string[];
  allergies: string[];
  injuries_pain_points?: string | null;
  dietary_constraints: string[];
  motivation_style?: string | null;
  equipment_access?: string | null;
  schedule_preferences: string[];
  sleep_work_routine?: string | null;
  preferred_plan_horizon_days: number;
  share_medical_history: boolean;
  share_medications: boolean;
  share_health_metrics: boolean;
  additional_notes?: string | null;
  completeness_score: number;
  updated_at: string;
}

export interface CarePlanCheckin {
  id: string;
  checkin_date: string;
  status: CarePlanCheckinStatus;
  pain_level?: number | null;
  energy_level?: number | null;
  hunger_level?: number | null;
  notes?: string | null;
  replacement_title?: string | null;
  created_at: string;
}

export interface CarePlanItemOverride {
  id: string;
  override_date: string;
  title?: string | null;
  target_time?: string | null;
  duration_minutes?: number | null;
  calories?: number | null;
  intensity?: string | null;
  instructions?: string | null;
  details?: Record<string, unknown> | null;
  is_deleted: boolean;
}

export interface PlanItemCard {
  id: string;
  item_type: CarePlanItemType;
  title: string;
  scheduled_day?: string | null;
  scheduled_date?: string | null;
  meal_slot?: string | null;
  target_time?: string | null;
  duration_minutes?: number | null;
  calories?: number | null;
  intensity?: string | null;
  instructions?: string | null;
  details?: Record<string, unknown> | null;
  order_index: number;
  latest_checkin?: CarePlanCheckin | null;
  overrides: CarePlanItemOverride[];
}

export interface PlanTimeline {
  id: string;
  plan_type: CarePlanType;
  status: CarePlanStatus;
  title: string;
  summary?: string | null;
  start_date: string;
  end_date?: string | null;
  version: number;
  supersedes_plan_id?: string | null;
  created_from_conversation_id?: string | null;
  created_at: string;
  updated_at: string;
  yesterday_summary: YesterdaySummary;
  items: PlanItemCard[];
}

export interface AgentCalendarEvent {
  id: string;
  plan_id: string;
  plan_item_id: string;
  plan_type: CarePlanType;
  title: string;
  scheduled_for: string;
  target_time?: string | null;
  meal_slot?: string | null;
  intensity?: string | null;
  duration_minutes?: number | null;
  calories?: number | null;
  instructions?: string | null;
  status?: CarePlanCheckinStatus | null;
  source: string;
}

export interface AgentResponseBlock {
  summary: string;
  highlights: string[];
  suggested_follow_ups: string[];
  plan?: PlanTimeline | null;
  calendar_preview: AgentCalendarEvent[];
  yesterday_summary?: YesterdaySummary | null;
}

export interface ConversationMessage {
  id: string;
  prompt: string;
  created_at: string;
  preferred_panel: PreferredPanel;
  response_data?: AgentResponseBlock | null;
}

export interface ConversationSummary {
  id: string;
  agent: CareAgentType;
  title: string;
  starred: boolean;
  updated_at: string;
  message_count: number;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
}

export interface AgentQueryResult {
  conversation_id: string;
  response: string;
  preferred_panel: PreferredPanel;
  data: AgentResponseBlock;
}

export interface CheckinPayload {
  checkin_date: string;
  status: CarePlanCheckinStatus;
  pain_level?: number;
  energy_level?: number;
  hunger_level?: number;
  notes?: string;
  replacement_title?: string;
}

export async function getAgenticProfile(token: string): Promise<PatientAgentProfile> {
  return apiRequest<PatientAgentProfile>("/api/v1/agentic/profile", {
    headers: authHeaders(token),
  });
}

export async function updateAgenticProfile(
  token: string,
  input: Partial<Omit<PatientAgentProfile, "id" | "completeness_score" | "updated_at">>,
): Promise<PatientAgentProfile> {
  return apiRequest<PatientAgentProfile>("/api/v1/agentic/profile", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function listAgenticConversations(
  token: string,
  agent: CareAgentType,
): Promise<ConversationSummary[]> {
  const response = await apiRequest<{ items: ConversationSummary[] }>(
    `/api/v1/agentic/conversations?agent=${encodeURIComponent(agent)}`,
    { headers: authHeaders(token) },
  );
  return response.items;
}

export async function getAgenticConversation(
  token: string,
  conversationId: string,
): Promise<ConversationDetail> {
  const response = await apiRequest<{ data: ConversationDetail }>(
    `/api/v1/agentic/conversations/${conversationId}`,
    { headers: authHeaders(token) },
  );
  return response.data;
}

export async function starAgenticConversation(
  token: string,
  conversationId: string,
  starred: boolean,
): Promise<void> {
  await apiRequest(`/api/v1/agentic/conversations/${conversationId}/star`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ starred }),
  });
}

export async function updateAgenticConversation(
  token: string,
  conversationId: string,
  input: { title: string },
): Promise<ConversationSummary> {
  return apiRequest<ConversationSummary>(`/api/v1/agentic/conversations/${conversationId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function deleteAgenticConversation(
  token: string,
  conversationId: string,
): Promise<void> {
  await apiRequest(`/api/v1/agentic/conversations/${conversationId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function queryAgenticAssistant(
  token: string,
  input: {
    prompt: string;
    agent: CareAgentType;
    conversation_id?: string;
  },
): Promise<AgentQueryResult> {
  return apiRequest<AgentQueryResult>("/api/v1/agentic/chat/query", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function listCarePlans(
  token: string,
  params?: { plan_type?: CarePlanType; status?: "active" | "history" },
): Promise<PlanTimeline[]> {
  const qs = new URLSearchParams();
  if (params?.plan_type) qs.set("plan_type", params.plan_type);
  if (params?.status) qs.set("status", params.status);
  const response = await apiRequest<{ items: PlanTimeline[] }>(
    `/api/v1/agentic/plans${qs.toString() ? `?${qs.toString()}` : ""}`,
    { headers: authHeaders(token) },
  );
  return response.items;
}

export async function updateCarePlan(
  token: string,
  planId: string,
  input: Partial<Pick<PlanTimeline, "title" | "summary" | "start_date" | "end_date" | "status">>,
): Promise<PlanTimeline> {
  return apiRequest<PlanTimeline>(`/api/v1/agentic/plans/${planId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function updateCarePlanItem(
  token: string,
  itemId: string,
  input: Partial<
    Pick<
      PlanItemCard,
      | "title"
      | "scheduled_day"
      | "scheduled_date"
      | "meal_slot"
      | "target_time"
      | "duration_minutes"
      | "calories"
      | "intensity"
      | "instructions"
      | "details"
    >
  > & { override_date?: string },
): Promise<PlanItemCard> {
  return apiRequest<PlanItemCard>(`/api/v1/agentic/plan-items/${itemId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function createCarePlanCheckin(
  token: string,
  itemId: string,
  input: CheckinPayload,
): Promise<CarePlanCheckin> {
  return apiRequest<CarePlanCheckin>(`/api/v1/agentic/plan-items/${itemId}/checkins`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function getAgenticCalendar(
  token: string,
  params: { start_date: string; end_date: string; plan_type?: CarePlanType },
): Promise<AgentCalendarEvent[]> {
  const qs = new URLSearchParams();
  qs.set("start_date", params.start_date);
  qs.set("end_date", params.end_date);
  if (params.plan_type) qs.set("plan_type", params.plan_type);
  const response = await apiRequest<{ items: AgentCalendarEvent[] }>(
    `/api/v1/agentic/calendar?${qs.toString()}`,
    { headers: authHeaders(token) },
  );
  return response.items;
}
