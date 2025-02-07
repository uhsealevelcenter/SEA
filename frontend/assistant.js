// script.js

// Constants and State Management
const INITIAL_TEXTAREA_HEIGHT = '38px';
const MESSAGE_TYPES = {
    CONSOLE: 'console',
    MESSAGE: 'message',
    IMAGE: 'image',
    CODE: 'code',
    FILE: 'file',
    SYSTEM: 'system'
};

// Global State
let messages = [];
let currentMessageIndex = 0;
let isGenerating = false;
let controller = null;
let promptIdeasVisible = false;
let currentMessageId = null;

// Session Management
let sessionId = generateId('session');
let threadId = localStorage.getItem('threadId') || (() => {
    const newThreadId = generateId('thread');
    localStorage.setItem('threadId', newThreadId);
    return newThreadId;
})();

// DOM Elements
const chatDisplay = document.getElementById('chatDisplay');
const sendButton = document.getElementById('sendButton');
const stopButton = document.getElementById('stopButton');
const newMessagesButton = document.getElementById('newMessagesButton');
const messageInput = document.getElementById('messageInput');

// Configure Marked.js for code highlighting
marked.setOptions({
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        } else {
            return hljs.highlightAuto(code).value;
        }
    }
});

// window.MathJax = {
//     tex: {
//         inlineMath: [['$', '$'], ['\\(', '\\)']],
//         displayMath: [['$$', '$$'], ['\\[', '\\]']],
//         processEscapes: true
//     },
//     svg: {
//         fontCache: 'global'
//     }
// };

function createPromptIdeas() {
    const container = document.getElementById('promptIdeasContainer');
    container.innerHTML = '';
    const promptsContainer = document.createElement('div');
    promptsContainer.className = 'prompt-ideas';
    promptsContainer.id = 'promptIdeas';
    console.log("Creating prompt ideas");
    const prompts = [
        {title: "Explain data", prompt: "Explain data to me. I am new to researching sea level and tidal information. Share information about the data available at UHSLC and within this app. Discuss ways to interact with the data, such as requesting to see samples, perform analyses, or download files. Ask me what I would like to explore next."},
        {title: "Analyze data", prompt: "Analyze data for me. I am new to researching sea level and tidal information. Briefly explain what data is available. Jump into an example, such as using the Fast Delivery daily data to calculate monthly means and then calculating the trend (remember there could be data gaps that should be ignored when calculating trends). Ensure that trend calculations are clearly specified as per year. When calculating trends, always verify the time unit and convert to an annual rate, if necessary, before presenting results. Show your code and plot the results. Offer to calculate monthly anomalies by subtracting the annual cycle climatology. Ask me what I would like to explore next."},
        {title: "Convey information", prompt: "Convey information to me. I am especially interested in understanding tidal datum information. Teach me about the tidal datums, especially about how they relate to coastal impacts and how to convert data between different reference datums. Jump into an example by loading the tidal datums for the selected station and plotting them as both relative to Station Zero and MHHW datums. Show your equations, code, and plots. Ask me what I would like to explore next."},
        {title: "Propose research", prompt: "Propose research ideas to me. I am looking for creative new ideas to research using the sea level and tidal data at UHSLC. Briefly explain what data is available. Outline several neat research questions to explore. Pick one question and help me get started with the analysis. Show your code and plot the preliminary results. Ask me if there is a research topic that I would like to further explore."},
    ];

    const promptTitle = document.createElement('p');
    // promptTitle.className = 'prompt-title';
    // promptTitle.textContent = 'Prompt Ideas:';
    promptsContainer.appendChild(promptTitle);

    prompts.forEach(prompt => {
        const button = document.createElement('button');
        button.className = 'prompt-button';
        button.textContent = prompt.title;
        button.addEventListener('click', () => {
            messageInput.value = prompt.prompt;
            sendRequest();
            hidePromptIdeas();
        });
        promptsContainer.appendChild(button);
    });
    container.appendChild(promptsContainer);
    return promptsContainer;
}

function showPromptIdeas() {
    if (!promptIdeasVisible) {
        const existingIdeas = document.getElementById('promptIdeas');
        if (existingIdeas) existingIdeas.remove();
        
        createPromptIdeas();
        promptIdeasVisible = true;
    }
}

function hidePromptIdeas() {
    const container = document.getElementById('promptIdeasContainer');
    container.innerHTML = '';
    promptIdeasVisible = false;
}

showPromptIdeas();

function resetTextareaHeight() {
    const messageInput = document.getElementById('messageInput');
    messageInput.style.height = '38px'; // Reset to initial height
}

// Event listeners
sendButton.addEventListener('click', () => {
    if (messageInput.value.trim() === '') return;
    sendRequest();
    hidePromptIdeas();
    resetTextareaHeight();
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendButton.click();
    }
    // Automatically adjust height based on content
    // this.style.height = 'auto';
    // this.style.height = this.scrollHeight + 'px';
});

stopButton.addEventListener('click', () => {
    if (isGenerating && controller) {
        isGenerating = false;
        controller.abort();
        appendSystemMessage("Generation stopped by user.");
    }
});

newMessagesButton.addEventListener('click', () => {
    clearChatHistory();
    resetTextareaHeight();
});

// Error handling utility
function handleError(error, customMessage = 'An error occurred') {
    console.error(error);
    appendSystemMessage(`${customMessage}: ${error.message || 'Unknown error'}`);
}

// Safe DOM manipulation utility
function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id '${id}' not found`);
    }
    return element;
}

// Modify sendRequest to use better error handling
async function sendRequest(msgOverride=null) {
    const userInput = msgOverride ? msgOverride : messageInput.value.trim();
    if (!userInput) return;

    try {
        // Input validation

        sendButton.disabled = true;
        stopButton.disabled = false;

        const userMessage = {
            id: generateId('msg'),
            role: 'user',
            type: 'message',
            content: userInput
        };
        messages.push(userMessage);
        appendMessage(userMessage);
        scrollToBottom();
        messageInput.value = '';

        // console.log("Sending request");
        // console.log("Station ID:", $('#myselect2').val());
        stationId = $('#myselect2').val();
        // Define parameters for the POST request
        const params = {
            messages,
            station_id: stationId
        };

        // Initialize AbortController to handle cancellation
        controller = new AbortController();
        const { signal } = controller;

        // Send the POST request to the Python server endpoint with session ID header
        const interpreterCall = await fetch(config.getEndpoints().chat, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Session-Id": sessionId
            },
            body: JSON.stringify(params),
            signal,
        });

        // Throw an error if the request was not successful
        if (!interpreterCall.ok) {
            console.error("Interpreter didn't respond with 200 OK");
            if (interpreterCall.statusText) {
                appendSystemMessage(interpreterCall.statusText);
            } else {
                appendSystemMessage("Error: Unable to communicate with the server.");
            }
            resetButtons();
            return;
        }

        // Initialize a reader for the response body
        const reader = interpreterCall.body.getReader();
        const decoder = new TextDecoder("utf-8");

        isGenerating = true;

        let partialData = ''; // Buffer for partial data

        while (isGenerating) {
            const { value, done } = await reader.read();

            if (done) break;

            const text = decoder.decode(value, { stream: true });
            partialData += text;

            // Split the received text by newlines
            const lines = partialData.split("\n");

            // Keep the last line (it might be incomplete)
            partialData = lines.pop();

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    // console.log("Received line:", line);
                    const data = line.replace("data: ", "").trim();
                    // console.log("Received data:", data);
                    try {
                        const chunk = JSON.parse(data);
                        await processChunk(chunk);
                    } catch (e) {
                        console.error("Failed to parse chunk:", e);
                    }
                }
            }
        }

        resetButtons();
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("Request was aborted");
        } else {
            handleError(error, 'Failed to send request');
        }
    } finally {
        resetButtons();
    }
}

// Function to reset send and stop buttons
function resetButtons() {
    sendButton.disabled = false;
    stopButton.disabled = true;
    controller = null;
    isGenerating = false;
}

// Function to process each chunk of the stream and create messages
function processChunk(chunk) {
    let messageStarted = false;
    let messageEnded = false;
    return new Promise((resolve) => {
        if (chunk.start) {
            // Start of a new message
            const newMessage = {
                id: generateId('msg'),
                role: chunk.role,
                type: chunk.type,
                content: chunk.content || '',
                format: chunk.format || undefined,
                recipient: chunk.recipient || undefined,
                created_at: new Date().toISOString(),
                isComplete: false,
            };
            messages.push(newMessage);
            appendMessage(newMessage);
            currentMessageId = newMessage.id; // Use ID instead of index
        }else{
            if (chunk.error) {
                // if chunk error has message
                const errorMessage = chunk.error.message || chunk.error;
    appendSystemMessage(errorMessage);
                return;
            }
        }

        // if (chunk.end) {
        //     // End of the current message
        //     resolve();
        //     return;
        // }

        // Append content to the message with the current ID
        const message = messages.find(msg => msg.id === currentMessageId);
        if (message) {
            if (chunk.end) {
                message.isComplete = true;  // Mark message as complete
                // console.log(`Message ${currentMessageId} completed`);
            }
            message.format = chunk.format || undefined;
            if (chunk.format == 'active_line') {
                message.content = chunk.content || '';
            }else{
                message.content += chunk.content || '';
            }
            
            // Update the displayed message
            updateMessageContent(currentMessageId, message.content);
        }

        resolve();
    });
}

// Function to append a message to the chat display, gets called on chunk start
function appendMessage(message) {
    // if (message.type == 'console'){
    //     // TODO: we should only skip console messages that have start or end properties
    //     // or have content that is empty
    //     return;
    // }
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', message.role);
    if (message.id) {
        messageElement.setAttribute('data-id', message.id);
    }

    const contentElement = document.createElement('div');
    contentElement.classList.add('content');
    contentElement.setAttribute('data-type', message.type);
    contentElement.innerHTML = message.content; 

    messageElement.appendChild(contentElement);
    chatDisplay.appendChild(messageElement);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

// Modify updateMessageContent with better error handling
function updateMessageContent(id, content) {
    try {
        const messageElement = chatDisplay.querySelector(`.message[data-id="${id}"]`);
        if (!messageElement) {
            throw new Error(`Message element with ID ${id} not found`);
        }

        const message = messages.find(msg => msg.id === id);
        if (!message) {
            throw new Error(`Message data with ID ${id} not found`);
        }

        const contentDiv = messageElement.querySelector('.content');
        if (!contentDiv) {
            throw new Error('Content div not found');
        }

        if (message.type === 'console' && message.format === 'active_line') {
            // console.log("Active line MESSAGE", message);
            // console.log("Active line CONTENT", content);
            // Find the most recent code block
            const codeBlocks = document.querySelectorAll('pre code');
            const lastCodeBlock = codeBlocks[codeBlocks.length - 1];
            
            if (lastCodeBlock) {
                // if (content) {
                //     console.log('Current line being executed:', content);
                //     // ... rest of your line highlighting code ...
                // } else {
                //     console.log('Execution completed!');
                // }
                const existingSpinner = lastCodeBlock.parentElement.querySelector('.code-spinner');
                    if (existingSpinner) {
                        existingSpinner.remove();
                    }

                    if (content) {
                        // Add spinner
                        const spinner = document.createElement('div');
                        spinner.className = 'code-spinner';
                        lastCodeBlock.parentElement.appendChild(spinner);

                        // // Highlight current line
                        // const lines = lastCodeBlock.innerHTML.split('\n');
                        // const highlightedLines = lines.map((line, index) => {
                        //     const lineNumber = index + 1;
                        //     const isActive = lineNumber === parseInt(content);
                        //     return `<div class="code-line${isActive ? ' active-line' : ''}">${line}</div>`;
                        // }).join('');
                        // lastCodeBlock.innerHTML = highlightedLines;
                    } else {
                        // Remove highlights
                        // const lines = lastCodeBlock.innerHTML.split('\n');
                        // const unhighlightedLines = lines.map(line => 
                        //     `<div class="code-line">${line}</div>`
                        // ).join('');
                        // lastCodeBlock.innerHTML = unhighlightedLines;
                    }
            }
            return;
        }


        if (contentDiv.getAttribute('data-type') === 'console') {
            // contentDiv.parentElement.remove();
            contentDiv.parentElement.style.display = 'none';
        }
        if (message.type === 'message') {
            // Escape backslashes to preserve them through Markdown parsing
            const escapedContent = content.replace(/\\/g, '\\\\');
            // const contentWithPreservedBreaks = escapedContent.replace(/\n/g, '  \n');
            // Parse Markdown to HTML using Marked.js
            const parsedMarkdown = marked.parse(escapedContent);
            // Sanitize the parsed HTML
            // const sanitizedContent = DOMPurify.sanitize(parsedMarkdown);
            // Set the sanitized HTML
            contentDiv.innerHTML = parsedMarkdown;
            // Apply syntax highlighting
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
            // if (window.MathJax) {
            //     // Ensure MathJax has finished loading
            //     MathJax.startup.promise.then(() => {
            //         return MathJax.typesetPromise([contentDiv]);
            //     }).catch((err) => {
            //         console.error('MathJax typeset failed:', err.message);
            //     });
            // }
            if (window.MathJax) {
                MathJax.typesetPromise([contentDiv]).catch((err) => {
                    console.error('MathJax typeset failed:', err.message);
                });
            }
        } else if (message.type === 'image') {
            if (message.format === 'base64.png') {
                contentDiv.innerHTML = `<img src="data:image/png;base64,${content}" alt="Image">`;
            } else if (message.format === 'path') {
                contentDiv.innerHTML = `<img src="${content}" alt="Image">`;
            }
        } else if (message.type === 'code') {
            if (message.format === "html") {
                // contentDiv.innerHTML = content;
                // do nothing
                // return;
                // const sanitizedHtml = DOMPurify.sanitize(content);
                
                contentDiv.innerHTML = content;
                // return;
            } else 
            {
            contentDiv.innerHTML = `<pre><code class="language-${message.format || ''}">${escapeHtml(content)}</code></pre>`;
            // Apply syntax highlighting
            const codeBlock = contentDiv.querySelector('code');
            if (codeBlock ) {
                // hljs.highlightElement(codeBlock);
                Prism.highlightElement(codeBlock);
            }
            addCopyButtons();
        }
        } else if (message.type === 'file') {
            contentDiv.innerHTML = `<a href="${content}" download>Download File</a>`;
        } 
    } catch (error) {
        handleError(error, 'Failed to update message content');
    }
}

// Function to append system messages (like errors or notifications)
function appendSystemMessage(message) {
    const id = generateId('msg');
    const systemMessage = {
        id: id,
        role: 'system',
        type: 'system',
        content: message
    };
    messages.push(systemMessage);

    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'system');
    messageElement.setAttribute('data-id', id);

    const content = document.createElement('div');
    content.classList.add('content');
    const parsedMarkdown = marked.parse(message);
    content.innerHTML = parsedMarkdown;
    content.querySelectorAll('pre code').forEach((block) => {
        Prism.highlightElement(block);
        // hljs.highlightElement(block);
    });

    messageElement.appendChild(content);
    chatDisplay.appendChild(messageElement);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

// Function to append confirmation chunks
function appendConfirmationChunk(chunk) {
    // Example: Show a prompt to the user to confirm code execution
    if (chunk.type === 'confirmation' && chunk.content) {
        const confirmation = chunk.content;
        const userConfirmed = confirm(`Execution Confirmation:\n\nType: ${confirmation.type}\nFormat: ${confirmation.format}\nContent:\n${confirmation.content}\n\nDo you want to proceed?`);

        if (userConfirmed) {
            // User confirmed, proceed with execution
            appendSystemMessage("Code execution confirmed.");
            // Optionally, send a confirmation back to the server if required
        } else {
            // User canceled, abort the generation
            isGenerating = false;
            if (controller) {
                controller.abort();
            }
            appendSystemMessage("Code execution canceled by user.");
        }
    }
}

// Function to clear chat history
async function clearChatHistory() {
    try {
        // Clear chat history
        const response = await fetch(config.getEndpoints().clear, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Session-Id": sessionId
            },
        });

        if (!response.ok) {
            throw new Error("Failed to clear chat history");
        }

        // Clear uploaded files
        const fileResponse = await fetch(config.getEndpoints().files, {
            method: "DELETE",
            headers: {
                "X-Session-Id": sessionId
            },
        });

        if (!fileResponse.ok) {
            throw new Error("Failed to clear uploaded files");
        }

        // Clear frontend messages array
        messages = [];
        // Clear chat display
        currentMessageId = null;
        isGenerating = false;
        controller = null;
        chatDisplay.innerHTML = '';
        
        // Clear uploaded files list in UI
        const uploadedFiles = document.getElementById('uploadedFiles');
        if (uploadedFiles) {
            uploadedFiles.innerHTML = '';
        }

        appendSystemMessage("Begin a new conversation.");
        showPromptIdeas();
        resetTextareaHeight();

    } catch (error) {
        console.error("An error occurred while clearing history:", error);
        appendSystemMessage("Error: Unable to clear history completely.");
    }
}

// Utility function to generate a unique ID for messages
function generateId(id_type) {
    return id_type + '-' + Math.random().toString(36).substr(2, 9);
}

// Utility function to escape HTML to prevent XSS in code blocks
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Scroll to the bottom of the chat display
function scrollToBottom() {
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

function addCopyButtons() {
    // console.log("Adding copy buttons");
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach((codeBlock) => {
        const pre = codeBlock.parentElement;

        // Avoid adding multiple buttons to the same code block
        if (pre.querySelector('.copy-button')) return;

        // Create the copy button
        const button = document.createElement('button');
        button.classList.add('copy-button');
        button.innerText = 'Copy';

        // Append the button to the <pre> element
        pre.appendChild(button);

        // Add click event to copy code
        button.addEventListener('click', () => {
            const code = codeBlock.innerText;
            navigator.clipboard.writeText(code).then(() => {
                button.innerText = 'Copied!';
                setTimeout(() => {
                    button.innerText = 'Copy';
                }, 2000);
            }).catch((err) => {
                console.error('Failed to copy code: ', err);
                button.innerText = 'Error';
                setTimeout(() => {
                    button.innerText = 'Copy';
                }, 2000);
            });
        });
    });
}

// Fetch and display chat history on load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch(config.getEndpoints().history, {
            method: "GET",
            headers: {
                "X-Session-Id": sessionId
            }
        });
        if (response.ok) {
            const history = await response.json();  
            history.forEach(message => {
                // Assign an id if it's missing

                if (history.length === 0) {
                    showPromptIdeas();
                } else if (message.type != 'console') {
                    if (!message.id) {
                        message.id = generateId('msg');
                    }
                    messages.push(message); // Add to messages array
                    appendMessage(message);
                    updateMessageContent(message.id, message.content);
                }
            });
            scrollToBottom();
        }
    } catch (error) {
        console.error("Failed to fetch history:", error);
        showPromptIdeas();
    }
});

// This function sets all links to open in a new tab
function setLinksToNewTab() {
    document.querySelectorAll('a').forEach(link => {
      link.setAttribute('target', '_blank');
    });
  }
  
  // Call this function initially to set existing links
  setLinksToNewTab();
  
  // For dynamically created links, use a MutationObserver
  const observer = new MutationObserver(() => {
    setLinksToNewTab();
  });
  
  // Observe changes in the document body to catch dynamically added links
  observer.observe(document.body, { childList: true, subtree: true });


  window.onload = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const prompt = urlParams.get('prompt');
    
    if (prompt) {
        // Wait for select2 to be initialized
        await waitForSelect2();
        
        const inputField = document.getElementById('messageInput');
        if (inputField) {
            inputField.value = prompt;
            sendButton.click();
        }
    }
};

async function waitForSelect2(timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkSelect2 = () => {
            const select2Value = $('#myselect2').val();
            if (select2Value) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(new Error('Timeout waiting for select2'));
            } else {
                setTimeout(checkSelect2, 100);
            }
        };
        
        checkSelect2();
    });
}

// Add these functions to your existing assistant.js

function initializeFileUpload() {
    const uploadButton = document.getElementById('uploadButton');
    const fileInput = document.getElementById('fileUpload');
    const uploadedFiles = document.getElementById('uploadedFiles');
    const progressBar = document.getElementById('uploadProgress');
    const progressElement = progressBar.querySelector('.progress');

    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
        const files = fileInput.files;
        if (files.length === 0) return;

        for (const file of files) {
            try {
                progressBar.style.display = 'block';
                await uploadFile(file, progressElement);
                await updateFilesList();
            } catch (error) {
                appendSystemMessage(`Error uploading ${file.name}: ${error.message}`);
            }
        }
        progressBar.style.display = 'none';
        fileInput.value = ''; // Reset file input
    });

    // Initial file list load
    updateFilesList();
}

// File upload error handling improvements
async function uploadFile(file, progressElement) {
    try {
        if (!file) {
            throw new Error('No file provided');
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(config.getEndpoints().upload, {
            method: 'POST',
            headers: {
                'X-Session-Id': sessionId
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Upload failed with status ${response.status}`);
        }

        const data = await response.json();
        appendSystemMessage(`Successfully uploaded ${file.name}`);
        sendRequest(`I uploaded ${file.name}`);
        return data;

    } catch (error) {
        handleError(error, `Failed to upload ${file.name}`);
        throw error; // Re-throw to handle in the calling function
    }
}

async function updateFilesList() {
    try {
        const response = await fetch(config.getEndpoints().files, {
            headers: {
                'X-Session-Id': sessionId
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch files list');
        }

        const files = await response.json();
        const uploadedFiles = document.getElementById('uploadedFiles');
        uploadedFiles.innerHTML = '';

        files.forEach(file => {
            const fileElement = document.createElement('div');
            fileElement.className = 'uploaded-file';
            fileElement.innerHTML = `
                <span>${file.name} (${formatFileSize(file.size)})</span>
                <button class="delete-file" data-filename="${file.name}">×</button>
            `;

            // Add delete button event listener
            const deleteButton = fileElement.querySelector('.delete-file');
            deleteButton.addEventListener('click', async () => {
                try {
                    const filename = deleteButton.getAttribute('data-filename');
                    const response = await fetch(`${config.getEndpoints().files}/${encodeURIComponent(filename)}`, {
                        method: 'DELETE',
                        headers: {
                            'X-Session-Id': sessionId
                        }
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.detail || 'Delete failed');
                    }

                    // Remove the file element from the UI
                    fileElement.remove();
                    appendSystemMessage(`Successfully deleted ${filename}`);
                } catch (error) {
                    appendSystemMessage(`Error deleting file: ${error.message}`);
                }
            });

            uploadedFiles.appendChild(fileElement);
        });
    } catch (error) {
        console.error('Error updating files list:', error);
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function downloadConversation() {
    // Create a clone of the chat display to modify for PDF
    const chatClone = chatDisplay.cloneNode(true);
    
    // Apply some PDF-specific styling
    const pdfContainer = document.createElement('div');
    pdfContainer.innerHTML = `
        <h1 style="text-align: center; margin-bottom: 20px;">Chat Conversation</h1>
        <p style="text-align: center; margin-bottom: 30px;">
            Generated on ${new Date().toLocaleString()}
        </p>
    `;
    pdfContainer.appendChild(chatClone);

    // Configure PDF options
    const opt = {
        margin: [10, 10],
        filename: 'chat-conversation.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2,
            useCORS: true,
            logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Generate PDF
    html2pdf().set(opt).from(pdfContainer).save()
        .then(() => {
            appendSystemMessage("Conversation downloaded successfully!");
        })
        .catch(err => {
            console.error("PDF generation failed:", err);
            appendSystemMessage("Failed to download conversation. Please try again.");
        });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeFileUpload();
    
    // Add download button event listener
    const downloadButton = document.getElementById('downloadButton');
    if (downloadButton) {
        downloadButton.addEventListener('click', downloadConversation);
    }
});

messageInput.addEventListener('input', function() {
    // Reset height to auto to get correct scrollHeight
    this.style.height = 'auto';
    // Set new height based on content
    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
});
