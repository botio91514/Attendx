import { useState, useEffect } from "react"
import { Task } from "../lib/taskApi"

/**
 * Helper: formatSeconds(seconds: number): string
 * Converts total seconds to "HH:MM:SS" string.
 */
const formatSeconds = (seconds: number): string => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  
  return [h, m, s]
    .map(v => v.toString().padStart(2, "0"))
    .join(":")
}

export const useTaskTimer = (task: Task, activeSessionStartTime?: string) => {
  const [elapsed, setElapsed] = useState<number>(task.totalTime)
  const isRunning = task.status === "in-progress" && !!activeSessionStartTime

  useEffect(() => {
    if (!isRunning || !activeSessionStartTime) {
      setElapsed(task.totalTime)
      return
    }

    const startTime = new Date(activeSessionStartTime).getTime()
    
    const tick = () => {
      const now = Date.now()
      const diff = Math.floor((now - startTime) / 1000)
      setElapsed(task.totalTime + diff)
    }

    tick() // Initial tick
    const interval = setInterval(tick, 1000)

    return () => clearInterval(interval)
  }, [task._id, task.status, task.totalTime, activeSessionStartTime, isRunning])

  return { 
    displayTime: formatSeconds(elapsed), 
    isRunning 
  }
}
