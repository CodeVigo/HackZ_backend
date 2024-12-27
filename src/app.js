import express from "express";
import multer from "multer";
import * as pdfjsLib from "pdfjs-dist";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";
import fs, { stat } from "fs";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

// Initialize Express App
const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(
  cors({
    origin: "*",
  })
);

// Initialize Multer for handling file uploads
const upload = multer({ dest: "/home/iamrpm/Documents/my-backend/uploads" });

// Initialize Google Generative AI Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Middleware to parse incoming JSON requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Function to get __dirname in ES Modules
const getDirname = (url) => {
  return path.dirname(new URL(url).pathname);
};

// Controller function to process the uploaded resume
async function processResume(req, res) {
  try {
    console.log("reached here");
    console.log(req.file);

    // Check if a file is uploaded
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    // Path to the uploaded file using getDirname
    const filePath = path.join(req.file.path);

    // Ensure the file exists before reading it
    if (!fs.existsSync(filePath)) {
      console.log("File not found.");
      console.log(filePath);
      return res.status(404).send("Uploaded file not found.");
    }

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

    // res.status(200).json(parsedResult);

    return res.status(200).json({
      success: true,
      message: "Resume processed successfully.",
      data: parsedResult,
    });

    // Optionally, delete the uploaded file after processing
  } catch (error) {
    console.error("Error processing the resume:", error);
    res.status(500).send("An error occurred while processing the resume.");
  } finally {
    fs.unlinkSync(req.file.path);
  }
}

// Route to upload the PDF and process it
app.post("/upload", upload.single("resume"), processResume);

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
