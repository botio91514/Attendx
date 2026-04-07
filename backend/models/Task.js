const mongoose = require("mongoose")

const TaskSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true 
  },
  description: { 
    type: String, 
    default: "" 
  },
  priority: { 
    type: String, 
    enum: ["low", "medium", "high"], 
    default: "medium" 
  },
  status: { 
    type: String, 
    enum: ["todo", "in-progress", "paused", "completed"], 
    default: "todo" 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  totalTime: { 
    type: Number, 
    default: 0  // total seconds, sum of all WorkSessions
  },
  date: { 
    type: String  // YYYY-MM-DD in IST — the date this task was created
  },
  completedAt: { 
    type: Date, 
    default: null 
  }
}, { timestamps: true })

module.exports = mongoose.model("Task", TaskSchema)
