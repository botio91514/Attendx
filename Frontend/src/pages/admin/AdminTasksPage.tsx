import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Monitor, 
  FileText, 
  RefreshCcw, 
  Calendar as CalendarIcon,
  Search,
  Users,
  CheckCircle2,
  Clock,
  Clock3,
  Timer,
  ChevronRight,
  TrendingUp,
  Download,
  AlertCircle,
  Plus,
  ListTodo
} from "lucide-react"
import { format, startOfDay, endOfDay, isValid } from "date-fns"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"
import { 
  AdminTasksResponse, 
  getAllTasksAdmin, 
  getEmployeeTaskReport,
  getEmployees,
  Task,
  EmployeeSummary,
  TaskUser
} from "@/lib/taskApi"
import { useTaskTimer } from "@/hooks/useTaskTimer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { createTask as apiCreateTask } from "@/lib/taskApi"

// Live Timer Component for Grid
const LiveTimer: React.FC<{ task: Task; startTime?: string }> = ({ task, startTime }) => {
  const { displayTime } = useTaskTimer(task, startTime)
  return <span className="font-mono text-emerald-600 font-bold dark:text-emerald-400">{displayTime}</span>
}

export const AdminTasksPage: React.FC = () => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("live")
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<AdminTasksResponse | null>(null)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [lastUpdated, setLastUpdated] = useState(new Date())

  // Report filters
  const [reportFilters, setReportFilters] = useState({
    userId: "all",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd")
  })
  const [reportData, setReportData] = useState<{ tasks: Task[], totalSeconds: number } | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [employees, setEmployees] = useState<TaskUser[]>([])

  // Create Task State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    assignedTo: "",
    plannedDate: format(new Date(), "yyyy-MM-dd")
  })

  const fetchLiveData = useCallback(async (dateToFetch?: string) => {
    try {
      const response = await getAllTasksAdmin(dateToFetch || selectedDate)
      setData(response.data)
      setLastUpdated(new Date())
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch live data")
    } finally {
      setIsLoading(false)
    }
  }, [selectedDate])

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTask.assignedTo) {
      toast.error("Please select an employee")
      return
    }
    try {
      setIsCreating(true)
      await apiCreateTask(newTask)
      toast.success("Task assigned successfully")
      setIsCreateDialogOpen(false)
      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        assignedTo: "",
        plannedDate: format(new Date(), "yyyy-MM-dd")
      })
      fetchLiveData()
    } catch (error: any) {
      toast.error(error.message || "Failed to create task")
    } finally {
      setIsCreating(false)
    }
  }

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await getEmployees()
      setEmployees(response.data)
    } catch (error) {
      console.error("Failed to fetch employees", error)
    }
  }, [])

  useEffect(() => {
    fetchLiveData()
    fetchEmployees()
  }, [fetchLiveData, fetchEmployees])

  // Live Auto-Refresh
  useEffect(() => {
    if (activeTab !== "live") return
    const interval = setInterval(() => {
      fetchLiveData()
    }, 30000)
    return () => clearInterval(interval)
  }, [activeTab, fetchLiveData])

  const generateReport = async () => {
    if (reportFilters.userId === "all") {
      toast.error("Please select a specific employee for the report")
      return
    }
    
    try {
      setIsGeneratingReport(true)
      const response = await getEmployeeTaskReport(
        reportFilters.userId, 
        reportFilters.startDate, 
        reportFilters.endDate
      )
      setReportData(response.data)
      toast.success("Task report generated successfully")
    } catch (error: any) {
      toast.error(error.message || "Failed to generate report")
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const formatSeconds = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in-progress": return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
      case "paused": return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
      case "completed": return "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800"
      default: return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700 border-red-200"
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200"
      case "low": return "bg-blue-100 text-blue-700 border-blue-200"
      default: return "bg-slate-100 text-slate-700 border-slate-200"
    }
  }

  const stats = useMemo(() => {
    if (!data) return { activeNow: 0, totalTasks: 0, completed: 0, totalHours: 0 }
    return {
      activeNow: data.employeeSummaries.filter(e => e.activeTask).length,
      totalTasks: data.tasks.length,
      completed: data.tasks.filter(t => t.status === "completed").length,
      totalHours: (data.tasks.reduce((sum, t) => sum + t.totalTime, 0) / 3600).toFixed(1)
    }
  }, [data])

  const sortedSummaries = useMemo(() => {
    if (!data) return []
    return [...data.employeeSummaries].sort((a, b) => {
      if (a.activeTask && !b.activeTask) return -1
      if (!a.activeTask && b.activeTask) return 1
      if (a.totalSecondsToday > 0 && b.totalSecondsToday === 0) return -1
      if (a.totalSecondsToday === 0 && b.totalSecondsToday > 0) return 1
      return 0
    })
  }, [data])

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 space-y-6">
      <Tabs defaultValue="live" onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Tasks Monitor</h1>
            <p className="text-slate-500 font-medium dark:text-slate-400">Track real-time productivity and generate performance reports.</p>
          </div>
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <TabsTrigger value="live" className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Monitor className="w-4 h-4 mr-2" /> Live Monitor
            </TabsTrigger>
            <TabsTrigger value="report" className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <FileText className="w-4 h-4 mr-2" /> Task Reports
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="live" className="space-y-6 mt-0">
          {/* Header Actions */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-48">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-10 h-10 rounded-lg"
                />
              </div>
              <Button variant="ghost" size="icon" onClick={() => fetchLiveData()} disabled={isLoading} className="rounded-full">
                <RefreshCcw className={cn("w-4 h-4 text-slate-500", isLoading && "animate-spin")} />
              </Button>
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-white gap-2 h-10 px-5 shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4" /> New Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-white rounded-3xl p-6 border-none shadow-2xl">
                <DialogHeader className="pb-4 border-b">
                  <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                    <ListTodo className="w-5 h-5 text-primary" /> Assign New Task
                  </DialogTitle>
                </DialogHeader>
                
                <form onSubmit={handleCreateTask} className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Task Title</label>
                    <Input 
                      placeholder="Enter task name..."
                      value={newTask.title}
                      onChange={e => setNewTask({...newTask, title: e.target.value})}
                      className="rounded-xl border-slate-200 h-11"
                      required
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Assign To</label>
                    <Select 
                      value={newTask.assignedTo} 
                      onValueChange={val => setNewTask({...newTask, assignedTo: val})}
                    >
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue placeholder="Select Employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                        <Select 
                          value={newTask.priority} 
                          onValueChange={val => setNewTask({...newTask, priority: val as any})}
                        >
                          <SelectTrigger className="rounded-xl h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Planned Date</label>
                        <Input 
                          type="date"
                          value={newTask.plannedDate}
                          onChange={e => setNewTask({...newTask, plannedDate: e.target.value})}
                          className="rounded-xl border-slate-200 h-11"
                        />
                     </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Description (Optional)</label>
                    <Textarea 
                      placeholder="..."
                      value={newTask.description}
                      onChange={e => setNewTask({...newTask, description: e.target.value})}
                      className="rounded-xl border-slate-200 min-h-[80px]"
                    />
                  </div>

                  <DialogFooter className="pt-4">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => setIsCreateDialogOpen(false)}
                      className="rounded-xl font-bold"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isCreating}
                      className="rounded-xl font-bold bg-primary hover:bg-primary/90 px-8"
                    >
                      {isCreating ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : "Assign Task"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Clock3 className="w-3 h-3" />
              Last updated: {format(lastUpdated, "hh:mm:ss a")}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Working Now", value: stats.activeNow, icon: <Timer className="w-5 h-5 text-emerald-500" />, sub: "Active Employees" },
              { label: "Tasks Today", value: stats.totalTasks, icon: <CheckCircle2 className="w-5 h-5 text-sky-500" />, sub: "Total Logged" },
              { label: "Completed", value: stats.completed, icon: <TrendingUp className="w-5 h-5 text-teal-500" />, sub: "Finished Today" },
              { label: "Total Hours", value: `${stats.totalHours}h`, icon: <Clock className="w-5 h-5 text-amber-500" />, sub: "Productive Time" }
            ].map((stat, i) => (
              <Card key={i} className="border-none shadow-sm dark:bg-slate-900/50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                      {stat.icon}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-tight">{stat.label}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{stat.sub}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Employee Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {isLoading ? (
              Array(8).fill(0).map((_, i) => (
                <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl"></div>
              ))
            ) : sortedSummaries.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-bold text-lg italic">No tasks recorded for this date.</p>
              </div>
            ) : (
              sortedSummaries.map((emp) => (
                <motion.div
                  key={emp.userId}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card 
                    onClick={() => navigate(`/admin/employee/${emp.userId}/activity?date=${selectedDate}`)}
                    className={cn(
                      "overflow-hidden border shadow-sm transition-all duration-300 group hover:shadow-lg flex flex-col h-full cursor-pointer hover:border-primary/40 hover:ring-4 hover:ring-primary/5",
                      emp.activeTask ? "bg-emerald-50/10 border-emerald-100" : "bg-white dark:bg-slate-900"
                    )}
                  >
                    <CardHeader className="p-4 pb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-2 ring-slate-50 dark:ring-slate-800">
                          <AvatarImage src={emp.profilePhoto} />
                          <AvatarFallback className="bg-slate-200 text-slate-600 font-bold uppercase text-xs">
                            {emp.name.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{emp.name}</div>
                          <div className="text-[10px] font-bold text-slate-400 tracking-wider flex items-center gap-1 uppercase">
                            <Users className="w-2.5 h-2.5" /> {emp.employeeId}
                          </div>
                        </div>
                        <Badge className={cn(
                          "rounded-md text-[10px] font-bold uppercase tracking-tight h-5",
                          emp.activeTask 
                            ? "bg-emerald-500 hover:bg-emerald-500" 
                            : emp.totalTasksToday > 0 ? "bg-amber-500 hover:bg-amber-500" : "bg-slate-300 hover:bg-slate-300"
                        )}>
                          {emp.activeTask ? "Working" : emp.totalTasksToday > 0 ? "Paused" : "Idle"}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-all group-hover:translate-x-1" />
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-4 pt-0 space-y-4">
                      {emp.activeTask ? (
                        <div className="bg-emerald-50/50 dark:bg-emerald-900/20 p-2.5 rounded-xl border border-emerald-100/50">
                          <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Current Task</div>
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate mb-2">
                            {emp.activeTask.title}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              <LiveTimer 
                                task={emp.activeTask} 
                                startTime={data?.tasks.find(t => t._id === emp.activeTask?._id)?.sessions?.find(s => !s.endTime)?.startTime} 
                              />
                            </div>
                            <Badge variant="outline" className="text-[10px] h-4 leading-none py-0 font-bold border-emerald-200 text-emerald-600">
                              Active
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 flex items-center justify-center min-h-[76px]">
                          <p className="text-[10px] font-bold text-slate-400 uppercase italic">No active task</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 pb-1">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{emp.completedToday}/{emp.totalTasksToday}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Completed</div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{formatSeconds(emp.totalSecondsToday)}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Time Today</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="report" className="space-y-6 mt-0">
          <Card className="border shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-800/50 border-b">
              <CardTitle className="text-xl">Generate Work Report</CardTitle>
              <CardDescription>Select filters below to view detailed task history for an employee.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Employee</label>
                  <Select 
                    value={reportFilters.userId} 
                    onValueChange={(val) => setReportFilters({...reportFilters, userId: val})}
                  >
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Select Employee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" disabled>Select Employee</SelectItem>
                      {employees.map(emp => (
                        <SelectItem key={emp._id} value={emp._id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Start Date</label>
                  <Input 
                    type="date" 
                    value={reportFilters.startDate}
                    onChange={(e) => setReportFilters({...reportFilters, startDate: e.target.value})}
                    className="rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">End Date</label>
                  <Input 
                    type="date" 
                    value={reportFilters.endDate}
                    onChange={(e) => setReportFilters({...reportFilters, endDate: e.target.value})}
                    className="rounded-xl h-11"
                  />
                </div>
                <Button 
                  onClick={generateReport} 
                  disabled={isGeneratingReport}
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl h-11 font-bold shadow-lg shadow-primary/20"
                >
                  {isGeneratingReport ? <RefreshCcw className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                  Generate Report
                </Button>
              </div>
            </CardContent>
          </Card>

          {reportData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50">
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">Date</TableHead>
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">Task Title</TableHead>
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">Priority</TableHead>
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">Status</TableHead>
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200">Created By</TableHead>
                      <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-right">Time Spent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.tasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 italic text-slate-400 font-medium">
                          No tasks found for the selected period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportData.tasks.map((task) => (
                        <TableRow key={task._id} className="hover:bg-slate-50/50">
                          <TableCell className="font-medium text-slate-600">{task.date}</TableCell>
                          <TableCell className="font-bold text-slate-900 max-w-[200px] truncate">{task.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[10px] font-bold uppercase", getPriorityColor(task.priority))}>
                              {task.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[10px] font-bold uppercase", getStatusColor(task.status))}>
                              {task.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500 font-medium">{task.createdBy.name}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-slate-700">{formatSeconds(task.totalTime)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                
                <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 border-t flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="text-sm font-medium text-slate-500">
                    Showing <span className="font-bold text-slate-900">{reportData.tasks.length}</span> results for 
                    <span className="font-bold text-primary mx-1">{employees.find(e => e._id === reportFilters.userId)?.name}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 px-6 py-3 rounded-xl border-2 border-primary/20 shadow-sm">
                    <div className="text-[10px] font-extrabold text-primary uppercase tracking-widest mb-1">Total Period Working Time</div>
                    <div className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-none">
                      {formatSeconds(reportData.totalSeconds)}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button variant="outline" className="rounded-xl font-bold gap-2">
                  <Download className="w-4 h-4" /> Export as PDF
                </Button>
              </div>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
