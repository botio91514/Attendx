import React, { useState, useEffect, useCallback, useMemo } from "react"
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
  Loader2
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

// Live Timer Component for Grid
const LiveTimer: React.FC<{ task: Task; startTime?: string }> = ({ task, startTime }) => {
  const { displayTime } = useTaskTimer(task, startTime)
  return <span className="font-mono text-emerald-600 font-bold dark:text-emerald-400">{displayTime}</span>
}

export const AdminTasksPage: React.FC = () => {
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
    <div className="container max-w-7xl mx-auto py-8 px-4 space-y-10 min-h-screen">
      <Tabs defaultValue="live" onValueChange={setActiveTab} className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Task Productivity</h1>
            <p className="text-sm text-muted-foreground font-medium">Organization-wide real-time monitoring and reporting.</p>
          </div>
          <TabsList className="bg-secondary/50 p-1 rounded-2xl border border-glass-border">
            <TabsTrigger value="live" className="rounded-xl px-8 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-xl data-[state=active]:text-primary font-bold transition-all">
              <Monitor className="w-4 h-4 mr-2" /> Live Status
            </TabsTrigger>
            <TabsTrigger value="report" className="rounded-xl px-8 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-xl data-[state=active]:text-primary font-bold transition-all">
              <FileText className="w-4 h-4 mr-2" /> Performance Reports
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="live" className="space-y-10 mt-0">
          {/* Header Actions */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 glass-card p-5 border-glass-border bg-secondary/10">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-56">
                <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                <Input 
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="pl-12 h-12 rounded-xl bg-white/50 border-glass-border font-bold text-slate-700 focus:ring-primary shadow-sm"
                />
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => fetchLiveData()} 
                disabled={isLoading} 
                className="rounded-xl h-12 w-12 bg-white/50 hover:bg-white shadow-sm border-glass-border"
              >
                <RefreshCcw className={cn("w-5 h-5 text-primary", isLoading && "animate-spin")} />
              </Button>
            </div>
            
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 rounded-full border border-primary/10">
              <Clock3 className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary/70">
                Last Sync: {format(lastUpdated, "hh:mm:ss a")}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "Active Now", value: stats.activeNow, icon: <Timer />, sub: "Productive Staff", color: "text-success", bg: "bg-success/10" },
              { label: "Tasks Logged", value: stats.totalTasks, icon: <CheckCircle2 />, sub: "Daily Activity", color: "text-sky-500", bg: "bg-sky-500/10" },
              { label: "Completion", value: stats.completed, icon: <TrendingUp />, sub: "Work Finished", color: "text-teal-500", bg: "bg-teal-500/10" },
              { label: "Total Working", value: `${stats.totalHours}h`, icon: <Clock />, sub: "Cumulative Time", color: "text-amber-500", bg: "bg-amber-500/10" }
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 border-transparent shadow-sm flex flex-col justify-between overflow-hidden relative group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 blur-3xl rounded-full opacity-10 group-hover:opacity-20 transition-opacity" style={{ backgroundColor: 'currentColor' }}></div>
                <div className={cn("p-3 rounded-2xl w-fit mb-4 border border-glass-border", stat.color, stat.bg)}>
                  {stat.icon}
                </div>
                <div className="space-y-0.5">
                  <div className="text-3xl font-display font-black text-foreground tracking-tighter">{stat.value}</div>
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</div>
                  <div className="text-[10px] text-muted-foreground/60 font-medium">{stat.sub}</div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Employee Grid */}
          <div className="space-y-6">
             <div className="flex items-center gap-3">
               <div className="relative">
                 <Users className="w-5 h-5 text-primary" />
                 <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-success rounded-full animate-pulse-ring"></span>
               </div>
               <h3 className="text-xl font-display font-bold text-foreground">Team Live Status</h3>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {isLoading ? (
                  Array(8).fill(0).map((_, i) => (
                    <div key={i} className="h-48 glass-card animate-pulse border-glass-border"></div>
                  ))
                ) : sortedSummaries.length === 0 ? (
                  <div className="col-span-full py-24 text-center glass-card border-dashed bg-secondary/5">
                    <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground font-display font-medium text-lg italic tracking-wide">No team activity found for this period</p>
                  </div>
                ) : (
                  sortedSummaries.map((emp) => (
                    <motion.div
                      key={emp.userId}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="h-full"
                    >
                      <div className={cn(
                        "glass-card h-full flex flex-col p-5 overflow-hidden transition-all duration-500 border group",
                        emp.activeTask 
                          ? "border-success/30 shadow-lg shadow-success/10 bg-success/5" 
                          : "border-glass-border hover:shadow-xl hover:shadow-primary/5"
                      )}>
                        <div className="flex items-center gap-4 mb-5 pb-4 border-b border-glass-border/30">
                          <div className="relative">
                            <Avatar className="h-12 w-12 border-2 border-white shadow-xl ring-2 ring-primary/10">
                              <AvatarImage src={emp.profilePhoto} />
                              <AvatarFallback className="bg-primary/10 text-primary font-black uppercase text-sm">
                                {emp.name.split(" ").map(n => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            {emp.activeTask && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-success border-2 border-white rounded-full"></span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-foreground truncate leading-tight group-hover:text-primary transition-colors">{emp.name}</h4>
                            <p className="text-[10px] font-black text-muted-foreground tracking-tighter uppercase mt-0.5 flex items-center gap-1">
                               ID: {emp.employeeId}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex-1 space-y-5">
                          {emp.activeTask ? (
                            <div className="flex flex-col gap-2">
                               <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-black text-success uppercase tracking-widest">Active Now</span>
                                  <Badge className="text-[9px] bg-success/20 text-success hover:bg-success/30 border-none rounded-full h-4">WATCHING</Badge>
                               </div>
                               <p className="text-xs font-bold text-foreground line-clamp-1 italic">"{emp.activeTask.title}"</p>
                               <div className="flex items-center gap-2 py-2 px-3 bg-white/40 rounded-xl border border-success/10 w-fit">
                                  <Clock className="w-3.5 h-3.5 text-success animate-pulse" />
                                  <LiveTimer 
                                    task={emp.activeTask} 
                                    startTime={data?.tasks.find(t => t._id === emp.activeTask?._id)?.sessions?.find(s => !s.endTime)?.startTime} 
                                  />
                               </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-4 bg-secondary/10 rounded-2xl border border-glass-border/30 opacity-70">
                               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">Out of Office / Idle</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4 pt-1 border-t border-glass-border/30">
                            <div>
                               <p className="text-[9px] font-bold text-muted-foreground uppercase mb-0.5">Tasks Done</p>
                               <p className="text-sm font-black text-foreground">{emp.completedToday}<span className="text-[10px] text-muted-foreground font-medium ml-1">of {emp.totalTasksToday}</span></p>
                            </div>
                            <div>
                               <p className="text-[9px] font-bold text-muted-foreground uppercase mb-0.5">Total Time</p>
                               <p className="text-sm font-black text-foreground">{formatSeconds(emp.totalSecondsToday)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
             </div>
          </div>
        </TabsContent>

        <TabsContent value="report" className="space-y-8 mt-0">
          <div className="glass-card border-primary/10 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-glass-border bg-primary/5">
              <h3 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
                 <FileText className="w-5 h-5 text-primary" /> Generate Employee Work Report
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Audit task history and cumulative productivity records.</p>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-muted-foreground uppercase ml-1 tracking-widest">Select Employee</label>
                  <Select 
                    value={reportFilters.userId} 
                    onValueChange={(val) => setReportFilters({...reportFilters, userId: val})}
                  >
                    <SelectTrigger className="rounded-xl h-12 bg-white shadow-sm border-glass-border font-bold">
                      <SelectValue placeholder="Choose workforce" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" disabled>Choose workforce</SelectItem>
                      {employees.map(emp => (
                        <SelectItem key={emp._id} value={emp._id} className="font-medium">{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-muted-foreground uppercase ml-1 tracking-widest">Date From</label>
                  <Input 
                    type="date" 
                    value={reportFilters.startDate}
                    onChange={(e) => setReportFilters({...reportFilters, startDate: e.target.value})}
                    className="rounded-xl h-12 bg-white shadow-sm border-glass-border font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-muted-foreground uppercase ml-1 tracking-widest">Date To</label>
                  <Input 
                    type="date" 
                    value={reportFilters.endDate}
                    onChange={(e) => setReportFilters({...reportFilters, endDate: e.target.value})}
                    className="rounded-xl h-12 bg-white shadow-sm border-glass-border font-bold"
                  />
                </div>
                <Button 
                  onClick={generateReport} 
                  disabled={isGeneratingReport}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl h-12 font-display font-bold shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                >
                  {isGeneratingReport ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <TrendingUp className="w-5 h-5 mr-2" />}
                  GENERATE REPORT
                </Button>
              </div>
            </div>
          </div>

          {reportData && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <div className="glass-card p-0 border-glass-border overflow-hidden shadow-2xl">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/20 hover:bg-secondary/20 border-glass-border">
                      <TableHead className="font-black text-[11px] text-muted-foreground uppercase tracking-widest pl-6 py-5">Activity Date</TableHead>
                      <TableHead className="font-black text-[11px] text-muted-foreground uppercase tracking-widest py-5">Task Summary</TableHead>
                      <TableHead className="font-black text-[11px] text-muted-foreground uppercase tracking-widest py-5">Metrics</TableHead>
                      <TableHead className="font-black text-[11px] text-muted-foreground uppercase tracking-widest py-5 px-6 text-right">Time Invested</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.tasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-20 italic text-muted-foreground/50 font-medium">
                          No task history found for this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportData.tasks.map((task) => (
                        <TableRow key={task._id} className="hover:bg-primary/5 transition-colors border-glass-border">
                          <TableCell className="font-bold text-slate-500 pl-6 text-xs">{task.date}</TableCell>
                          <TableCell className="py-4">
                            <p className="font-bold text-foreground leading-tight truncate max-w-[300px]">{task.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Assigned by: {task.createdBy.name}</p>
                          </TableCell>
                          <TableCell>
                             <div className="flex gap-2">
                                <Badge variant="outline" className={cn("text-[8px] font-black uppercase rounded-md h-4", getPriorityColor(task.priority))}>
                                  {task.priority}
                                </Badge>
                                <Badge variant="outline" className={cn("text-[8px] font-black uppercase rounded-md h-4", getStatusColor(task.status))}>
                                  {task.status}
                                </Badge>
                             </div>
                          </TableCell>
                          <TableCell className="text-right pr-6 font-mono font-black text-foreground text-sm tracking-tight">{formatSeconds(task.totalTime)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                
                <div className="p-8 bg-primary/5 border-t border-glass-border flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 ring-4 ring-white shadow-xl">
                       <AvatarImage src={employees.find(e => e._id === reportFilters.userId)?.profilePhoto} />
                       <AvatarFallback className="bg-primary text-primary-foreground font-black uppercase">{employees.find(e => e._id === reportFilters.userId)?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="text-xs font-bold text-primary uppercase tracking-widest">Report For Employee</p>
                        <h4 className="text-xl font-display font-black text-foreground">{employees.find(e => e._id === reportFilters.userId)?.name}</h4>
                    </div>
                  </div>
                  
                  <div className="bg-white/80 backdrop-blur-xl px-10 py-5 rounded-3xl border-2 border-primary/30 shadow-2xl text-center md:text-right min-w-[240px] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 rotate-12 group-hover:scale-110 transition-transform">
                       <TrendingUp className="w-20 h-20 text-primary" />
                    </div>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1 relative z-10">Total Period Working Time</p>
                    <p className="text-4xl font-display font-black text-foreground leading-none relative z-10 tracking-tighter">
                      {formatSeconds(reportData.totalSeconds)}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-4 pb-10">
                <Button variant="outline" className="rounded-2xl h-12 px-8 font-bold border-glass-border hover:bg-white shadow-sm transition-all flex gap-2">
                  <Download className="w-5 h-5 text-muted-foreground" /> EXPORT REPORT (PDF)
                </Button>
              </div>
            </motion.div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
