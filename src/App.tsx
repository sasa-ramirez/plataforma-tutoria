import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/auth/LoginPage";
import { RegisterPage } from "@/pages/auth/RegisterPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/auth/ResetPasswordPage";
import { TermsPage } from "@/pages/legal/TermsPage";
import { PrivacyPage } from "@/pages/legal/PrivacyPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CoursesPage } from "@/pages/CoursesPage";
import { CourseDetailPage } from "@/pages/CourseDetailPage";
import { AssignmentDetailPage } from "@/pages/AssignmentDetailPage";
import { BoardPage } from "@/pages/BoardPage";
import { JoinClassPage } from "@/pages/JoinClassPage";
import { SolvePage } from "@/pages/SolvePage";
import { PracticePage } from "@/pages/PracticePage";
import { SandboxPage } from "@/pages/SandboxPage";
import { FreePracticePage } from "@/pages/FreePracticePage";
import { ProfilePage } from "@/pages/ProfilePage";
import { AdminPage } from "@/pages/AdminPage";
import { CoordinationPage } from "@/pages/CoordinationPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      {/* Entrar a una clase por enlace compartido */}
      <Route path="/j/:code" element={<JoinClassPage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:id" element={<CourseDetailPage />} />
        <Route path="courses/:id/board" element={<BoardPage />} />
        <Route path="assignments/:id" element={<AssignmentDetailPage />} />
        <Route path="practice" element={<PracticePage />} />
        <Route path="practice/free" element={<FreePracticePage />} />
        <Route path="sandbox" element={<SandboxPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route
          path="admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="coordinacion"
          element={
            <ProtectedRoute coordinatorOnly>
              <CoordinationPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Pantalla de resolución (fullscreen, sin layout) */}
      <Route
        path="/app/solve/:exerciseId"
        element={
          <ProtectedRoute>
            <SolvePage />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
