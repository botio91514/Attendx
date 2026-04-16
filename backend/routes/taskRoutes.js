const express = require("express")
const router = express.Router()
const { protect } = require("../middleware/authMiddleware")
const { isAdmin } = require("../middleware/isAdmin")
const { validateObjectId } = require("../middleware/validateObjectId")
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
  getEmployees,
  getEmployeeActivity,
  updateTask
} = require("../controllers/taskController")

router.post("/",                          protect, createTask)
router.get("/my",                         protect, getMyTasks)
router.get("/employees",                  protect, getEmployees)
router.get("/admin/all",                  protect, isAdmin, getAllTasksAdmin)
router.get("/admin/report/:userId",       protect, isAdmin, getEmployeeTaskReport)
router.post("/:id/start",                 protect, validateObjectId, startTask)
router.post("/:id/pause",                 protect, validateObjectId, pauseTask)
router.post("/:id/resume",               protect, validateObjectId, resumeTask)
router.post("/:id/complete",              protect, validateObjectId, completeTask)
router.get("/admin/employee/:employeeId/activity", protect, isAdmin, getEmployeeActivity)
router.put("/:id",                        protect, validateObjectId, updateTask)
router.delete("/:id",                     protect, validateObjectId, deleteTask)

module.exports = router
