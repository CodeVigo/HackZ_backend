const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access your API key as an environment variable
const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Function to clean and preprocess the PDF text
function cleanPdfText(pdfText) {
  // Perform any text cleanup or preprocessing if needed
  // For example, removing unnecessary newlines, extra spaces, etc.
  return pdfText.replace(/\s+/g, " ").trim();
}

export async function extractResumeData(pdfText) {
  try {
    // Clean the PDF text
    const cleanedText = cleanPdfText(pdfText);

    // Create a detailed prompt for the AI
    const prompt = `Below is the text extracted from a resume. Please extract the following details and format them in JSON: 
    Name, Email, Phone Number, Skills, Work Experience, Education, Projects, Certifications, etc. 
    
    Resume Text: 
    ${cleanedText}`;

    // Send the prompt to Gemini to process
    const result = await model.generateContent({ prompt });

    // Log result for debugging
    console.log("Gemini AI response:", result);

    // Check if result is valid and parse it into JSON
    if (result && result.trim()) {
      try {
        const parsedResult = JSON.parse(result); // Parsing the result into a JSON object
        return parsedResult; // Return the extracted data
      } catch (jsonError) {
        console.error("Error parsing JSON:", jsonError);
        return { success: false, message: "Failed to parse AI response." };
      }
    } else {
      console.error("Empty or invalid AI response.");
      return { success: false, message: "Invalid or empty response from AI." };
    }
  } catch (error) {
    // Catch any errors that occur during the process
    console.error("Error extracting resume data:", error);
    return { success: false, message: "Failed to extract resume data." };
  }
}
