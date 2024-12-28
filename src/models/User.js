import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["candidate", "recruiter"], required: true },
    resume: {
      type: Object,
      default: null, // Stores processed resume data
    },
    appliedJobs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job",
      },
    ], // Array of job IDs the candidate has applied for
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);
export default User;
