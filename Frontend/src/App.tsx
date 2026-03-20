import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import LoginPage from "@/pages/Login";
import EmployeeDashboard from "@/pages/employee/Dashboard";
import AttendancePage from "@/pages/employee/Attendance";
import Leaves from "@/pages/employee/Leaves";
import Profile from "@/pages/employee/Profile";
import Holidays from "@/pages/employee/Holidays";
import EmployeeNoticeBoard from '@/pages/employee/NoticeBoard';
import AdminOverview from "@/pages/admin/Overview";
import LiveAttendance from "@/pages/admin/LiveAttendance";
import Reports from "@/pages/admin/Reports";
import LeaveRequests from "@/pages/admin/LeaveRequests";
import Employees from "@/pages/admin/Employees";
import RegisterEmployee from "@/pages/admin/RegisterEmployee";
import Settings from "@/pages/admin/Settings";
import Announcements from "@/pages/admin/Announcements";
import AdminHolidays from "@/pages/admin/Holidays";
import Payroll from "@/pages/admin/Payroll";
import NotFound from "./pages/NotFound";

const App = () => (
  <AuthProvider>
    <NotificationProvider>
      <TooltipProvider>
        <Sonner position="top-right" closeButton richColors />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Employee routes */}
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<EmployeeDashboard />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/leaves" element={<Leaves />} />
              <Route path="/holidays" element={<Holidays />} />
              <Route path="/notices" element={<EmployeeNoticeBoard />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Admin routes */}
            <Route element={<ProtectedRoute role="admin"><DashboardLayout /></ProtectedRoute>}>
              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/admin/live" element={<LiveAttendance />} />
              <Route path="/admin/reports" element={<Reports />} />
              <Route path="/admin/leaves" element={<LeaveRequests />} />
              <Route path="/admin/employees" element={<Employees />} />
              <Route path="/admin/settings" element={<Settings />} />
              <Route path="/admin/holidays" element={<AdminHolidays />} />
              <Route path="/admin/announcements" element={<Announcements />} />
              <Route path="/admin/payroll" element={<Payroll />} />
              <Route path="/admin/register" element={<RegisterEmployee />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </NotificationProvider>
  </AuthProvider>
);

export default App;
