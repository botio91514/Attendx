const mongoose = require("mongoose")

const WorkSessionSchema = new mongoose.Schema({
  taskId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Task", 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  startTime: { 
    type: Date, 
    required: true 
  },
  endTime: { 
    type: Date, 
    default: null   // null means this session is currently RUNNING
  },
  duration: { 
    type: Number, 
    default: 0      // seconds, calculated when session ends
  }
}, { timestamps: true })

module.exports = mongoose.model("WorkSession", WorkSessionSchema)
