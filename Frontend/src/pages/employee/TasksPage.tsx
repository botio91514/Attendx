import React, { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  CheckCircle2,
  ListTodo,
  Users,
  Loader2,
  AlertCircle
} from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { useAuth } from "@/context/AuthContext"
import { 
  MyTasksResponse, 
  getMyTasks, 
  getEmployees, 
  createTask,
  Task,
  TaskUser
} from "@/lib/taskApi"
import { TaskCard } from "@/components/tasks/TaskCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export const TasksPage: React.FC = () => {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<MyTasksResponse | null>(null)
  const [employees, setEmployees] = useState<TaskUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeSessionMap, setActiveSessionMap] = useState<Record<string, string>>({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as "low" | "medium" | "high",
    assignedTo: user?.id || ""
  })

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await getMyTasks()
      const data: MyTasksResponse = response.data
      setTasks(data)

      // Get active sessions for in-progress tasks
      const allTasks = [...data.assignedToMe, ...data.myTasks, ...data.assignedByMe]
      const sessionMap: Record<string, string> = {}
      
      for (const task of allTasks) {
        if (task.status === "in-progress" && task.sessions) {
          const activeSession = task.sessions.find((s: any) => !s.endTime)
          if (activeSession) {
            sessionMap[task._id] = activeSession.startTime
          }
        }
      }
      setActiveSessionMap(sessionMap)
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch tasks")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await getEmployees()
      setEmployees(response.data)
    } catch (error) {
      console.error("Failed to fetch employees", error)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
    fetchEmployees()
  }, [fetchTasks, fetchEmployees])

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      toast.error("Task title is required")
      return
    }

    try {
      setIsCreating(true)
      await createTask(formData)
      toast.success("Task created successfully!")
      setShowCreateModal(false)
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        assignedTo: user?.id || ""
      })
      fetchTasks()
    } catch (error: any) {
      toast.error(error.message || "Failed to create task")
    } finally {
      setIsCreating(false)
    }
  }

  const renderTaskSection = (title: string, taskList: Task[], icon: React.ReactNode, emptyMsg: string) => (
    <div className="space-y-4 mb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold ml-1">
            {taskList.length}
          </Badge>
        </div>
      </div>
      
      {taskList.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-400">
            <ListTodo className="w-6 h-6" />
          </div>
          <p className="text-slate-500 font-medium">{emptyMsg}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {taskList.map(task => (
            <TaskCard 
              key={task._id} 
              task={task} 
              activeSessionStartTime={activeSessionMap[task._id]}
              onRefresh={fetchTasks}
              currentUserId={user?.id || ""}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 space-y-8 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all duration-300">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Task Tracker</h1>
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <CalendarIcon className="w-4 h-4" />
            <span>{format(new Date(), "EEEE, d MMMM yyyy")}</span>
          </div>
        </div>
        <Button 
          onClick={() => setShowCreateModal(true)} 
          className="bg-primary hover:bg-primary/90 text-white font-semibold py-6 px-8 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-5 h-5 mr-2" /> New Task
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 translate-y-10">
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-slate-500 font-medium animate-pulse">Loading your tasks...</p>
        </div>
      ) : tasks ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-4"
        >
          {renderTaskSection(
            "Assigned to Me", 
            tasks.assignedToMe, 
            <Users className="w-5 h-5" />, 
            "No tasks assigned to you by others yet."
          )}
          
          <Separator className="my-8 opacity-50" />
          
          {renderTaskSection(
            "My Tasks", 
            tasks.myTasks, 
            <CheckCircle2 className="w-5 h-5" />, 
            "No personal tasks created yet. Start by adding one!"
          )}
          
          <Separator className="my-8 opacity-50" />

          {renderTaskSection(
            "Assigned by Me", 
            tasks.assignedByMe, 
            <Users className="w-5 h-5" />, 
            "You haven't assigned any tasks to others."
          )}
        </motion.div>
      ) : (
        <div className="text-center py-20">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-slate-600 font-medium text-lg">Failed to load tasks. Please try again later.</p>
          <Button onClick={fetchTasks} variant="outline" className="mt-4">Retry</Button>
        </div>
      )}

      {/* Create Task Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl border-none shadow-2xl">
          <form onSubmit={handleCreateTask}>
            <div className="bg-primary/5 p-6 border-b border-slate-100">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-slate-800">Create New Task</DialogTitle>
                <DialogDescription className="text-slate-500">
                  Fill in the details below to assign a new task.
                </DialogDescription>
              </DialogHeader>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Task Title</label>
                <Input 
                  placeholder="e.g. Design UI for Task Module" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="rounded-xl border-slate-200 focus:ring-primary h-12 text-slate-800"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Description (Optional)</label>
                <Textarea 
                  placeholder="Add more details about this task..."
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="rounded-xl border-slate-200 focus:ring-primary min-h-[100px] text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Priority</label>
                  <Select 
                    value={formData.priority} 
                    onValueChange={(val: any) => setFormData({...formData, priority: val})}
                  >
                    <SelectTrigger className="rounded-xl border-slate-200 h-12">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Assign To</label>
                  <Select 
                    value={formData.assignedTo} 
                    onValueChange={val => setFormData({...formData, assignedTo: val})}
                  >
                    <SelectTrigger className="rounded-xl border-slate-200 h-12">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl max-h-[300px]">
                      <SelectItem value={user?.id || ""}>Assign to myself</SelectItem>
                      {employees.filter(emp => emp._id !== user?.id).map(emp => (
                        <SelectItem key={emp._id} value={emp._id}>
                          {emp.name} ({emp.employeeId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="p-8 bg-slate-50/80 border-t border-slate-100 mt-0">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl h-12 px-6"
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl bg-primary hover:bg-primary/90 text-white h-12 px-8 font-bold shadow-lg shadow-primary/20"
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  "Create Task"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
