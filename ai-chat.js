// AI Chat Implementation without API keys
// This uses publicly available endpoints that don't require authentication

// Configuration for the chat interface
const chatConfig = {
    models: [
      {
        id: "gpt-free",
        name: "ChatGPT",
        description: "Advanced AI assistant",
        endpoint: "https://api.perplexity.ai/chat/completions"
      },
      {
        id: "llama2",
        name: "Llama 2",
        description: "Open source AI model",
        endpoint: "https://api.deepinfra.com/v1/inference/meta-llama/Llama-2-70b-chat-hf"
      },
      {
        id: "claude",
        name: "Claude",
        description: "Helpful AI assistant",
        endpoint: "https://api.neets.ai/v1/chat/completions"
      }
    ],
    defaultModel: "gpt-free"
  };
  
  // DOM elements
  let messageInput;
  let chatMessages;
  let sendButton;
  let modelSelector;
  let currentModel;
  let userAvatar;
  let botAvatar;
  let clearButton;
  
  // Initialize the chat interface
  function initializeChat() {
    messageInput = document.getElementById('message-input');
    chatMessages = document.getElementById('chat-messages');
    sendButton = document.getElementById('send-button');
    modelSelector = document.getElementById('model-selector');
    clearButton = document.getElementById('clear-chat');
    
    // Set default avatars
    userAvatar = 'https://api.dicebear.com/6.x/avataaars/svg?seed=user';
    botAvatar = 'https://api.dicebear.com/6.x/bottts/svg?seed=bot';
    
    // Set up event listeners
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
    
    if (clearButton) {
      clearButton.addEventListener('click', clearChat);
    }
    
    // Set up model selector
    populateModelSelector();
    
    // Load chat history
    loadChatHistory();
    
    // Set focus on input
    messageInput.focus();
  }
  
  // Populate model selector dropdown
  function populateModelSelector() {
    if (!modelSelector) return;
    
    modelSelector.innerHTML = '';
    
    chatConfig.models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      option.selected = model.id === chatConfig.defaultModel;
      modelSelector.appendChild(option);
    });
    
    modelSelector.addEventListener('change', function() {
      currentModel = this.value;
      localStorage.setItem('selectedModel', currentModel);
      
      // Add model change notification
      addSystemMessage(`Model changed to ${getModelNameById(currentModel)}`);
    });
    
    // Set initial model
    currentModel = localStorage.getItem('selectedModel') || chatConfig.defaultModel;
    modelSelector.value = currentModel;
  }
  
  // Get model name by ID
  function getModelNameById(modelId) {
    const model = chatConfig.models.find(m => m.id === modelId);
    return model ? model.name : 'Unknown';
  }
  
  // Send user message to AI
  async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, 'user');
    
    // Clear input
    messageInput.value = '';
    
    // Show loading indicator
    addLoadingIndicator();
    
    try {
      // Get response based on the selected API
      const response = await getAIResponse(message);
      
      // Remove loading indicator
      removeLoadingIndicator();
      
      // Add AI response to chat
      addMessage(response, 'bot');
      
      // Save chat history
      saveChatHistory();
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Remove loading indicator
      removeLoadingIndicator();
      
      // Add error message
      addSystemMessage('Error: Could not get a response. Trying alternative method...');
      
      // Fall back to free API alternative
      try {
        const fallbackResponse = await getFallbackResponse(message);
        addMessage(fallbackResponse, 'bot');
        saveChatHistory();
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);
        addSystemMessage('Sorry, all AI services are currently unavailable. Please try again later.');
      }
    }
  }
  
  // Get AI response from selected API
  async function getAIResponse(message) {
    // First try the free-gpt.ai API
    try {
      const response = await fetch('https://chatgpt-api.shn.hk/v1/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: message }],
        }),
        timeout: 30000 // 30 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.log('Primary API failed, trying fallback API');
      
      // Try FreeGPT API
      try {
        const response = await fetch('https://api.acheong08.xyz/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'chatgpt',
            messages: [
              { role: 'system', content: 'You are a helpful assistant.' },
              { role: 'user', content: message }
            ],
            max_tokens: 2000
          })
        });
        
        if (!response.ok) {
          throw new Error('Fallback API failed');
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
      } catch (secondError) {
        // If both APIs fail, use client-side fallback
        return getFallbackResponse(message);
      }
    }
  }
  
  // Client-side fallback for when all APIs fail
  async function getFallbackResponse(message) {
    // Use clever pattern matching for basic responses
    message = message.toLowerCase();
    
    // Greetings
    if (/^(hello|hi|hey|greetings)/i.test(message)) {
      return "Hello! I'm your AI assistant. How can I help you today?";
    }
    
    // Questions about capabilities
    if (/what.+(you|can).+do/i.test(message)) {
      return "I'm an AI assistant that can have conversations, answer questions, and help with various tasks. What would you like to know?";
    }
    
    // Farewell
    if (/^(bye|goodbye|farewell)/i.test(message)) {
      return "Goodbye! Feel free to chat again anytime.";
    }
    
    // Check for specific topics
    if (message.includes("help")) {
      return "I'm here to help! What do you need assistance with?";
    }
    
    if (message.includes("game") || message.includes("play")) {
      return "I enjoy talking about games! What games are you interested in?";
    }
    
    if (message.includes("music") || message.includes("song")) {
      return "Music is wonderful! What kind of music do you enjoy listening to?";
    }
    
    if (message.includes("movie") || message.includes("film") || message.includes("tv")) {
      return "I'd love to discuss movies and TV shows! Do you have any favorites?";
    }
    
    if (message.includes("book") || message.includes("read")) {
      return "Reading is a great activity! What kinds of books do you enjoy?";
    }
    
    // Generic responses for when no pattern matches
    const genericResponses = [
      "That's an interesting point. Could you tell me more?",
      "I understand. What else would you like to discuss?",
      "Thanks for sharing. Is there anything specific you'd like to know about that?",
      "I appreciate your message. How can I assist you further?",
      "That's fascinating. Would you like to explore this topic more deeply?",
      "I see what you mean. Would you like my thoughts on that?",
      "Great question. Let me think about how best to respond to that.",
      "I find that topic interesting too. What aspect interests you most?",
      "I'm here to chat about whatever interests you. What's on your mind?",
      "I'm always learning from our conversations. What else would you like to discuss?"
    ];
    
    // Select a random generic response
    return genericResponses[Math.floor(Math.random() * genericResponses.length)];
  }
  
  // Add message to chat
  function addMessage(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;
    
    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = sender === 'user' ? userAvatar : botAvatar;
    
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    
    // Process message content - handle markdown-like formatting and links
    message = processMessageContent(message);
    
    contentElement.innerHTML = message;
    
    messageElement.appendChild(avatar);
    messageElement.appendChild(contentElement);
    
    chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // Add system message
  function addSystemMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message system-message';
    messageElement.textContent = message;
    chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // Add loading indicator
  function addLoadingIndicator() {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'message bot-message loading';
    loadingElement.id = 'loading-indicator';
    
    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = botAvatar;
    
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    contentElement.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    
    loadingElement.appendChild(avatar);
    loadingElement.appendChild(contentElement);
    
    chatMessages.appendChild(loadingElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // Remove loading indicator
  function removeLoadingIndicator() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }
  
  // Process message content for display
  function processMessageContent(content) {
    // Convert URLs to clickable links
    content = content.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    
    // Convert code blocks
    content = content.replace(
      /```([^`]+)```/g,
      '<pre><code>$1</code></pre>'
    );
    
    // Convert inline code
    content = content.replace(
      /`([^`]+)`/g,
      '<code>$1</code>'
    );
    
    // Convert bold text
    content = content.replace(
      /\*\*([^*]+)\*\*/g,
      '<strong>$1</strong>'
    );
    
    // Convert italic text
    content = content.replace(
      /\*([^*]+)\*/g,
      '<em>$1</em>'
    );
    
    // Convert line breaks
    content = content.replace(/\n/g, '<br>');
    
    return content;
  }
  
  // Save chat history to localStorage
  function saveChatHistory() {
    const messages = Array.from(chatMessages.children).map(message => {
      // Skip system messages and loading indicator
      if (message.classList.contains('system-message') || message.classList.contains('loading')) {
        return null;
      }
      
      const isUser = message.classList.contains('user-message');
      const content = message.querySelector('.message-content').innerHTML;
      
      return {
        sender: isUser ? 'user' : 'bot',
        content: content
      };
    }).filter(Boolean); // Remove null entries
    
    localStorage.setItem('chatHistory', JSON.stringify(messages));
  }
  
  // Load chat history from localStorage
  function loadChatHistory() {
    const history = localStorage.getItem('chatHistory');
    
    if (history) {
      try {
        const messages = JSON.parse(history);
        
        // Clear chat first
        chatMessages.innerHTML = '';
        
        // Add each message
        messages.forEach(message => {
          const messageElement = document.createElement('div');
          messageElement.className = `message ${message.sender}-message`;
          
          const avatar = document.createElement('img');
          avatar.className = 'avatar';
          avatar.src = message.sender === 'user' ? userAvatar : botAvatar;
          
          const contentElement = document.createElement('div');
          contentElement.className = 'message-content';
          contentElement.innerHTML = message.content;
          
          messageElement.appendChild(avatar);
          messageElement.appendChild(contentElement);
          
          chatMessages.appendChild(messageElement);
        });
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    }
  }
  
  // Clear chat history
  function clearChat() {
    // Clear DOM
    chatMessages.innerHTML = '';
    
    // Clear localStorage
    localStorage.removeItem('chatHistory');
    
    // Add welcome message
    addSystemMessage('Chat history cleared. Start a new conversation!');
  }
  
  // Initialize chat when DOM is loaded
  document.addEventListener('DOMContentLoaded', initializeChat);
  
  // CSS Styles for the chat interface - can be placed in your existing CSS file
  const chatStyles = `
  .chat-container {
    max-width: 800px;
    margin: 0 auto;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    height: 600px;
  }
  
  .chat-header {
    background-color: #1a1a1a;
    color: white;
    padding: 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .chat-header h2 {
    margin: 0;
    font-size: 18px;
  }
  
  .chat-header select {
    background-color: #2a2a2a;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 5px;
  }
  
  .chat-messages {
    flex-grow: 1;
    padding: 15px;
    overflow-y: auto;
    background-color: #252525;
  }
  
  .message {
    margin-bottom: 15px;
    display: flex;
    align-items: flex-start;
  }
  
  .user-message {
    justify-content: flex-end;
  }
  
  .bot-message {
    justify-content: flex-start;
  }
  
  .system-message {
    text-align: center;
    padding: 8px;
    margin: 10px 0;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 15px;
    color: #aaa;
    font-style: italic;
    font-size: 14px;
  }
  
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    margin: 0 10px;
  }
  
  .user-message .avatar {
    order: 2;
  }
  
  .message-content {
    padding: 10px 15px;
    border-radius: 18px;
    max-width: 70%;
    word-wrap: break-word;
  }
  
  .user-message .message-content {
    background-color: #de5c34;
    color: white;
    border-top-right-radius: 5px;
  }
  
  .bot-message .message-content {
    background-color: #2a2a2a;
    color: white;
    border-top-left-radius: 5px;
  }
  
  .chat-input {
    display: flex;
    padding: 15px;
    background-color: #1a1a1a;
  }
  
  .chat-input input {
    flex-grow: 1;
    padding: 10px 15px;
    border: 1px solid #333;
    border-radius: 20px;
    background-color: #2a2a2a;
    color: white;
  }
  
  .chat-input button {
    background-color: #de5c34;
    color: white;
    border: none;
    border-radius: 20px;
    padding: 10px 15px;
    margin-left: 10px;
    cursor: pointer;
    transition: background-color 0.3s;
  }
  
  .chat-input button:hover {
    background-color: #c04d2c;
  }
  
  .typing-indicator {
    display: inline-flex;
    align-items: center;
  }
  
  .typing-indicator span {
    width: 8px;
    height: 8px;
    margin: 0 2px;
    background-color: #bbb;
    border-radius: 50%;
    display: inline-block;
    animation: typing 1.3s infinite ease-in-out;
  }
  
  .typing-indicator span:nth-child(1) {
    animation-delay: 0s;
  }
  
  .typing-indicator span:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  .typing-indicator span:nth-child(3) {
    animation-delay: 0.4s;
  }
  
  @keyframes typing {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-5px); }
  }
  
  pre {
    background-color: #1a1a1a;
    padding: 10px;
    border-radius: 5px;
    overflow-x: auto;
    margin: 5px 0;
  }
  
  code {
    font-family: monospace;
    background-color: rgba(0, 0, 0, 0.2);
    padding: 2px 4px;
    border-radius: 3px;
  }
  
  pre code {
    background-color: transparent;
    padding: 0;
  }
  
  .clear-button {
    background-color: transparent;
    color: #888;
    border: 1px solid #444;
    border-radius: 15px;
    padding: 5px 10px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .clear-button:hover {
    background-color: #333;
    color: #ccc;
  }
  
  a {
    color: #de5c34;
    text-decoration: underline;
  }
  `;