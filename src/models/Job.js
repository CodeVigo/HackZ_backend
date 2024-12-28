import mongoose from "mongoose";

const JobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    skillsRequired: { type: [String], required: true },
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Job = mongoose.model("Job", JobSchema);
export default Job;
