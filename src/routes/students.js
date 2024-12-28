import express from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import User from "../models/User.js";

const router = express.Router();

// Get all students (for recruiters)
// routes/students.js
router.get("/", authenticateToken, async (req, res) => {
  if (req.user.role !== "recruiter") {
    return res.status(403).json({ message: "Access denied." });
  }

  try {
    const students = await User.find({ role: "candidate" }).select(
      "fullName email resume"
    );
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve students.", error });
  }
});


export default router;
