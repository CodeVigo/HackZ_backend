import fs from "fs";
import path from "path";
import pdf from "pdf-parse"; // pdf-parse for extracting text from the PDF
import { extractResumeData } from "../services/geminiService.js"; // Your service that calls Gemini

// Function to process the uploaded resume
export async function processResume(req, res) {
  try {
    // Get the file path from Multer
    const filePath = path.join(__dirname, "../uploads", req.file.filename);

    // Read the file and extract text using pdf-parse
    const pdfBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(pdfBuffer);

    // Extract text from the PDF
    const pdfText = pdfData.text;

    // Pass the extracted text to the Gemini model to extract resume data
    const resumeData = await extractResumeData(pdfText);

    // Delete the file after processing (optional, but recommended for cleanup)
    fs.unlinkSync(filePath);

    // Return the extracted resume data in JSON format
    return res.json(resumeData);
  } catch (error) {
    console.error("Error processing resume:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to process the resume." });
  }
}
