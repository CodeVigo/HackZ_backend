import express from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import Job from "../models/Job.js";

const router = express.Router();

// Get all jobs created by the recruiter
router.get("/", authenticateToken, async (req, res) => {
  if (req.user.role !== "recruiter") {
    return res
      .status(403)
      .json({ message: "Access denied. Only recruiters can view jobs." });
  }

  try {
    const jobs = await Job.find({ recruiter: req.user.id });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve jobs.", error });
  }
});

// Get all jobs for candidates
router.get("/all", async (req, res) => {
  try {
    const jobs = await Job.find().populate("recruiter", "fullName email");
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve jobs.", error });
  }
});

// Create a new job
router.post("/", authenticateToken, async (req, res) => {
  if (req.user.role !== "recruiter") {
    return res
      .status(403)
      .json({ message: "Access denied. Only recruiters can create jobs." });
  }

  const { title, description, skillsRequired } = req.body;

  try {
    const newJob = await Job.create({
      title,
      description,
      skillsRequired,
      recruiter: req.user.id,
    });

    res.status(201).json({ message: "Job created successfully.", job: newJob });
  } catch (error) {
    res.status(500).json({ message: "Failed to create job.", error });
  }
});

export default router;
