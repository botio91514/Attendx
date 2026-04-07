const express = require("express")
const router = express.Router()
const { protect } = require("../middleware/authMiddleware")
const { isAdmin } = require("../middleware/isAdmin")
const {
  createTask,
  getMyTasks,
  startTask,
  pauseTask,
  resumeTask,
  completeTask,
  deleteTask,
  getAllTasksAdmin,
  getEmployeeTaskReport,
  getEmployees
} = require("../controllers/taskController")

router.post("/",                          protect, createTask)
router.get("/my",                         protect, getMyTasks)
router.get("/employees",                  protect, getEmployees)
router.get("/admin/all",                  protect, isAdmin, getAllTasksAdmin)
router.get("/admin/report/:userId",       protect, isAdmin, getEmployeeTaskReport)
router.post("/:id/start",                 protect, startTask)
router.post("/:id/pause",                 protect, pauseTask)
router.post("/:id/resume",               protect, resumeTask)
router.post("/:id/complete",              protect, completeTask)
router.delete("/:id",                     protect, deleteTask)

module.exports = router
