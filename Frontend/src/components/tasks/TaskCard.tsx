import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Trash2, 
  Clock, 
  User as UserIcon,
  Loader2,
  Calendar
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
  const isAssignedToMe = task.assignedTo._id === currentUserId
  const isCreatedByMe = task.createdBy._id === currentUserId

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

  const getPriorityInfo = (priority: string) => {
    switch (priority) {
      case "high": return { label: "High Priority", class: "bg-destructive/10 text-destructive border-destructive/20" }
      case "medium": return { label: "Medium", class: "bg-warning/10 text-warning border-warning/20" }
      case "low": return { label: "Low", class: "bg-primary/10 text-primary border-primary/20" }
      default: return { label: priority, class: "bg-secondary text-secondary-foreground" }
    }
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "todo": 
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            To Do
          </div>
        )
      case "in-progress": 
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-success/10 text-success text-[10px] font-bold uppercase tracking-wider border border-success/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            In Progress
          </div>
        )
      case "paused": 
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-warning/10 text-warning text-[10px] font-bold uppercase tracking-wider border border-warning/20">
             <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></span>
            Paused
          </div>
        )
      case "completed": 
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-600 text-[10px] font-bold uppercase tracking-wider border border-teal-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </div>
        )
      default: return null
    }
  }

  const priority = getPriorityInfo(task.priority)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <div className={cn(
        "glass-card h-full flex flex-col p-5 overflow-hidden transition-all duration-300 border border-glass-border shadow-lg",
        isRunning && "ring-2 ring-success/20 shadow-success/10"
      )}>
        {/* Header: Priority & Status */}
        <div className="flex justify-between items-center mb-4">
          <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0 border leading-none h-5", priority.class)}>
            {priority.label}
          </Badge>
          {getStatusDisplay(task.status)}
        </div>

        {/* Title & Description */}
        <div className="flex-1 space-y-2 mb-4">
          <h3 className="text-lg font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
            {task.title}
          </h3>
          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* User Info & Meta */}
        <div className="space-y-3 mb-5 mt-auto">
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-glass-border/30">
             <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary border border-primary/20 uppercase">
                  {task.assignedTo?.name?.charAt(0) || "U"}
                </div>
                <div className="flex flex-col">
                   <span className="text-[9px] text-muted-foreground leading-none mb-0.5 uppercase tracking-tighter">Assigned To</span>
                   <span className="text-xs font-bold text-foreground leading-none">{isAssignedToMe ? "You" : task.assignedTo.name}</span>
                </div>
             </div>
             
             {!isCreatedByMe && (
               <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground border border-glass-border uppercase">
                    {task.createdBy?.name?.charAt(0) || "C"}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-muted-foreground leading-none mb-0.5 uppercase tracking-tighter">By</span>
                    <span className="text-xs font-bold text-foreground leading-none">{task.createdBy.name}</span>
                  </div>
               </div>
             )}
          </div>
        </div>

        {/* Timer Section */}
        <div className={cn(
          "flex flex-col items-center justify-center p-3 rounded-2xl mb-6 transition-all duration-500",
          isRunning ? "bg-success/5 border border-success/20" : "bg-secondary/30 border border-transparent"
        )}>
           <div className="flex items-center gap-2 mb-1">
              <Clock className={cn("w-3.5 h-3.5", isRunning ? "text-success" : "text-muted-foreground")} />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Time Spent</span>
           </div>
           
           <div className={cn(
             "font-mono text-3xl font-black tracking-tighter tabular-nums",
             isRunning ? "text-success drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]" : "text-foreground/70"
           )}>
             {displayTime}
           </div>

           {task.status === "completed" && task.completedAt && (
             <div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground font-medium bg-white/50 px-2 py-0.5 rounded-full border border-glass-border">
               <Calendar className="w-2.5 h-2.5" />
               Completed on {format(new Date(task.completedAt), "MMM d, h:mm a")}
             </div>
           )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <AnimatePresence mode="wait">
            {isAssignedToMe && task.status !== "completed" && (
              <div className="flex gap-2 w-full">
                {task.status === "todo" && (
                  <Button 
                    className="w-full bg-success text-success-foreground hover:bg-success/90 shadow-lg shadow-success/20 font-bold h-10 rounded-xl active:scale-95 transition-all"
                    onClick={(e) => { e.stopPropagation(); handleAction(startTask, "Task started successfully"); }}
                    disabled={isActing}
                  >
                    {isActing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2 fill-current" />}
                    Start Working
                  </Button>
                )}
                
                {task.status === "in-progress" && (
                  <>
                    <Button 
                      variant="outline"
                      className="flex-1 border-warning/30 text-warning hover:bg-warning/5 font-bold h-10 rounded-xl transition-all"
                      onClick={(e) => { e.stopPropagation(); handleAction(pauseTask, "Task paused"); }}
                      disabled={isActing}
                    >
                      {isActing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                      Pause
                    </Button>
                    <Button 
                      className="flex-1 bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/20 font-bold h-10 rounded-xl transition-all"
                      onClick={(e) => { e.stopPropagation(); handleAction(completeTask, "Task completed!") }}
                      disabled={isActing}
                    >
                      {isActing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Finish
                    </Button>
                  </>
                )}
                
                {task.status === "paused" && (
                  <>
                    <Button 
                      className="flex-1 bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-500/20 font-bold h-10 rounded-xl transition-all"
                      onClick={(e) => { e.stopPropagation(); handleAction(resumeTask, "Resumed working on task"); }}
                      disabled={isActing}
                    >
                      {isActing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                      Resume
                    </Button>
                    <Button 
                      className="flex-1 bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-500/20 font-bold h-10 rounded-xl transition-all"
                      onClick={(e) => { e.stopPropagation(); handleAction(completeTask, "Task completed!") }}
                      disabled={isActing}
                    >
                      {isActing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                      Finish
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
                    variant="ghost" 
                    size="icon"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-10 w-10 rounded-xl flex-shrink-0 border border-transparent hover:border-destructive/20 transition-all"
                    onClick={(e) => { e.stopPropagation(); handleAction(deleteTask, "Task deleted"); }}
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
      </div>
    </motion.div>
  )
}
