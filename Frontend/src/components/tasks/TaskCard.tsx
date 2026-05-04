import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Play,
  Pause,
  CheckCircle2,
  Trash2,
  Clock,
  User as UserIcon,
  AlertCircle,
  Loader2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  Task,
  startTask,
  pauseTask,
  resumeTask,
  completeTask,
  deleteTask
} from "@/lib/taskApi"
import { useTaskTimer } from "@/hooks/useTaskTimer"
import { cn } from "@/lib/utils"
import { formatISTTime } from "@/utils/dateUtils"

interface TaskCardProps {
  task: Task
  activeSessionStartTime?: string
  onRefresh: () => void
  currentUserId: string
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  activeSessionStartTime,
  onRefresh,
  currentUserId
}) => {
  const [isActing, setIsActing] = useState(false)
  const { displayTime, isRunning } = useTaskTimer(task, activeSessionStartTime)
  const isAssignedToMe = task.assignedTo?._id === currentUserId
  const isCreatedByMe = task.createdBy?._id === currentUserId

  const handleAction = async (actionFn: (id: string) => Promise<any>, successMsg: string) => {
    try {
      setIsActing(true)
      await actionFn(task._id)
      toast.success(successMsg)
      onRefresh()
    } catch (error: any) {
      toast.error(error.message || "Action failed")
    } finally {
      setIsActing(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
      case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
      case "low": return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
      default: return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "todo":
        return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">To Do</Badge>
      case "in-progress":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            In Progress
          </Badge>
        )
      case "paused":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Paused</Badge>
      case "completed":
        return <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">Completed</Badge>
      default: return null
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full">
        <CardHeader className="pb-3 space-y-1">
          <div className="flex justify-between items-start gap-4">
            <CardTitle className="text-base font-semibold leading-tight text-slate-800 group-hover:text-primary transition-colors">
              {task.title}
            </CardTitle>
            <Badge variant="outline" className={cn("capitalize font-semibold", getPriorityColor(task.priority))}>
              {task.priority}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {getStatusBadge(task.status)}
            {!isAssignedToMe && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <UserIcon className="w-3 h-3" /> Assigned to: {task.assignedTo?.name || "Unknown"}
              </span>
            )}
            {!isCreatedByMe && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <UserIcon className="w-3 h-3" /> Assigned by: {task.createdBy?.name || "Unknown"}
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          {task.description && (
            <p className="text-sm text-slate-600 line-clamp-2 mb-3 leading-relaxed">
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <Clock className={cn("w-4 h-4", isRunning ? "text-emerald-500" : "text-slate-400")} />
            <span className={cn(
              "font-mono text-lg font-bold tracking-wider",
              isRunning ? "text-emerald-600 animate-pulse" : "text-slate-600"
            )}>
              {displayTime}
            </span>
            {task.status === "completed" && task.completedAt && (
              <span className="ml-auto text-[10px] text-slate-400 font-medium">
                Done: {formatISTTime(task.completedAt)}
              </span>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-0 flex justify-between gap-2 border-t border-slate-50 mt-auto bg-slate-50/50 p-4">
          <div className="flex gap-2 w-full">
            <AnimatePresence mode="wait">
              {isAssignedToMe && task.status !== "completed" && (
                <div className="flex gap-2 w-full">
                  {task.status === "todo" && (
                    <Button
                      size="sm"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      onClick={() => handleAction(startTask, "Task started successfully")}
                      disabled={isActing}
                    >
                      {isActing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                      Start Working
                    </Button>
                  )}
                  {task.status === "in-progress" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
                        onClick={() => handleAction(pauseTask, "Task paused")}
                        disabled={isActing}
                      >
                        {isActing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                        Pause
                      </Button>
                      <Button
                        size="sm"
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                        onClick={() => handleAction(completeTask, "Task completed!")}
                        disabled={isActing}
                      >
                        {isActing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Complete
                      </Button>
                    </>
                  )}
                  {task.status === "paused" && (
                    <>
                      <Button
                        size="sm"
                        className="w-full bg-sky-600 hover:bg-sky-700 text-white"
                        onClick={() => handleAction(resumeTask, "Resumed working on task")}
                        disabled={isActing}
                      >
                        {isActing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        Resume
                      </Button>
                      <Button
                        size="sm"
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                        onClick={() => handleAction(completeTask, "Task completed!")}
                        disabled={isActing}
                      >
                        {isActing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Complete
                      </Button>
                    </>
                  )}
                </div>
              )}
            </AnimatePresence>

            {isCreatedByMe && task.status === "todo" && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                      onClick={() => handleAction(deleteTask, "Task deleted")}
                      disabled={isActing}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Task</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
