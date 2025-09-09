# Install these if not already installed:
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

import os
import uvicorn

# Load environment variables from .env file
load_dotenv()

from langchain_community.agent_toolkits import create_sql_agent
from langchain_community.utilities import SQLDatabase
from langchain_google_genai import ChatGoogleGenerativeAI
from sqlalchemy import create_engine

# Initialize FastAPI app
app = FastAPI(title="Ocean Data Chatbot API", description="AI-powered chatbot for querying ocean data")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Set up the database connection
db_url = os.getenv("DATABASE")
engine = create_engine(db_url)

# Wrap the connection with LangChain's SQLDatabase utility
db = SQLDatabase(engine)

# Define the LLM (Gemini)
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro",
    temperature=0,
    google_api_key=os.getenv("GOOGLE_API_KEY"),
)

complete_system_prompt = """
You are an expert oceanographer and data analyst specializing in Argo float data. You have access to a PostgreSQL database containing ocean measurements.

Database Schema Information:
- psal (psu): Practical salinity.
- cyc: The float cycle number. A value of 0 is the launch cycle, and 1 is the first complete cycle.
- pres (decibar): Sea water pressure. This value is 0 at sea level.
- temp (degree_Celsius): Sea temperature on the ITS-90 scale.

Please provide helpful, accurate, and informative responses about ocean data. When querying the database.
"""

# Create the agent
agent_executor = create_sql_agent(
    llm=llm,
    db=db,
    agent_type="tool-calling",
    verbose=True,
    prefix=complete_system_prompt 
)

# Pydantic models for request/response
class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    success: bool
    error: str = None

# API Routes
@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Serve the main HTML page"""
    with open("static/index.html", "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content, status_code=200)

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """Process chat messages and return AI responses"""
    try:
        # Process the message through the agent
        response = agent_executor.invoke({"input": request.message})
        
        # Extract the output from the response
        if isinstance(response, dict) and 'output' in response:
            ai_response = response['output']
        else:
            ai_response = str(response)
        
        return ChatResponse(
            response=ai_response,
            success=True
        )
    
    except Exception as e:
        print(f"Error processing chat request: {str(e)}")
        return ChatResponse(
            response="I'm sorry, I encountered an error while processing your request. Please try again.",
            success=False,
            error=str(e)
        )

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Ocean Data Chatbot API is running"}

if __name__ == "__main__":
    print("Starting Ocean Data Chatbot API...")
    print("Visit http://localhost:8080 to access the chatbot interface")
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=False)
