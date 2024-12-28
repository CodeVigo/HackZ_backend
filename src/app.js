import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import * as pdfjsLib from "pdfjs-dist";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import path from "path";
import User from "./models/User.js";
import jobRoutes from "./routes/jobs.js";



dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Helper Function to Generate JWT
function generateToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );
}

// Middleware to Verify JWT
export function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  console.log(token);
  if (!token)
    return res
      .status(401)
      .json({ message: "Access denied. No token provided." });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err)
      return res.status(403).json({ message: "Invalid or expired token." });
    req.user = user;
    next();
  });
}

// Multer Configuration for File Uploads
const upload = multer({ dest: "uploads/" });

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ---------------- AUTHENTICATION ROUTES ---------------- //

// User Registration
app.post("/auth/register", async (req, res) => {

  console.log("reached register");

  const { email, password, fullName, role } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      email,
      password: hashedPassword,
      fullName,
      role,
    });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully." });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Server error", error });
  }
});

// User Login
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password." });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return res.status(400).json({ message: "Invalid email or password." });

    const token = generateToken(user);
    res.json({
      message: "Login successful.",
      token,
      user: { id: user._id, fullName: user.fullName, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Get User Profile
app.get("/auth/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found." });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Add the Job routes
app.use("/jobs", jobRoutes);

// ---------------- RESUME PROCESSING ROUTES ---------------- //

// Process Resume
app.post(
  "/upload",
  authenticateToken,
  upload.single("resume"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).send("No file uploaded.");

      const filePath = path.join(req.file.path);
      if (!fs.existsSync(filePath))
        return res.status(404).send("Uploaded file not found.");

      // Read the PDF file
      const data = await fs.promises.readFile(filePath);

      // Convert Buffer to Uint8Array
      const uint8ArrayData = new Uint8Array(data);

      // Extract text using pdf.js
      const pdfDocument = await pdfjsLib.getDocument(uint8ArrayData).promise;
      const numPages = pdfDocument.numPages;
      let pdfText = "";
      let links = [];

      // Extract text and links from each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        pdfText += pageText + "\n";

        // Extract links (URLs) from annotations
        const annotations = await page.getAnnotations();
        annotations.forEach((annotation) => {
          if (annotation.url) {
            links.push(annotation.url);
          }
        });
      }

      // Log the extracted text and links
      console.log("Extracted PDF Text:", pdfText);
      console.log("Extracted Links:", links);

      // Send the extracted text and links to Gemini AI for processing
      const prompt = `
      Hey, this is the text extracted from a resume. Please extract relevant information such as name, email, phone number, skills, work experience, education, projects, certifications, etc.
      Also, extract any URLs found in the resume and include them in the response.
      Please format the response in the following JSON format:

      {"name": "<name>","email": "<email>","phone": "<phone>","skills":["<skill1>", "<skill2>", ...],"education": [{"institution":institution_name>","degree": "<degree>","startDate":"<start_date>","endDate": "<end_date>"},...],"workExperience": [{"company": "<company_name>","role": "<role>","startDate": "<start_date>","endDate": "<end_date>","description": "<description>"},...],"projects": [{"title": "<project_title>","description": "<project_description>","links": ["<url1>", "<url2>", ...]},...],"certifications": ["<certification1>", "<certification2>", ...],"links":["<url1>", "<url2>", ...]}

      Here is the extracted text:
      ${pdfText}
      Additionally, here are the extracted links (URLs) found in the resume:
      ${links.join("\n")}
      Please provide the response strictly in the above JSON format without any additional explanation or text.
      and if you didnt get any of the specified info then in that case just return an " not found " string and also in the resposnse can you not write "\\n" and "\\" like this and then in links if you find any links like if they are of linked in then write it in a new key like "linkedIn" and the value will be the link and simillarly for codechef leetcode github  iff not found then return "not found" ...
      `;

      console.log(prompt);

      const result = await model.generateContent(prompt);

      console.log("Gemini AI response:", result);
      // Parse the result and send it as JSON response

      let jsonText = result.response.candidates[0].content.parts[0].text;

      let cleanJsonText = jsonText
        .replace(/^```json\n/, "")
        .replace(/```/, "")
        .replace(/\n```$/, "")
        .replace(/\n/g, "")
        .replace(/\\n/g, "\n")
        .trim();

      // res.json(JSON.parse(cleanJsonText));

      const parsedResult = JSON.parse(cleanJsonText);

      res.status(200).json({
        success: true,
        message: "Resume processed successfully.",
        data: parsedResult,
      });
      fs.unlinkSync(req.file.path); // Clean up uploaded file
    } catch (error) {
      console.error("Error processing resume:", error);
      res.status(500).send("An error occurred while processing the resume.");
    }
  }
);

app.get("/", (req, res) => {
  res.send("Hello from the backend!");
});

// ---------------- SERVER START ---------------- //
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
