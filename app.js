/**
 * Voice Performance Studio
 * Tripod Method · Oral Bible Translation
 * 
 * A web application for refining voice performances through audio feedback.
 * Supports Hindi, Indian English, and Brazilian Sertanejo Portuguese.
 * 
 * Version 2.0 - Improved voice management and markup placement
 */

// ===================================
// Configuration & State
// ===================================

const CONFIG = {
    languages: {
        'hi-IN': {
            name: 'Hindi',
            nativeName: 'हिन्दी',
            speechRecognitionLang: 'hi-IN',
            sampleText: 'आदि में परमेश्‍वर ने आकाश और पृथ्वी की सृष्टि की।'
        },
        'en-IN': {
            name: 'Indian English',
            nativeName: 'Indian English',
            speechRecognitionLang: 'en-IN',
            sampleText: 'In the beginning, God created the heavens and the earth.'
        },
        'pt-BR': {
            name: 'Portuguese (Sertanejo)',
            nativeName: 'Português Sertanejo',
            speechRecognitionLang: 'pt-BR',
            sampleText: 'No princípio, Deus criou os céus e a terra.'
        }
    },
    emotionTags: [
        'reverent', 'joyful', 'sorrowful', 'urgent', 
        'whisper', 'pause', 'slow', 'fast', 'emphasis',
        'peaceful', 'awe', 'warning', 'gentle', 'strong'
    ],
    playbackSpeeds: [0.5, 0.75, 1, 1.25, 1.5, 2],
    // Default ElevenLabs voices (user can add their own)
    defaultVoices: [
        { id: 'pMsXgVXv3BLzUgSXRplE', name: 'Aria (Female)' },
        { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (Female)' },
        { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (Male)' },
        { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Female)' },
        { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi (Female)' },
        { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli (Female)' },
        { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh (Male)' },
        { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (Male)' },
        { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Male)' },
        { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam (Male)' }
    ]
};

// Application state
const state = {
    currentLanguage: 'hi-IN',
    sacredText: '',
    markedText: '',
    currentVersion: 0,
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
        ttsModel: 'eleven_multilingual_v2',
        // Voice settings per language - array of {id, name} objects
        voicesHindi: [],
        voicesEnglishIN: [],
        voicesPortuguese: [],
        // Currently selected voice ID per language
        selectedVoiceHindi: '',
        selectedVoiceEnglishIN: '',
        selectedVoicePortuguese: '',
        // Custom voices added by user
        customVoices: []
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
    ttsModel: document.getElementById('ttsModel'),
    
    // Voice settings (will be created dynamically)
    voiceSettingsContainer: document.getElementById('voiceSettingsContainer'),
    
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
    // Reset marked text when original text changes
    state.markedText = '';
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
        
        if (!voiceId) {
            showToast('Please select a voice in Settings');
            openSettings();
            return;
        }
        
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
            return state.settings.selectedVoiceHindi;
        case 'en-IN':
            return state.settings.selectedVoiceEnglishIN;
        case 'pt-BR':
            return state.settings.selectedVoicePortuguese;
        default:
            return state.settings.selectedVoiceHindi;
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
// Feedback Processing - IMPROVED
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
    
    // Otherwise, use improved rule-based interpretation
    return interpretWithRules(sacredText, feedback, currentMarkup);
}

async function interpretWithClaude(sacredText, feedback, currentMarkup) {
    const systemPrompt = `You are a voice performance director for sacred text recordings.

Your job is to modify the performance markup of sacred text based on user feedback.

CRITICAL RULES:
1. NEVER change, add, or remove any words from the sacred text
2. Insert performance tags at SPECIFIC POSITIONS based on the feedback
3. Available tags: [reverent], [joyful], [sorrowful], [urgent], [whisper], [pause], [slow], [fast], [emphasis], [peaceful], [awe], [warning], [gentle], [strong]
4. Tags should be placed BEFORE the word or phrase they affect, not all at the beginning
5. If feedback mentions a specific word or phrase, place the tag right before that word/phrase
6. If feedback says "beginning", place tag at the start
7. If feedback says "end" or "ending", place tag before the last sentence/phrase
8. If feedback says "throughout" or "whole", you may place one tag at the beginning
9. Return ONLY the marked-up text, no explanation

EXAMPLES:
- Sacred: "In the beginning, God created the heavens and the earth."
- Feedback: "make 'heavens' more reverent"
- Output: In the beginning, God created the [reverent] heavens and the earth.

- Sacred: "In the beginning, God created the heavens and the earth."
- Feedback: "add a pause after heavens"
- Output: In the beginning, God created the heavens [pause] and the earth.

- Sacred: "In the beginning, God created the heavens and the earth."
- Feedback: "whisper at the end"
- Output: In the beginning, God created the heavens and [whisper] the earth.

- Sacred: "In the beginning, God created the heavens and the earth."
- Feedback: "make the whole thing joyful"
- Output: [joyful] In the beginning, God created the heavens and the earth.`;

    const baseText = currentMarkup || sacredText;
    
    const userMessage = `Sacred text: "${sacredText}"
${currentMarkup ? `Current markup: "${currentMarkup}"` : ''}
User feedback: "${feedback}"

Apply the feedback by placing tags at the appropriate positions. Return ONLY the marked-up text:`;

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
    // Use the current markup as base, or start with original text
    let result = currentMarkup || sacredText;
    const feedbackLower = feedback.toLowerCase();
    
    // Remove any existing tags to get clean text for analysis
    const cleanText = sacredText.replace(/\[[^\]]+\]/g, '').trim();
    const words = cleanText.split(/\s+/);
    
    // Determine which tag to apply
    const tagMappings = {
        'reverent': ['reverent', 'reverence', 'respectful', 'solemn', 'holy', 'sacred'],
        'joyful': ['joyful', 'happy', 'excited', 'celebration', 'joy', 'cheerful'],
        'sorrowful': ['sorrowful', 'sad', 'grief', 'lament', 'mourning', 'melancholy'],
        'urgent': ['urgent', 'pressing', 'hurry', 'important', 'critical'],
        'whisper': ['whisper', 'soft', 'quiet', 'gentle voice', 'softly'],
        'pause': ['pause', 'stop', 'break', 'wait', 'silence'],
        'slow': ['slow', 'slower', 'carefully', 'deliberate', 'drawn out'],
        'fast': ['fast', 'faster', 'quick', 'rapid', 'speed up'],
        'emphasis': ['emphasis', 'stress', 'highlight', 'emphasize', 'important'],
        'peaceful': ['peaceful', 'calm', 'serene', 'tranquil', 'restful'],
        'awe': ['awe', 'wonder', 'amazed', 'marvel', 'astonished']
    };
    
    // Find which tag to apply
    let tagToApply = null;
    for (const [tag, keywords] of Object.entries(tagMappings)) {
        if (keywords.some(kw => feedbackLower.includes(kw))) {
            tagToApply = tag;
            break;
        }
    }
    
    if (!tagToApply) {
        tagToApply = 'emphasis'; // Default
    }
    
    const tag = `[${tagToApply}]`;
    
    // Determine WHERE to place the tag
    // Check for position keywords
    const atBeginning = feedbackLower.includes('beginning') || feedbackLower.includes('start') || feedbackLower.includes('first');
    const atEnd = feedbackLower.includes('end') || feedbackLower.includes('ending') || feedbackLower.includes('last');
    const throughout = feedbackLower.includes('throughout') || feedbackLower.includes('whole') || feedbackLower.includes('entire') || feedbackLower.includes('all');
    
    // Check if feedback mentions specific words from the text
    let targetWord = null;
    let targetIndex = -1;
    
    // Look for quoted words or specific word mentions
    const quotedMatch = feedback.match(/['"]([^'"]+)['"]/);
    if (quotedMatch) {
        targetWord = quotedMatch[1].toLowerCase();
    }
    
    // Also check for "at X" or "before X" or "after X" patterns
    const atMatch = feedbackLower.match(/(?:at|before|near|around)\s+['"]?(\w+)['"]?/);
    if (atMatch && !targetWord) {
        targetWord = atMatch[1];
    }
    
    // Find the target word in the clean text
    if (targetWord) {
        const wordsLower = words.map(w => w.toLowerCase().replace(/[.,!?;:]/g, ''));
        targetIndex = wordsLower.findIndex(w => w.includes(targetWord) || targetWord.includes(w));
    }
    
    // Now apply the tag at the right position
    if (targetIndex >= 0) {
        // Insert tag before the specific word
        const resultWords = result.split(/\s+/);
        // Find corresponding position in result (which may have existing tags)
        let wordCount = 0;
        let insertPosition = 0;
        
        for (let i = 0; i < resultWords.length; i++) {
            if (!resultWords[i].startsWith('[')) {
                if (wordCount === targetIndex) {
                    insertPosition = i;
                    break;
                }
                wordCount++;
            }
        }
        
        resultWords.splice(insertPosition, 0, tag);
        result = resultWords.join(' ');
        
    } else if (atEnd) {
        // Find the last sentence or phrase
        const sentences = result.split(/(?<=[.!?।])\s+/);
        if (sentences.length > 1) {
            sentences[sentences.length - 1] = tag + ' ' + sentences[sentences.length - 1];
            result = sentences.join(' ');
        } else {
            // Single sentence - add before last few words
            const resultWords = result.split(/\s+/);
            const insertPos = Math.max(0, resultWords.length - 3);
            resultWords.splice(insertPos, 0, tag);
            result = resultWords.join(' ');
        }
        
    } else if (atBeginning || throughout) {
        // Add at the very beginning (but only if not already there with same tag)
        if (!result.startsWith(tag)) {
            result = tag + ' ' + result;
        }
        
    } else {
        // No clear position - add at beginning as default
        if (!result.startsWith(tag)) {
            result = tag + ' ' + result;
        }
    }
    
    // Clean up any double spaces
    result = result.replace(/\s+/g, ' ').trim();
    
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
// Settings Management - IMPROVED
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
    
    // Initialize with default voices if empty
    if (!state.settings.customVoices || state.settings.customVoices.length === 0) {
        state.settings.customVoices = [...CONFIG.defaultVoices];
    }
}

function saveSettings() {
    // Get values from form
    state.settings.elevenLabsKey = elements.elevenLabsKey.value.trim();
    state.settings.anthropicKey = elements.anthropicKey.value.trim();
    state.settings.ttsModel = elements.ttsModel.value;
    
    // Get selected voices
    const voiceHindiSelect = document.getElementById('voiceHindi');
    const voiceEnglishINSelect = document.getElementById('voiceEnglishIN');
    const voicePortugueseSelect = document.getElementById('voicePortuguese');
    
    if (voiceHindiSelect) state.settings.selectedVoiceHindi = voiceHindiSelect.value;
    if (voiceEnglishINSelect) state.settings.selectedVoiceEnglishIN = voiceEnglishINSelect.value;
    if (voicePortugueseSelect) state.settings.selectedVoicePortuguese = voicePortugueseSelect.value;
    
    // Get custom voices from the text area
    const customVoicesTextarea = document.getElementById('customVoicesTextarea');
    if (customVoicesTextarea) {
        const lines = customVoicesTextarea.value.trim().split('\n').filter(line => line.trim());
        const newCustomVoices = [];
        
        for (const line of lines) {
            // Parse format: "Voice Name | voice_id" or just "voice_id"
            const parts = line.split('|').map(p => p.trim());
            if (parts.length === 2) {
                newCustomVoices.push({ name: parts[0], id: parts[1] });
            } else if (parts.length === 1 && parts[0]) {
                newCustomVoices.push({ name: parts[0], id: parts[0] });
            }
        }
        
        if (newCustomVoices.length > 0) {
            state.settings.customVoices = newCustomVoices;
        }
    }
    
    // Save to localStorage
    localStorage.setItem('voicePerformanceStudioSettings', JSON.stringify(state.settings));
    
    closeSettings();
    showToast('Settings saved');
}

function openSettings() {
    // Populate form
    elements.elevenLabsKey.value = state.settings.elevenLabsKey || '';
    elements.anthropicKey.value = state.settings.anthropicKey || '';
    elements.ttsModel.value = state.settings.ttsModel;
    
    // Populate voice selectors
    populateVoiceSelectors();
    
    // Populate custom voices textarea
    const customVoicesTextarea = document.getElementById('customVoicesTextarea');
    if (customVoicesTextarea && state.settings.customVoices) {
        customVoicesTextarea.value = state.settings.customVoices
            .map(v => `${v.name} | ${v.id}`)
            .join('\n');
    }
    
    elements.settingsModal.classList.add('open');
}

function populateVoiceSelectors() {
    const voices = state.settings.customVoices || CONFIG.defaultVoices;
    
    const voiceOptions = voices.map(v => 
        `<option value="${v.id}">${v.name}</option>`
    ).join('');
    
    const voiceHindiSelect = document.getElementById('voiceHindi');
    const voiceEnglishINSelect = document.getElementById('voiceEnglishIN');
    const voicePortugueseSelect = document.getElementById('voicePortuguese');
    
    if (voiceHindiSelect) {
        voiceHindiSelect.innerHTML = voiceOptions;
        voiceHindiSelect.value = state.settings.selectedVoiceHindi || voices[0]?.id || '';
    }
    
    if (voiceEnglishINSelect) {
        voiceEnglishINSelect.innerHTML = voiceOptions;
        voiceEnglishINSelect.value = state.settings.selectedVoiceEnglishIN || voices[0]?.id || '';
    }
    
    if (voicePortugueseSelect) {
        voicePortugueseSelect.innerHTML = voiceOptions;
        voicePortugueseSelect.value = state.settings.selectedVoicePortuguese || voices[0]?.id || '';
    }
}

function closeSettings() {
    elements.settingsModal.classList.remove('open');
}

// ===================================
// Fetch ElevenLabs Voices
// ===================================

async function fetchElevenLabsVoices() {
    if (!state.settings.elevenLabsKey) {
        showToast('Please enter your ElevenLabs API key first');
        return;
    }
    
    try {
        showToast('Fetching your voices...');
        
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
                'xi-api-key': state.settings.elevenLabsKey
            }
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update custom voices
        state.settings.customVoices = data.voices.map(v => ({
            id: v.voice_id,
            name: v.name
        }));
        
        // Update the textarea
        const customVoicesTextarea = document.getElementById('customVoicesTextarea');
        if (customVoicesTextarea) {
            customVoicesTextarea.value = state.settings.customVoices
                .map(v => `${v.name} | ${v.id}`)
                .join('\n');
        }
        
        // Refresh voice selectors
        populateVoiceSelectors();
        
        showToast(`Found ${data.voices.length} voices!`);
        
    } catch (error) {
        console.error('Error fetching voices:', error);
        showToast(`Error: ${error.message}`);
    }
}

// Make it available globally for the button
window.fetchElevenLabsVoices = fetchElevenLabsVoices;

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
