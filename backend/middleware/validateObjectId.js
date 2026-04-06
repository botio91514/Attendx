const mongoose = require('mongoose');

const validateObjectId = (req, res, next) => {
  const { id } = req.params;
  
  if (!id) return next();
  
  // Check if valid MongoDB ObjectId (24 hex chars)
  if (!mongoose.Types.ObjectId.isValid(id) || 
      id.length !== 24 || 
      !/^[a-fA-F0-9]{24}$/.test(id)) {
    // Return 200 silently — never crash on bad ID
    return res.status(200).json({
      success: true,
      message: 'Skipped — invalid notification ID'
    });
  }
  next();
};

module.exports = { validateObjectId };
