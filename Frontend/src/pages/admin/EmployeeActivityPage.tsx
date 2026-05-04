import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useParams, useSearchParams, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, 
  Clock, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Play, 
  Pause, 
  AlertCircle,
  Loader2,
  Timer,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  History,
  Pencil,
  Trash2,
  Edit3,
  TimerReset
} from "lucide-react"
import { parseDBDate } from "@/utils/dateUtils"
import { useWorkingTimer } from "@/hooks/useClock"
import { format } from "date-fns"
import { toast } from "sonner"
import { 
  getEmployeeActivity, 
  EmployeeActivityResponse,
  updateTask,
  deleteTask 
} from "@/lib/taskApi"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import ConfirmDialog from "@/components/ConfirmDialog"
import { cn } from "@/lib/utils"

// Live Timer Component for individual sessions
const LiveTimer = ({ startTime }: { startTime: string }) => {
  const { elapsed } = useWorkingTimer(startTime);
  return <span className="font-mono text-emerald-600 font-bold">{elapsed}</span>;
}

export const EmployeeActivityPage: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const selectedDate = searchParams.get("date") || format(new Date(), "yyyy-MM-dd")
  const [data, setData] = useState<EmployeeActivityResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Edit / Delete States
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [taskToEdit, setTaskToEdit] = useState<any>(null)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!employeeId) return
    try {
      setIsLoading(true)
      const res = await getEmployeeActivity(employeeId, selectedDate)
      setData(res.data)
    } catch (error: any) {
      toast.error(error.message || "Failed to load activity")
    } finally {
      setIsLoading(false)
    }
  }, [employeeId, selectedDate])

  const handleDeleteTask = async () => {
    if (!taskToDelete) return
    try {
      setIsProcessing(true)
      await deleteTask(taskToDelete)
      toast.success("Task deleted successfully")
      fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to delete task")
    } finally {
      setIsProcessing(false)
      setIsDeleteDialogOpen(false)
      setTaskToDelete(null)
    }
  }

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskToEdit) return
    try {
      setIsProcessing(true)
      await updateTask(taskToEdit._id, {
        title: taskToEdit.title,
        description: taskToEdit.description,
        priority: taskToEdit.priority,
        totalTime: taskToEdit.totalTimeCombined // combined seconds
      })
      toast.success("Task updated successfully")
      setIsEditDialogOpen(false)
      fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to update task")
    } finally {
      setIsProcessing(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Poll every 30 seconds if it's today
    if (selectedDate === format(new Date(), "yyyy-MM-dd")) {
      const interval = setInterval(fetchData, 30000)
      return () => clearInterval(interval)
    }
  }, [fetchData, selectedDate])

  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const formatShortTime = (dateStr: string) => format(new Date(dateStr), "hh:mm a")

  if (isLoading && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50/50">
        <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
        <p className="text-slate-500 font-bold animate-pulse">Reconstructing Timeline...</p>
      </div>
    )
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-6 space-y-8 min-h-screen bg-transparent">
    <>
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/admin/tasks')}
          className="rounded-xl gap-2 hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-900 transition-all font-semibold text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Task Reports
        </Button>

        <div className="flex items-center gap-3 bg-white p-1 rounded-xl border border-slate-200/60 shadow-sm">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              const prev = new Date(selectedDate)
              prev.setDate(prev.getDate() - 1)
              setSearchParams({ date: format(prev, "yyyy-MM-dd") })
            }}
            className="rounded-lg h-8 px-3 text-xs font-bold"
          >
            Prev
          </Button>
          <div className="px-2 flex items-center gap-2 font-bold text-slate-700 text-sm">
            <CalendarIcon className="w-3.5 h-3.5 text-primary" />
            {format(new Date(selectedDate), "MMM dd, yyyy")}
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              const next = new Date(selectedDate)
              next.setDate(next.getDate() + 1)
              setSearchParams({ date: format(next, "yyyy-MM-dd") })
            }}
            className="rounded-lg h-8 px-3 text-xs font-bold"
            disabled={selectedDate === format(new Date(), "yyyy-MM-dd")}
          >
            Next
          </Button>
        </div>
      </div>

      {data && (
        <>
          {/* Subtle Header Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 flex items-center gap-5 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
              <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl font-bold text-slate-600 overflow-hidden shrink-0">
                {data.employee.profilePhoto ? (
                  <img src={data.employee.profilePhoto} alt={data.employee.name} className="w-full h-full object-cover" />
                ) : (
                  data.employee.name.charAt(0)
                )}
              </div>
              <div className="space-y-0.5">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{data.employee.name}</h1>
                <p className="text-slate-400 font-bold tracking-wider text-[10px] uppercase">ID: {data.employee.employeeId} • Activity Log</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-indigo-500" /> Active Hours
              </p>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">
                {formatDuration(data.summary.totalSecondsToday)}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
                <History className="w-3 h-3 text-primary" /> Snapshot
              </p>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xl font-bold text-slate-900">{data.summary.totalTasksWorked}</span>
                  <span className="text-[10px] text-slate-400 font-bold ml-1.5 uppercase">Tasks</span>
                </div>
                <div className="w-px h-4 bg-slate-200" />
                <div>
                  <span className="text-xl font-bold text-slate-900">{data.summary.totalSessions}</span>
                  <span className="text-[10px] text-slate-400 font-bold ml-1.5 uppercase">Logs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between px-2">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Work Timeline</h2>
              <span className="text-[10px] font-bold text-slate-400">{data.tasks.length} Active Work Items</span>
            </div>

            {data.tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-dashed border-slate-200">
                <Timer className="w-8 h-8 text-slate-200 mb-3" />
                <p className="text-slate-400 font-semibold text-sm">Silence is productivity. No activity for this day.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.tasks.map((task, idx) => {
                  const isActive = task.sessions.some(s => !s.endTime)
                  return (
                    <motion.div 
                      key={task._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={cn(
                        "group bg-white rounded-2xl border transition-all duration-300",
                        isActive ? "border-primary/20 shadow-md ring-1 ring-primary/5" : "border-slate-200/60 hover:border-slate-300 shadow-sm"
                      )}
                    >
                      <div className="p-5 space-y-5">
                        {/* Compact Task Header */}
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-3">
                              <Badge className={cn(
                                "rounded-md px-1.5 py-0 text-[9px] font-bold uppercase",
                                task.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100' : 
                                task.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-200'
                              )} variant="outline">
                                {task.priority}
                              </Badge>
                              {isActive && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[9px] font-bold border border-emerald-100">
                                   <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                   LIVE
                                </div>
                              )}
                            </div>
                            <h3 className="text-base font-bold text-slate-800 tracking-tight group-hover:text-primary transition-colors truncate">
                              {task.title}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTaskToEdit({
                                  ...task,
                                  totalTimeCombined: task.totalTime // The task model has the lifetime total
                                });
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-destructive hover:bg-destructive/5"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTaskToDelete(task._id);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <div className="text-lg font-bold text-slate-900 tabular-nums">
                              {formatDuration(task.taskTotalToday)}
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Logged</p>
                          </div>
                        </div>

                        {/* Session List - Very Dense */}
                        <div className="space-y-1">
                          {task.sessions.map((session) => {
                            const isRunning = !session.endTime
                            return (
                              <div 
                                key={session._id}
                                className={cn(
                                  "flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors",
                                  isRunning ? "bg-emerald-50/70" : "bg-slate-50/50 hover:bg-slate-50"
                                )}
                              >
                                <div className="flex items-center gap-4 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 font-medium">From</span>
                                    <span className="font-bold text-slate-700">{formatShortTime(session.startTime)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 font-medium">To</span>
                                    <span className={cn("font-bold", isRunning ? "text-emerald-600" : "text-slate-700")}>
                                      {isRunning ? "Running" : formatShortTime(session.endTime!)}
                                    </span>
                                  </div>
                                </div>

                                <div className={cn("font-bold tabular-nums", isRunning ? "text-emerald-700" : "text-slate-500")}>
                                  {isRunning ? <LiveTimer startTime={session.startTime} /> : formatDuration(session.duration)}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl p-6 border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Edit3 className="w-5 h-5 text-primary" /> Edit Task Information
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleUpdateTask} className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Title</label>
              <Input 
                value={taskToEdit?.title || ''} 
                onChange={e => setTaskToEdit({...taskToEdit, title: e.target.value})}
                className="rounded-xl border-slate-200 h-11"
                required
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Description</label>
              <Textarea 
                value={taskToEdit?.description || ''} 
                onChange={e => setTaskToEdit({...taskToEdit, description: e.target.value})}
                className="rounded-xl border-slate-200 min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                  <Select 
                    value={taskToEdit?.priority} 
                    onValueChange={val => setTaskToEdit({...taskToEdit, priority: val})}
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Manual Time Adjust (Seconds)</label>
                  <div className="relative">
                    <Input 
                      type="number"
                      value={taskToEdit?.totalTimeCombined || 0} 
                      onChange={e => setTaskToEdit({...taskToEdit, totalTimeCombined: Number(e.target.value)})}
                      className="rounded-xl border-slate-200 h-11 pl-10"
                    />
                    <TimerReset className="w-4 h-4 absolute left-3 top-3.5 text-slate-300" />
                  </div>
               </div>
            </div>

            <DialogFooter className="pt-4">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsEditDialogOpen(false)}
                className="rounded-xl font-bold"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isProcessing}
                className="rounded-xl font-bold bg-primary hover:bg-primary/90 px-8"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog 
        isOpen={isDeleteDialogOpen}
        onClose={() => { setIsDeleteDialogOpen(false); setTaskToDelete(null); }}
        onConfirm={handleDeleteTask}
        title="Delete Work Item?"
        message="This will permanently delete this task and all its associated work sessions. This action cannot be undone."
        confirmLabel="Destroy Task"
      />
    </>
    </div>
  )
}
