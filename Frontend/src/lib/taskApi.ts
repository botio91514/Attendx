import { api } from "./api"

export interface TaskUser {
  _id: string
  name: string
  employeeId: string
  profilePhoto?: string
}

export interface WorkSession {
  _id: string
  taskId: string
  userId: string
  startTime: string
  endTime: string | null
  duration: number
}

export interface Task {
  _id: string
  title: string
  description: string
  priority: "low" | "medium" | "high"
  status: "todo" | "in-progress" | "paused" | "completed"
  createdBy: TaskUser
  assignedTo: TaskUser
  totalTime: number       // total seconds
  date: string            // YYYY-MM-DD
  completedAt: string | null
  createdAt: string
  updatedAt: string
  sessions?: WorkSession[] // Added for admin views
}

export interface MyTasksResponse {
  todayTasks: Task[]
  backlogTasks: Task[]
  upcomingTasks: Task[]
  completedToday: Task[]
}

export interface EmployeeSummary {
  userId: string
  name: string
  employeeId: string
  profilePhoto?: string
  activeTask: Task | null
  totalTasksToday: number
  completedToday: number
  totalSecondsToday: number
}

export interface AdminTasksResponse {
  tasks: Task[]
  employeeSummaries: EmployeeSummary[]
}

export interface EmployeeActivityResponse {
  employee: TaskUser
  summary: {
    totalSecondsToday: number
    totalTasksWorked: number
    totalSessions: number
  }
  tasks: (Task & {
    sessions: (WorkSession & { effectiveDuration: number })[]
    taskTotalToday: number
  })[]
}

export const createTask = (data: any) => api.post("/tasks", data)
export const getMyTasks = () => api.get("/tasks/my")
export const getEmployees = () => api.get("/tasks/employees")
export const startTask = (id: string) => api.post(`/tasks/${id}/start`, {})
export const pauseTask = (id: string) => api.post(`/tasks/${id}/pause`, {})
export const resumeTask = (id: string) => api.post(`/tasks/${id}/resume`, {})
export const completeTask = (id: string) => api.post(`/tasks/${id}/complete`, {})
export const updateTask = (id: string, data: any) => api.put(`/tasks/${id}`, data)
export const deleteTask = (id: string) => api.delete(`/tasks/${id}`)
export const getAllTasksAdmin = (date?: string) => 
  api.get(`/tasks/admin/all${date ? `?date=${date}` : ""}`)
export const getEmployeeTaskReport = (userId: string, startDate: string, endDate: string) =>
  api.get(`/tasks/admin/report/${userId}?startDate=${startDate}&endDate=${endDate}`)
export const getEmployeeActivity = (employeeId: string, date?: string) =>
  api.get(`/tasks/admin/employee/${employeeId}/activity${date ? `?date=${date}` : ""}`)
