export const mockEmployees = [
  { id: '1', name: 'Priya Sharma', email: 'priya@attendx.com', employeeId: 'ATX-001', department: 'HR', designation: 'HR Manager', role: 'admin' as const, status: 'active' as const, avatar: '' },
  { id: '2', name: 'Rahul Verma', email: 'rahul@attendx.com', employeeId: 'ATX-042', department: 'Engineering', designation: 'Senior Developer', role: 'employee' as const, status: 'active' as const, avatar: '' },
  { id: '3', name: 'Anita Desai', email: 'anita@attendx.com', employeeId: 'ATX-015', department: 'Design', designation: 'UI/UX Lead', role: 'employee' as const, status: 'active' as const, avatar: '' },
  { id: '4', name: 'Vikram Singh', email: 'vikram@attendx.com', employeeId: 'ATX-023', department: 'Engineering', designation: 'Backend Developer', role: 'employee' as const, status: 'active' as const, avatar: '' },
  { id: '5', name: 'Meera Patel', email: 'meera@attendx.com', employeeId: 'ATX-031', department: 'Marketing', designation: 'Marketing Lead', role: 'employee' as const, status: 'active' as const, avatar: '' },
  { id: '6', name: 'Arjun Nair', email: 'arjun@attendx.com', employeeId: 'ATX-044', department: 'Engineering', designation: 'Frontend Developer', role: 'employee' as const, status: 'active' as const, avatar: '' },
  { id: '7', name: 'Kavya Iyer', email: 'kavya@attendx.com', employeeId: 'ATX-052', department: 'Finance', designation: 'Accountant', role: 'employee' as const, status: 'inactive' as const, avatar: '' },
  { id: '8', name: 'Ravi Kumar', email: 'ravi@attendx.com', employeeId: 'ATX-019', department: 'Engineering', designation: 'DevOps Engineer', role: 'employee' as const, status: 'active' as const, avatar: '' },
];

export const mockAttendanceToday = [
  { employeeId: '2', name: 'Rahul Verma', department: 'Engineering', checkIn: '09:02', checkOut: '—', hours: '7h 12m', breaks: '45m', status: 'present' as const },
  { employeeId: '3', name: 'Anita Desai', department: 'Design', checkIn: '09:15', checkOut: '—', hours: '6h 58m', breaks: '30m', status: 'late' as const },
  { employeeId: '4', name: 'Vikram Singh', department: 'Engineering', checkIn: '08:55', checkOut: '18:10', hours: '8h 30m', breaks: '45m', status: 'present' as const },
  { employeeId: '5', name: 'Meera Patel', department: 'Marketing', checkIn: '—', checkOut: '—', hours: '—', breaks: '—', status: 'absent' as const },
  { employeeId: '6', name: 'Arjun Nair', department: 'Engineering', checkIn: '09:00', checkOut: '—', hours: '7h 14m', breaks: '1h', status: 'break' as const },
  { employeeId: '8', name: 'Ravi Kumar', department: 'Engineering', checkIn: '08:45', checkOut: '—', hours: '7h 29m', breaks: '30m', status: 'present' as const },
];

export const mockAttendanceHistory = [
  { date: '2026-03-19', day: 'Thursday', checkIn: '09:02', checkOut: '—', hours: '—', breaks: '30m', status: 'present' as const },
  { date: '2026-03-18', day: 'Wednesday', checkIn: '08:58', checkOut: '18:15', hours: '8h 32m', breaks: '45m', status: 'present' as const },
  { date: '2026-03-17', day: 'Tuesday', checkIn: '09:22', checkOut: '18:00', hours: '7h 53m', breaks: '45m', status: 'late' as const },
  { date: '2026-03-16', day: 'Monday', checkIn: '09:00', checkOut: '18:05', hours: '8h 20m', breaks: '45m', status: 'present' as const },
  { date: '2026-03-15', day: 'Sunday', checkIn: '—', checkOut: '—', hours: '—', breaks: '—', status: 'absent' as const },
  { date: '2026-03-14', day: 'Saturday', checkIn: '—', checkOut: '—', hours: '—', breaks: '—', status: 'absent' as const },
  { date: '2026-03-13', day: 'Friday', checkIn: '09:05', checkOut: '17:30', hours: '7h 40m', breaks: '45m', status: 'present' as const },
  { date: '2026-03-12', day: 'Thursday', checkIn: '08:50', checkOut: '18:20', hours: '8h 45m', breaks: '45m', status: 'present' as const },
  { date: '2026-03-11', day: 'Wednesday', checkIn: '—', checkOut: '—', hours: '—', breaks: '—', status: 'leave' as const },
  { date: '2026-03-10', day: 'Tuesday', checkIn: '09:10', checkOut: '18:00', hours: '8h 05m', breaks: '45m', status: 'present' as const },
];

export const mockWeeklyHours = [
  { day: 'Mon', hours: 8.3 },
  { day: 'Tue', hours: 7.9 },
  { day: 'Wed', hours: 8.5 },
  { day: 'Thu', hours: 7.2 },
  { day: 'Fri', hours: 7.7 },
];

export const mockLeaveBalances = [
  { type: 'Casual Leave', icon: '🏖️', total: 12, used: 4, remaining: 8, color: 'primary' as const },
  { type: 'Sick Leave', icon: '🏥', total: 10, used: 2, remaining: 8, color: 'destructive' as const },
  { type: 'Earned Leave', icon: '⭐', total: 15, used: 5, remaining: 10, color: 'success' as const },
];

export const mockLeaveHistory = [
  { id: '1', type: 'Casual Leave', from: '2026-03-11', to: '2026-03-11', days: 1, status: 'approved' as const, reason: 'Personal work', remark: 'Approved', employeeName: 'Rahul Verma', employeeId: '2' },
  { id: '2', type: 'Sick Leave', from: '2026-02-20', to: '2026-02-21', days: 2, status: 'approved' as const, reason: 'Fever and cold', remark: 'Get well soon', employeeName: 'Rahul Verma', employeeId: '2' },
  { id: '3', type: 'Casual Leave', from: '2026-04-01', to: '2026-04-03', days: 3, status: 'pending' as const, reason: 'Family function', remark: '', employeeName: 'Rahul Verma', employeeId: '2' },
  { id: '4', type: 'Earned Leave', from: '2026-01-10', to: '2026-01-12', days: 3, status: 'rejected' as const, reason: 'Vacation', remark: 'Critical project deadline', employeeName: 'Anita Desai', employeeId: '3' },
  { id: '5', type: 'Casual Leave', from: '2026-03-25', to: '2026-03-25', days: 1, status: 'pending' as const, reason: 'Doctor appointment', remark: '', employeeName: 'Vikram Singh', employeeId: '4' },
  { id: '6', type: 'Sick Leave', from: '2026-03-20', to: '2026-03-22', days: 3, status: 'pending' as const, reason: 'Dental surgery', remark: '', employeeName: 'Meera Patel', employeeId: '5' },
];

export const mockWeeklyAttendance = [
  { day: 'Mon', present: 42, absent: 3 },
  { day: 'Tue', present: 40, absent: 5 },
  { day: 'Wed', present: 43, absent: 2 },
  { day: 'Thu', present: 38, absent: 7 },
  { day: 'Fri', present: 41, absent: 4 },
];

export const mockLeaveDistribution = [
  { name: 'Casual', value: 35, fill: 'hsl(244, 94%, 69%)' },
  { name: 'Sick', value: 20, fill: 'hsl(348, 86%, 65%)' },
  { name: 'Earned', value: 25, fill: 'hsl(165, 100%, 42%)' },
  { name: 'Maternity', value: 10, fill: 'hsl(36, 100%, 64%)' },
  { name: 'Other', value: 10, fill: 'hsl(210, 60%, 50%)' },
];

export const mockRecentActivity = [
  { id: '1', user: 'Rahul Verma', action: 'checked in', time: '09:02 AM', avatar: '' },
  { id: '2', user: 'Anita Desai', action: 'applied for casual leave', time: '09:15 AM', avatar: '' },
  { id: '3', user: 'Vikram Singh', action: 'checked out', time: '06:10 PM', avatar: '' },
  { id: '4', user: 'Meera Patel', action: 'marked absent', time: '10:00 AM', avatar: '' },
  { id: '5', user: 'Arjun Nair', action: 'started break', time: '01:00 PM', avatar: '' },
];

export const mockDailyTrend = [
  { date: 'Mar 10', avgHours: 8.1 },
  { date: 'Mar 11', avgHours: 7.8 },
  { date: 'Mar 12', avgHours: 8.4 },
  { date: 'Mar 13', avgHours: 7.6 },
  { date: 'Mar 14', avgHours: 0 },
  { date: 'Mar 15', avgHours: 0 },
  { date: 'Mar 16', avgHours: 8.2 },
  { date: 'Mar 17', avgHours: 7.9 },
  { date: 'Mar 18', avgHours: 8.3 },
  { date: 'Mar 19', avgHours: 7.5 },
];

export const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'present': return 'status-present';
    case 'absent': return 'status-absent';
    case 'late': return 'status-late';
    case 'leave': return 'status-leave';
    case 'break': return 'status-break';
    case 'approved': return 'status-present';
    case 'rejected': return 'status-absent';
    case 'pending': return 'status-late';
    default: return 'status-badge bg-secondary text-secondary-foreground';
  }
};

export const calendarDays = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const statuses = ['present','present','present','late','present','absent','absent','present','present','leave','present','present','present','absent','absent','present','late','present','present'];
  const days: { day: number; status: string }[] = [];
  for (let i = 0; i < firstDay; i++) days.push({ day: 0, status: '' });
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, status: d <= now.getDate() ? (statuses[(d - 1) % statuses.length] || 'present') : '' });
  }
  return days;
};
