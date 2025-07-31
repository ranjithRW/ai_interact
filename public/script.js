document.addEventListener('DOMContentLoaded', () => {
    const micBtn = document.getElementById('mic-btn');
    const resetBtn = document.getElementById('reset-btn');
    const chatBox = document.getElementById('chat-box');
    const statusDiv = document.getElementById('status');

    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let conversationHistory = [];

    // Load conversation from localStorage
    const loadConversation = () => {
        const storedHistory = localStorage.getItem('conversationHistory');
        if (storedHistory) {
            conversationHistory = JSON.parse(storedHistory);
            conversationHistory.forEach(({ role, content }) => {
                addMessageToChat(content, role === 'user' ? 'user-message' : 'bot-message');
            });
        }
    };

    // Save conversation to localStorage
    const saveConversation = () => {
        localStorage.setItem('conversationHistory', JSON.stringify(conversationHistory));
    };

    const addMessageToChat = (text, className) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${className}`;
        messageDiv.textContent = text;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    };

    const handleMicClick = async () => {
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                
                mediaRecorder.ondataavailable = event => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    audioChunks = [];
                    statusDiv.textContent = 'Processing...';

                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'user_audio.webm');
                    formData.append('history', JSON.stringify(conversationHistory));

                    try {
                        const response = await fetch('/api/chat', {
                            method: 'POST',
                            body: formData,
                        });

                        if (!response.ok) {
                            throw new Error(`Server error: ${response.statusText}`);
                        }

                        const data = await response.json();
                        
                        // Add user message to UI and history
                        addMessageToChat(data.user, 'user-message');
                        conversationHistory.push({ role: 'user', content: data.user });
                        
                        // Add bot message to UI and history
                        addMessageToChat(data.bot, 'bot-message');
                        conversationHistory.push({ role: 'assistant', content: data.bot });
                        
                        saveConversation();
                        speakText(data.bot);

                    } catch (error) {
                        console.error('Error sending audio:', error);
                        statusDiv.textContent = 'Error. Click to try again.';
                    } finally {
                        statusDiv.textContent = 'Click the microphone to start talking';
                    }
                };

                mediaRecorder.start();
                isRecording = true;
                micBtn.classList.add('recording');
                statusDiv.textContent = 'Recording... Click to stop.';
            } catch (error) {
                console.error('Error accessing microphone:', error);
                statusDiv.textContent = 'Microphone access denied.';
            }
        } else {
            mediaRecorder.stop();
            isRecording = false;
            micBtn.classList.remove('recording');
            statusDiv.textContent = 'Recording stopped. Processing...';
        }
    };

    const speakText = (text) => {
        // Stop any currently speaking utterance
        window.speechSynthesis.cancel();
    
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Simple language detection for TTS - not perfect but works for many cases
        // A more robust solution might require a dedicated language detection library or API
        const langMatch = text.match(/[\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/);
        if (langMatch) {
            // This is a very basic check for non-Latin scripts. You can expand this.
            // For example, you can try to guess based on common words.
            // Let the browser auto-detect if possible. The `lang` attribute is a hint.
        }
        
        // Find a voice for the detected language if possible
        const voices = window.speechSynthesis.getVoices();
        // The voices might not be loaded initially. We listen for the event.
        window.speechSynthesis.onvoiceschanged = () => {
            // Re-run the logic once voices are loaded
        };

        utterance.onend = () => {
            statusDiv.textContent = 'Click the microphone to start talking';
        };
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event.error);
            statusDiv.textContent = 'Could not play audio. Click to talk.';
        };
        
        window.speechSynthesis.speak(utterance);
    };

    const resetConversation = () => {
        conversationHistory = [];
        localStorage.removeItem('conversationHistory');
        chatBox.innerHTML = '';
        statusDiv.textContent = 'Conversation cleared. Click to start.';
        window.speechSynthesis.cancel(); // Stop any TTS playback
    };

    micBtn.addEventListener('click', handleMicClick);
    resetBtn.addEventListener('click', resetConversation);

    // Initial load
    loadConversation();
    // Pre-load voices for TTS
    window.speechSynthesis.getVoices();
});