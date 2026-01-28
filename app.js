/**
 * Voice Performance Studio
 * Tripod Method · Oral Bible Translation
 * 
 * A web application for refining voice performances through audio feedback.
 * Supports Hindi, Indian English, and Brazilian Sertanejo Portuguese.
 */

// ===================================
// Configuration & State
// ===================================

const CONFIG = {
    languages: {
        'hi-IN': {
            name: 'Hindi',
            speechRecognitionLang: 'hi-IN',
            defaultVoice: 'pMsXgVXv3BLzUgSXRplE',
            sampleText: 'आदि में परमेश्‍वर ने आकाश और पृथ्वी की सृष्टि की।'
        },
        'en-IN': {
            name: 'Indian English',
            speechRecognitionLang: 'en-IN',
            defaultVoice: 'pMsXgVXv3BLzUgSXRplE',
            sampleText: 'In the beginning, God created the heavens and the earth.'
        },
        'pt-BR': {
            name: 'Portuguese (Sertanejo)',
            speechRecognitionLang: 'pt-BR',
            defaultVoice: 'pMsXgVXv3BLzUgSXRplE',
            sampleText: 'No princípio, Deus criou os céus e a terra.'
        }
    },
    emotionTags: [
        'reverent', 'joyful', 'sorrowful', 'urgent', 
        'whisper', 'pause', 'slow', 'fast', 'emphasis',
        'peaceful', 'awe', 'warning', 'gentle', 'strong'
    ],
    playbackSpeeds: [0.5, 0.75, 1, 1.25, 1.5, 2]
};

// Application state
const state = {
    currentLanguage: 'hi-IN',
    sacredText: '',
    markedText: '',
    currentVersion: 1,
    versions: [],
    audioBlob: null,
    audioUrl: null,
    isPlaying: false,
    isRecording: false,
    playbackSpeed: 1,
    feedbackHistory: [],
    settings: {
        elevenLabsKey: '',
        anthropicKey: '',
        voiceHindi: 'pMsXgVXv3BLzUgSXRplE',
        voiceEnglishIN: 'pMsXgVXv3BLzUgSXRplE',
        voicePortuguese: 'pMsXgVXv3BLzUgSXRplE',
        ttsModel: 'eleven_multilingual_v2'
    }
};

// Audio context and elements
let audioContext = null;
let audioElement = null;
let mediaRecorder = null;
let recordedChunks = [];
let speechRecognition = null;

// ===================================
// DOM Elements
// ===================================

const elements = {
    // Text panel
    languageSelect: document.getElementById('languageSelect'),
    sacredText: document.getElementById('sacredText'),
    charCount: document.getElementById('charCount'),
    wordCount: document.getElementById('wordCount'),
    
    // Performance panel
    versionBadge: document.getElementById('versionBadge'),
    waveformCanvas: document.getElementById('waveformCanvas'),
    waveformContainer: document.getElementById('waveformContainer'),
    playhead: document.getElementById('playhead'),
    playBtn: document.getElementById('playBtn'),
    currentTime: document.getElementById('currentTime'),
    totalTime: document.getElementById('totalTime'),
    speedBtn: document.getElementById('speedBtn'),
    generateBtn: document.getElementById('generateBtn'),
    markupDisplay: document.getElementById('markupDisplay'),
    copyMarkupBtn: document.getElementById('copyMarkupBtn'),
    
    // Feedback panel
    recordBtn: document.getElementById('recordBtn'),
    feedbackList: document.getElementById('feedbackList'),
    textFeedbackInput: document.getElementById('textFeedbackInput'),
    sendFeedbackBtn: document.getElementById('sendFeedbackBtn'),
    
    // Settings
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    elevenLabsKey: document.getElementById('elevenLabsKey'),
    anthropicKey: document.getElementById('anthropicKey'),
    voiceHindi: document.getElementById('voiceHindi'),
    voiceEnglishIN: document.getElementById('voiceEnglishIN'),
    voicePortuguese: document.getElementById('voicePortuguese'),
    ttsModel: document.getElementById('ttsModel'),
    
    // Toast
    toast: document.getElementById('toast')
};

// ===================================
// Initialization
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    loadSettings();
    setupEventListeners();
    setupSpeechRecognition();
    updateTextCounts();
    drawEmptyWaveform();
    
    // Set initial sample text
    const lang = CONFIG.languages[state.currentLanguage];
    elements.sacredText.value = lang.sampleText;
    state.sacredText = lang.sampleText;
    updateTextCounts();
}

// ===================================
// Event Listeners
// ===================================

function setupEventListeners() {
    // Language selection
    elements.languageSelect.addEventListener('change', handleLanguageChange);
    
    // Text input
    elements.sacredText.addEventListener('input', handleTextInput);
    
    // Audio controls
    elements.playBtn.addEventListener('click', togglePlayback);
    elements.speedBtn.addEventListener('click', cyclePlaybackSpeed);
    elements.generateBtn.addEventListener('click', generatePerformance);
    elements.copyMarkupBtn.addEventListener('click', copyMarkup);
    
    // Recording
    elements.recordBtn.addEventListener('mousedown', startRecording);
    elements.recordBtn.addEventListener('mouseup', stopRecording);
    elements.recordBtn.addEventListener('mouseleave', stopRecording);
    elements.recordBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startRecording();
    });
    elements.recordBtn.addEventListener('touchend', stopRecording);
    
    // Text feedback
    elements.sendFeedbackBtn.addEventListener('click', sendTextFeedback);
    elements.textFeedbackInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendTextFeedback();
    });
    
    // Settings
    elements.settingsBtn.addEventListener('click', openSettings);
    elements.closeSettingsBtn.addEventListener('click', closeSettings);
    elements.settingsModal.querySelector('.modal-backdrop').addEventListener('click', closeSettings);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    
    // Tags click to copy
    document.querySelectorAll('.tags-grid .tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const tagText = tag.dataset.tag;
            navigator.clipboard.writeText(tagText);
            showToast(`Copied: ${tagText}`);
        });
    });
    
    // Version badge click
    elements.versionBadge.addEventListener('click', showVersionHistory);
}

// ===================================
// Text Handling
// ===================================

function handleLanguageChange(e) {
    state.currentLanguage = e.target.value;
    const lang = CONFIG.languages[state.currentLanguage];
    
    // Update speech recognition language
    if (speechRecognition) {
        speechRecognition.lang = lang.speechRecognitionLang;
    }
    
    showToast(`Language changed to ${lang.name}`);
}

function handleTextInput() {
    state.sacredText = elements.sacredText.value;
    updateTextCounts();
}

function updateTextCounts() {
    const text = elements.sacredText.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    
    elements.charCount.textContent = `${chars} characters`;
    elements.wordCount.textContent = `${words} words`;
}

// ===================================
// Voice Generation (ElevenLabs)
// ===================================

async function generatePerformance() {
    if (!state.settings.elevenLabsKey) {
        showToast('Please add your ElevenLabs API key in Settings');
        openSettings();
        return;
    }
    
    const text = elements.sacredText.value.trim();
    if (!text) {
        showToast('Please enter some text first');
        return;
    }
    
    // Start loading state
    elements.generateBtn.classList.add('loading');
    elements.generateBtn.disabled = true;
    
    try {
        // Get the marked text (use current markup or original text)
        const textToSpeak = state.markedText || text;
        
        // Get voice ID for current language
        const voiceId = getVoiceForLanguage(state.currentLanguage);
        
        // Call ElevenLabs API
        const audioBlob = await callElevenLabsAPI(textToSpeak, voiceId);
        
        // Store and play
        state.audioBlob = audioBlob;
        state.audioUrl = URL.createObjectURL(audioBlob);
        
        // Update version
        state.currentVersion++;
        state.versions.push({
            version: state.currentVersion,
            text: textToSpeak,
            timestamp: new Date(),
            audioUrl: state.audioUrl
        });
        
        elements.versionBadge.textContent = `Version ${state.currentVersion}`;
        
        // Setup audio player
        setupAudioPlayer(state.audioUrl);
        
        // Update markup display
        updateMarkupDisplay(textToSpeak);
        
        showToast('Performance generated successfully!');
        
    } catch (error) {
        console.error('Generation error:', error);
        showToast(`Error: ${error.message}`);
    } finally {
        elements.generateBtn.classList.remove('loading');
        elements.generateBtn.disabled = false;
    }
}

async function callElevenLabsAPI(text, voiceId) {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': state.settings.elevenLabsKey
        },
        body: JSON.stringify({
            text: text,
            model_id: state.settings.ttsModel,
            voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.5,
                use_speaker_boost: true
            }
        })
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail?.message || `API Error: ${response.status}`);
    }
    
    return await response.blob();
}

function getVoiceForLanguage(langCode) {
    switch (langCode) {
        case 'hi-IN':
            return state.settings.voiceHindi;
        case 'en-IN':
            return state.settings.voiceEnglishIN;
        case 'pt-BR':
            return state.settings.voicePortuguese;
        default:
            return state.settings.voiceHindi;
    }
}

// ===================================
// Audio Player
// ===================================

function setupAudioPlayer(audioUrl) {
    if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
    }
    
    audioElement = new Audio(audioUrl);
    audioElement.playbackRate = state.playbackSpeed;
    
    audioElement.addEventListener('loadedmetadata', () => {
        elements.totalTime.textContent = formatTime(audioElement.duration);
        elements.playBtn.disabled = false;
        drawWaveform();
    });
    
    audioElement.addEventListener('timeupdate', () => {
        elements.currentTime.textContent = formatTime(audioElement.currentTime);
        updatePlayhead();
    });
    
    audioElement.addEventListener('ended', () => {
        state.isPlaying = false;
        elements.playBtn.classList.remove('playing');
        elements.waveformContainer.classList.remove('playing');
    });
    
    audioElement.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        showToast('Error loading audio');
    });
}

function togglePlayback() {
    if (!audioElement) return;
    
    if (state.isPlaying) {
        audioElement.pause();
        state.isPlaying = false;
        elements.playBtn.classList.remove('playing');
        elements.waveformContainer.classList.remove('playing');
    } else {
        audioElement.play();
        state.isPlaying = true;
        elements.playBtn.classList.add('playing');
        elements.waveformContainer.classList.add('playing');
    }
}

function cyclePlaybackSpeed() {
    const currentIndex = CONFIG.playbackSpeeds.indexOf(state.playbackSpeed);
    const nextIndex = (currentIndex + 1) % CONFIG.playbackSpeeds.length;
    state.playbackSpeed = CONFIG.playbackSpeeds[nextIndex];
    
    if (audioElement) {
        audioElement.playbackRate = state.playbackSpeed;
    }
    
    elements.speedBtn.textContent = `${state.playbackSpeed}x`;
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updatePlayhead() {
    if (!audioElement || !audioElement.duration) return;
    
    const progress = audioElement.currentTime / audioElement.duration;
    const containerWidth = elements.waveformContainer.offsetWidth;
    elements.playhead.style.left = `${progress * containerWidth}px`;
}

// ===================================
// Waveform Visualization
// ===================================

function drawEmptyWaveform() {
    const canvas = elements.waveformCanvas;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    // Draw placeholder line
    ctx.strokeStyle = '#e6dfd3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, rect.height / 2);
    ctx.lineTo(rect.width, rect.height / 2);
    ctx.stroke();
}

async function drawWaveform() {
    if (!state.audioBlob) {
        drawEmptyWaveform();
        return;
    }
    
    const canvas = elements.waveformCanvas;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    try {
        // Decode audio
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const arrayBuffer = await state.audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Get audio data
        const rawData = audioBuffer.getChannelData(0);
        const samples = Math.floor(rect.width);
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];
        
        for (let i = 0; i < samples; i++) {
            const blockStart = blockSize * i;
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(rawData[blockStart + j]);
            }
            filteredData.push(sum / blockSize);
        }
        
        // Normalize
        const multiplier = Math.pow(Math.max(...filteredData), -1);
        const normalizedData = filteredData.map(n => n * multiplier);
        
        // Draw waveform
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.fillStyle = '#8b5a2b';
        
        const centerY = rect.height / 2;
        const barWidth = 2;
        const gap = 1;
        
        for (let i = 0; i < normalizedData.length; i += (barWidth + gap)) {
            const x = i;
            const barHeight = normalizedData[i] * centerY * 0.9;
            
            ctx.fillRect(x, centerY - barHeight, barWidth, barHeight * 2);
        }
        
    } catch (error) {
        console.error('Waveform error:', error);
        drawEmptyWaveform();
    }
}

// ===================================
// Markup Display
// ===================================

function updateMarkupDisplay(text) {
    // Highlight tags in the markup display
    const highlighted = text.replace(/\[([^\]]+)\]/g, '<span class="tag">[$1]</span>');
    elements.markupDisplay.innerHTML = highlighted;
}

function copyMarkup() {
    const markup = state.markedText || elements.sacredText.value;
    navigator.clipboard.writeText(markup).then(() => {
        showToast('Markup copied to clipboard');
    }).catch(() => {
        showToast('Failed to copy');
    });
}

// ===================================
// Speech Recognition (Feedback Input)
// ===================================

function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn('Speech Recognition not supported');
        elements.recordBtn.title = 'Speech recognition not supported in this browser';
        return;
    }
    
    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = CONFIG.languages[state.currentLanguage].speechRecognitionLang;
    
    let finalTranscript = '';
    
    speechRecognition.onresult = (event) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
    };
    
    speechRecognition.onend = () => {
        if (finalTranscript.trim()) {
            processFeedback(finalTranscript.trim());
        }
        finalTranscript = '';
    };
    
    speechRecognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'aborted') {
            showToast(`Recognition error: ${event.error}`);
        }
    };
}

function startRecording() {
    if (!speechRecognition) {
        showToast('Speech recognition not available');
        return;
    }
    
    state.isRecording = true;
    elements.recordBtn.classList.add('recording');
    elements.recordBtn.querySelector('.record-text').textContent = 'Listening...';
    
    try {
        speechRecognition.start();
    } catch (e) {
        // Already started
    }
}

function stopRecording() {
    if (!state.isRecording) return;
    
    state.isRecording = false;
    elements.recordBtn.classList.remove('recording');
    elements.recordBtn.querySelector('.record-text').textContent = 'Hold to Speak';
    
    if (speechRecognition) {
        speechRecognition.stop();
    }
}

// ===================================
// Feedback Processing
// ===================================

function sendTextFeedback() {
    const feedback = elements.textFeedbackInput.value.trim();
    if (!feedback) return;
    
    elements.textFeedbackInput.value = '';
    processFeedback(feedback);
}

async function processFeedback(feedbackText) {
    // Add to history
    addFeedbackToHistory(feedbackText);
    
    // Get the sacred text
    const sacredText = elements.sacredText.value.trim();
    if (!sacredText) {
        showToast('Please enter sacred text first');
        return;
    }
    
    // Process feedback to generate new markup
    showToast('Processing feedback...');
    
    try {
        const newMarkup = await interpretFeedback(sacredText, feedbackText, state.markedText);
        state.markedText = newMarkup;
        updateMarkupDisplay(newMarkup);
        
        // Auto-generate if we have an API key
        if (state.settings.elevenLabsKey) {
            generatePerformance();
        }
        
    } catch (error) {
        console.error('Feedback processing error:', error);
        showToast('Error processing feedback');
    }
}

async function interpretFeedback(sacredText, feedback, currentMarkup) {
    // If Anthropic key is available, use Claude for sophisticated interpretation
    if (state.settings.anthropicKey) {
        return await interpretWithClaude(sacredText, feedback, currentMarkup);
    }
    
    // Otherwise, use simple rule-based interpretation
    return interpretWithRules(sacredText, feedback, currentMarkup);
}

async function interpretWithClaude(sacredText, feedback, currentMarkup) {
    const systemPrompt = `You are a voice performance director for sacred text recordings.

Your job is to add performance markup tags to sacred text based on user feedback.

CRITICAL RULES:
1. NEVER change, add, or remove any words from the sacred text
2. ONLY insert performance tags between or around words
3. Available tags: [reverent], [joyful], [sorrowful], [urgent], [whisper], [pause], [slow], [fast], [emphasis], [peaceful], [awe], [warning], [gentle], [strong]
4. Return ONLY the marked-up text, nothing else

Example:
Sacred text: "In the beginning, God created the heavens and the earth."
Feedback: "Make the beginning more reverent and pause after heavens"
Output: [reverent] In the beginning, God created the heavens [pause] and the earth.`;

    const userMessage = `Sacred text: "${sacredText}"
${currentMarkup ? `Current markup: "${currentMarkup}"` : ''}
Feedback: "${feedback}"

Apply the feedback and return ONLY the marked-up text:`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': state.settings.anthropicKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }]
            })
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.content[0].text.trim();
        
    } catch (error) {
        console.error('Claude API error:', error);
        // Fall back to rules
        return interpretWithRules(sacredText, feedback, currentMarkup);
    }
}

function interpretWithRules(sacredText, feedback, currentMarkup) {
    let result = currentMarkup || sacredText;
    const feedbackLower = feedback.toLowerCase();
    
    // Simple keyword-based tag insertion
    const tagMappings = {
        'reverent': ['reverent', 'reverence', 'respectful', 'solemn', 'holy'],
        'joyful': ['joyful', 'happy', 'excited', 'celebration', 'joy'],
        'sorrowful': ['sorrowful', 'sad', 'grief', 'lament', 'mourning'],
        'urgent': ['urgent', 'fast', 'quick', 'hurry', 'pressing'],
        'whisper': ['whisper', 'soft', 'quiet', 'gentle voice'],
        'pause': ['pause', 'stop', 'break', 'wait'],
        'slow': ['slow', 'slower', 'carefully', 'deliberate'],
        'emphasis': ['emphasis', 'stress', 'highlight', 'important'],
        'peaceful': ['peaceful', 'calm', 'serene', 'tranquil'],
        'awe': ['awe', 'wonder', 'amazed', 'marvel']
    };
    
    // Find which tags to apply
    let tagsToApply = [];
    for (const [tag, keywords] of Object.entries(tagMappings)) {
        if (keywords.some(kw => feedbackLower.includes(kw))) {
            tagsToApply.push(tag);
        }
    }
    
    // If no specific tags found, try to detect position instructions
    if (tagsToApply.length === 0) {
        // Default to adding emphasis
        tagsToApply = ['emphasis'];
    }
    
    // Check for position keywords
    const atBeginning = feedbackLower.includes('beginning') || feedbackLower.includes('start');
    const atEnd = feedbackLower.includes('end') || feedbackLower.includes('ending');
    const throughout = feedbackLower.includes('throughout') || feedbackLower.includes('whole') || feedbackLower.includes('entire');
    
    // Apply tags
    const tag = `[${tagsToApply[0]}]`;
    
    if (throughout) {
        result = `${tag} ${result}`;
    } else if (atBeginning) {
        // Add tag at the very beginning
        result = `${tag} ${result}`;
    } else if (atEnd) {
        // Add tag before the last sentence/phrase
        const lastPeriod = result.lastIndexOf('.');
        if (lastPeriod > 0) {
            result = result.substring(0, lastPeriod) + ` ${tag}` + result.substring(lastPeriod);
        } else {
            result = `${result} ${tag}`;
        }
    } else {
        // Add at beginning by default
        result = `${tag} ${result}`;
    }
    
    return result;
}

function addFeedbackToHistory(feedbackText) {
    const feedbackItem = {
        text: feedbackText,
        timestamp: new Date()
    };
    
    state.feedbackHistory.unshift(feedbackItem);
    
    // Keep only last 20 items
    if (state.feedbackHistory.length > 20) {
        state.feedbackHistory.pop();
    }
    
    renderFeedbackHistory();
}

function renderFeedbackHistory() {
    if (state.feedbackHistory.length === 0) {
        elements.feedbackList.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M12 18.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13z"/>
                    <path d="M12 14v-4M12 8h.01"/>
                </svg>
                <p>No feedback yet. Record your voice to refine the performance.</p>
            </div>
        `;
        return;
    }
    
    elements.feedbackList.innerHTML = state.feedbackHistory.map(item => `
        <div class="feedback-item">
            <div class="feedback-text">"${escapeHtml(item.text)}"</div>
            <div class="feedback-time">${formatTimeAgo(item.timestamp)}</div>
        </div>
    `).join('');
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===================================
// Settings Management
// ===================================

function loadSettings() {
    const saved = localStorage.getItem('voicePerformanceStudioSettings');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state.settings = { ...state.settings, ...parsed };
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }
}

function saveSettings() {
    // Get values from form
    state.settings.elevenLabsKey = elements.elevenLabsKey.value.trim();
    state.settings.anthropicKey = elements.anthropicKey.value.trim();
    state.settings.voiceHindi = elements.voiceHindi.value;
    state.settings.voiceEnglishIN = elements.voiceEnglishIN.value;
    state.settings.voicePortuguese = elements.voicePortuguese.value;
    state.settings.ttsModel = elements.ttsModel.value;
    
    // Save to localStorage
    localStorage.setItem('voicePerformanceStudioSettings', JSON.stringify(state.settings));
    
    closeSettings();
    showToast('Settings saved');
}

function openSettings() {
    // Populate form
    elements.elevenLabsKey.value = state.settings.elevenLabsKey || '';
    elements.anthropicKey.value = state.settings.anthropicKey || '';
    elements.voiceHindi.value = state.settings.voiceHindi;
    elements.voiceEnglishIN.value = state.settings.voiceEnglishIN;
    elements.voicePortuguese.value = state.settings.voicePortuguese;
    elements.ttsModel.value = state.settings.ttsModel;
    
    elements.settingsModal.classList.add('open');
}

function closeSettings() {
    elements.settingsModal.classList.remove('open');
}

// ===================================
// Version History
// ===================================

function showVersionHistory() {
    if (state.versions.length === 0) {
        showToast('No versions yet. Generate a performance first.');
        return;
    }
    
    // Simple version display in toast for now
    const latestVersions = state.versions.slice(-5).reverse();
    const versionText = latestVersions.map(v => 
        `v${v.version}: ${v.timestamp.toLocaleTimeString()}`
    ).join('\n');
    
    showToast(`Recent versions:\n${versionText}`);
}

// ===================================
// Toast Notifications
// ===================================

function showToast(message) {
    elements.toast.querySelector('.toast-message').textContent = message;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// ===================================
// Keyboard Shortcuts
// ===================================

document.addEventListener('keydown', (e) => {
    // Space to play/pause (when not in input)
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        togglePlayback();
    }
    
    // Escape to close modal
    if (e.code === 'Escape') {
        closeSettings();
    }
    
    // Ctrl/Cmd + Enter to generate
    if ((e.ctrlKey || e.metaKey) && e.code === 'Enter') {
        e.preventDefault();
        generatePerformance();
    }
});

// ===================================
// Window Events
// ===================================

window.addEventListener('resize', () => {
    if (state.audioBlob) {
        drawWaveform();
    } else {
        drawEmptyWaveform();
    }
});

// Handle visibility change to pause audio
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.isPlaying) {
        togglePlayback();
    }
});
