const express = require('express');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// This line loads the .env file
dotenv.config();

// This line creates the 'app' variable
const app = express();
const port = 3000;

// Set up OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Multer setup for handling file uploads in memory
const upload = multer({ storage: multer.memoryStorage() });

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(express.json());

// API endpoint to handle chat requests (with debugging logs)
app.post('/api/chat', upload.single('audio'), async (req, res) => {
    console.log("Received a request on /api/chat");
    try {
        const audioFile = req.file;
        if (!audioFile) {
            console.error("No audio file received.");
            return res.status(400).json({ error: 'No audio file uploaded.' });
        }
        console.log("Audio file received, size:", audioFile.size);

        const conversationHistory = JSON.parse(req.body.history);
        const tempFilePath = path.join(__dirname, 'temp_audio.webm');
        fs.writeFileSync(tempFilePath, audioFile.buffer);

        // 1. Transcribe audio using Whisper
        console.log("Transcribing with Whisper...");
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: 'whisper-1',
        });
        fs.unlinkSync(tempFilePath); // Clean up
        console.log("Whisper transcription successful:", transcription.text);

        const userMessage = transcription.text;
        
        const messages = [...conversationHistory, { role: 'user', content: userMessage }];

        // 2. Get AI response from Chat API
        console.log("Sending transcription to GPT...");
        const chatCompletion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful multilingual assistant. The user is speaking to you. Respond in the same language as the user's last message. Be concise and natural, like in a real conversation.`
                },
                ...messages
            ],
        });

        const aiResponse = chatCompletion.choices[0].message.content;
        console.log("Received response from GPT:", aiResponse);

        // 3. Send final response to client
        res.json({ 
            user: userMessage, 
            bot: aiResponse 
        });

    } catch (error) {
        // This will catch errors from OpenAI, filesystem, etc.
        console.error('!!! --- ERROR IN CHAT API --- !!!');
        console.error(error); // Log the full error object
        res.status(500).json({ error: 'An error occurred during the chat process.' });
    }
});

// This line starts the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});