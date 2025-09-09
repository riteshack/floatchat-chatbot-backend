// Chat functionality
let isLoading = false;

// DOM elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const loadingOverlay = document.getElementById('loadingOverlay');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// Initialize the chat
document.addEventListener('DOMContentLoaded', function () {
    // Focus on input
    messageInput.focus();

    // Add event listeners
    messageInput.addEventListener('keypress', handleKeyPress);
    messageInput.addEventListener('input', handleInputChange);

    // Check API health
    checkAPIHealth();

    // Auto-resize input
    messageInput.addEventListener('input', autoResizeInput);
});

// Handle enter key press
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Handle input changes
function handleInputChange() {
    const hasText = messageInput.value.trim().length > 0;
    sendButton.disabled = !hasText || isLoading;
}

// Auto resize input
function autoResizeInput() {
    const input = messageInput;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
}

// Send message function
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isLoading) return;

    // Add user message to chat
    addMessage(message, 'user');

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    handleInputChange();

    // Show loading state
    setLoadingState(true);

    try {
        // Send request to API
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: message })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            addMessage(data.response, 'bot');
        } else {
            addMessage('I apologize, but I encountered an error while processing your request. Please try again.', 'bot', true);
        }

    } catch (error) {
        console.error('Error sending message:', error);
        addMessage('I\'m having trouble connecting to the server. Please check your connection and try again.', 'bot', true);
        updateConnectionStatus(false);
    } finally {
        setLoadingState(false);
    }
}

// Send quick message
function sendQuickMessage(message) {
    messageInput.value = message;
    sendMessage();
}

// Add message to chat
function addMessage(text, sender, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = sender === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';

    if (isError) {
        textDiv.style.background = '#f8d7da';
        textDiv.style.color = '#721c24';
        textDiv.style.border = '1px solid #f5c6cb';
    }

    // Format the message text
    textDiv.innerHTML = formatMessage(text);

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    contentDiv.appendChild(textDiv);
    contentDiv.appendChild(timeDiv);

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);

    chatMessages.appendChild(messageDiv);

    // Scroll to bottom
    scrollToBottom();
}

// Format message text (basic markdown-like formatting)
function formatMessage(text) {
    // Convert line breaks to <br>
    text = text.replace(/\n/g, '<br>');

    // Convert **bold** to <strong>
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert *italic* to <em>
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Convert `code` to <code>
    text = text.replace(/`(.*?)`/g, '<code style="background: #f1f3f4; padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>');

    // Convert numbers that look like data values
    text = text.replace(/(\d+\.?\d*)\s*(°C|PSU|decibar|meters?|m)/gi, '<span style="font-weight: 600; color: #0066cc;">$1 $2</span>');

    return text;
}

// Scroll to bottom of chat
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Set loading state
function setLoadingState(loading) {
    isLoading = loading;

    if (loading) {
        loadingOverlay.style.display = 'flex';
        sendButton.disabled = true;
        messageInput.disabled = true;
    } else {
        loadingOverlay.style.display = 'none';
        sendButton.disabled = false;
        messageInput.disabled = false;
        messageInput.focus();
    }

    handleInputChange();
}

// Clear chat
function clearChat() {
    if (confirm('Are you sure you want to clear the chat history?')) {
        // Keep only the welcome message
        const welcomeMessage = chatMessages.querySelector('.message.bot-message');
        chatMessages.innerHTML = '';
        if (welcomeMessage) {
            chatMessages.appendChild(welcomeMessage.cloneNode(true));
        }
        messageInput.focus();
    }
}

// Check API health
async function checkAPIHealth() {
    try {
        const response = await fetch('/api/health');
        if (response.ok) {
            updateConnectionStatus(true);
        } else {
            updateConnectionStatus(false);
        }
    } catch (error) {
        console.error('Health check failed:', error);
        updateConnectionStatus(false);
    }
}

// Update connection status
function updateConnectionStatus(isOnline) {
    if (isOnline) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Online';
    } else {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Offline';
    }
}

// Periodic health check
setInterval(checkAPIHealth, 30000); // Check every 30 seconds

// Handle window visibility change to reconnect when tab becomes active
document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
        checkAPIHealth();
    }
});

// Copy message functionality (right-click context menu)
chatMessages.addEventListener('contextmenu', function (e) {
    const messageText = e.target.closest('.message-text');
    if (messageText) {
        e.preventDefault();

        // Create a temporary textarea to copy text
        const textArea = document.createElement('textarea');
        textArea.value = messageText.textContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        // Show feedback
        const originalText = messageText.innerHTML;
        messageText.style.background = '#d4edda';
        messageText.innerHTML = '<i class="fas fa-check"></i> Copied to clipboard!';

        setTimeout(() => {
            messageText.style.background = '';
            messageText.innerHTML = originalText;
        }, 1000);
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
    // Ctrl/Cmd + L to clear chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        clearChat();
    }

    // Escape to focus input
    if (e.key === 'Escape') {
        messageInput.focus();
    }
});

// Handle paste events for better UX
messageInput.addEventListener('paste', function (e) {
    // Allow paste but trim whitespace
    setTimeout(() => {
        messageInput.value = messageInput.value.trim();
        autoResizeInput();
        handleInputChange();
    }, 0);
});

// Export functions for global access
window.sendMessage = sendMessage;
window.sendQuickMessage = sendQuickMessage;
window.clearChat = clearChat;
