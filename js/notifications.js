
// ============================================================
// SMARTFLOW NOTIFICATION SYSTEM v2.0
// Archivo: js/notifications.js
// Toast, Historial, Sonidos, Voz configurable, Integración 3D
// ============================================================

const SmartFlowNotifications = (function() {
    
    // ================================================================
    // 1. CONFIGURACIÓN
    // ================================================================
    let _config = {
        // Toast
        toastEnabled: true,
        toastDuration: 4000,
        toastMaxVisible: 5,
        toastPosition: 'bottom-right',
        
        // Sonidos
        soundEnabled: true,
        soundVolume: 0.3,
        
        // Voz
        voiceEnabled: true,
        voiceRate: 1.1,
        voicePitch: 1.0,
        voiceLang: 'es-ES',
        voiceVolume: 0.7,
        
        // Consola
        consoleMaxLines: 500,
        consoleEnabled: true,
        
        // Indicadores visuales 3D
        show3DNotifications: true,
        notificationBillboardSize: 300,
        notification3DDuration: 3000,
        
        // Colores
        successColor: '#22c55e',
        errorColor: '#ef4444',
        warningColor: '#f59e0b',
        infoColor: '#00f2ff',
        auditColor: '#8b5cf6'
    };
    
    // ================================================================
    // 2. ESTADO INTERNO
    // ================================================================
    let _toastContainer = null;
    let _consoleContainer = null;
    let _consoleMessages = [];
    let _activeToasts = [];
    let _audioContext = null;
    let _synth = null;
    let _soundBuffers = {};
    let _renderer3D = null;
    let _threeBillboards = [];
    
    // Callback original (para no romper el existente)
    let _originalNotifyUI = null;
    let _originalVoiceFn = null;
    
    // ================================================================
    // 3. SÍNTESIS DE VOZ CONFIGURABLE
    // ================================================================
    
    function initSpeech() {
        if ('speechSynthesis' in window) {
            _synth = window.speechSynthesis;
            _synth.getVoices();
            _synth.onvoiceschanged = function() { _synth.getVoices(); };
        }
    }
    
    function speak(text, isError) {
        if (!_config.voiceEnabled || !_synth) return;
        
        _synth.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        const voices = _synth.getVoices();
        const spanishVoice = voices.find(function(v) { return v.lang.startsWith('es'); }) ||
                             voices.find(function(v) { return v.lang.startsWith('en'); });
        
        if (spanishVoice) utterance.voice = spanishVoice;
        utterance.rate = _config.voiceRate;
        utterance.pitch = isError ? 0.9 : _config.voicePitch;
        utterance.volume = _config.voiceVolume;
        utterance.lang = _config.voiceLang;
        
        _synth.speak(utterance);
    }
    
    // ================================================================
    // 4. SISTEMA DE SONIDOS (Web Audio API)
    // ================================================================
    
    function initAudio() {
        try {
            _audioContext = new (window.AudioContext || window.webkitAudioContext)();
            generateDefaultSounds();
        } catch (e) {
            console.warn('Web Audio API no disponible:', e);
            _config.soundEnabled = false;
        }
    }
    
    function generateDefaultSounds() {
        if (!_audioContext) return;
        
        _soundBuffers.success = createToneBuffer([523.25, 659.25, 783.99], 0.08);
        _soundBuffers.error = createToneBuffer([200, 150], 0.15, 'sawtooth');
        _soundBuffers.warning = createToneBuffer([440, 440], 0.06);
        _soundBuffers.click = createToneBuffer([800], 0.02, 'sine');
    }
    
    function createToneBuffer(frequencies, duration, type) {
        if (!_audioContext) return null;
        
        type = type || 'sine';
        const sampleRate = _audioContext.sampleRate;
        const totalSamples = Math.floor(sampleRate * duration * frequencies.length);
        const buffer = _audioContext.createBuffer(1, totalSamples, sampleRate);
        const data = buffer.getChannelData(0);
        
        frequencies.forEach(function(freq, noteIndex) {
            const startSample = Math.floor(noteIndex * sampleRate * duration);
            const endSample = Math.floor((noteIndex + 1) * sampleRate * duration);
            
            for (let i = startSample; i < endSample && i < totalSamples; i++) {
                const t = (i - startSample) / sampleRate;
                const envelope = Math.max(0, 1 - t / duration);
                
                if (type === 'sawtooth') {
                    data[i] = (2 * (freq * t % 1) - 1) * envelope * 0.3;
                } else if (type === 'square') {
                    data[i] = (Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1) * envelope * 0.2;
                } else {
                    data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4;
                }
            }
        });
        
        return buffer;
    }
    
    function playSound(buffer) {
        if (!_config.soundEnabled || !_audioContext || !buffer) return;
        
        if (_audioContext.state === 'suspended') _audioContext.resume();
        
        const source = _audioContext.createBufferSource();
        source.buffer = buffer;
        
        const gainNode = _audioContext.createGain();
        gainNode.gain.value = _config.soundVolume;
        
        source.connect(gainNode);
        gainNode.connect(_audioContext.destination);
        source.start(0);
    }
    
    // ================================================================
    // 5. TOASTS VISUALES
    // ================================================================
    
    function createToastContainer() {
        if (_toastContainer) return;
        
        _toastContainer = document.createElement('div');
        _toastContainer.id = 'sf-toast-container';
        _toastContainer.style.cssText = [
            'position: fixed;',
            'z-index: 10000;',
            'pointer-events: none;',
            'display: flex;',
            'flex-direction: column;',
            'gap: 8px;'
        ].join('');
        
        updateToastPosition();
        
        document.body.appendChild(_toastContainer);
    }
    
    function updateToastPosition() {
        if (!_toastContainer) return;
        
        const pos = _config.toastPosition;
        _toastContainer.style.top = pos.includes('top') ? '80px' : 'auto';
        _toastContainer.style.bottom = pos.includes('bottom') ? '20px' : 'auto';
        _toastContainer.style.left = pos.includes('left') ? '20px' : 'auto';
        _toastContainer.style.right = pos.includes('right') ? '20px' : 'auto';
        _toastContainer.style.alignItems = pos.includes('center') ? 'center' : 
                                           pos.includes('right') ? 'flex-end' : 'flex-start';
    }
    
    function showToast(message, type, duration) {
        if (!_config.toastEnabled) return;
        
        createToastContainer();
        
        const d = duration || _config.toastDuration;
        type = type || 'info';
        
        while (_activeToasts.length >= _config.toastMaxVisible) {
            const oldest = _activeToasts.shift();
            if (oldest && oldest.parentNode) oldest.remove();
        }
        
        const colors = {
            success: _config.successColor,
            error: _config.errorColor,
            warning: _config.warningColor,
            info: _config.infoColor,
            audit: _config.auditColor
        };
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            audit: '🔍'
        };
        
        const color = colors[type] || colors.info;
        const icon = icons[type] || icons.info;
        
        const toast = document.createElement('div');
        toast.className = 'sf-toast';
        
        toast.style.cssText = [
            'background: rgba(15, 15, 35, 0.95);',
            'border: 1px solid ' + color + ';',
            'border-left: 4px solid ' + color + ';',
            'border-radius: 8px;',
            'padding: 12px 16px;',
            'color: #e2e8f0;',
            'font-family: \'Inter\', \'Segoe UI\', monospace;',
            'font-size: 13px;',
            'max-width: 420px;',
            'backdrop-filter: blur(10px);',
            'box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 16px ' + color + '22;',
            'pointer-events: auto;',
            'animation: sf-slide-in 0.3s ease-out;',
            'transition: opacity 0.3s, transform 0.3s;',
            'display: flex;',
            'align-items: flex-start;',
            'gap: 10px;',
            'line-height: 1.4;'
        ].join('');
        
        toast.innerHTML = [
            '<span style="font-size: 16px; flex-shrink: 0;">' + icon + '</span>',
            '<span style="flex: 1; white-space: pre-wrap; word-break: break-word;">' + escapeHtml(message) + '</span>',
            '<button onclick="this.parentElement.remove()" style="background: none; border: none; color: #64748b; cursor: pointer; font-size: 18px; padding: 0; line-height: 1; flex-shrink: 0;" title="Cerrar">×</button>'
        ].join('');
        
        _toastContainer.appendChild(toast);
        _activeToasts.push(toast);
        
        setTimeout(function() {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(function() {
                if (toast.parentNode) {
                    toast.remove();
                    _activeToasts = _activeToasts.filter(function(t) { return t !== toast; });
                }
            }, 300);
        }, d);
        
        if (type === 'error') playSound(_soundBuffers.error);
        else if (type === 'warning') playSound(_soundBuffers.warning);
        else playSound(_soundBuffers.success);
        
        return toast;
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ================================================================
    // 6. CONSOLA DE HISTORIAL
    // ================================================================
    
    function createConsole() {
        if (_consoleContainer || !_config.consoleEnabled) return;
        
        _consoleContainer = document.createElement('div');
        _consoleContainer.id = 'sf-console';
        _consoleContainer.style.cssText = [
            'position: fixed;',
            'bottom: 20px;',
            'left: 20px;',
            'width: 500px;',
            'max-height: 200px;',
            'background: rgba(10, 10, 30, 0.9);',
            'border: 1px solid #334155;',
            'border-radius: 8px;',
            'overflow-y: auto;',
            'padding: 8px;',
            'font-family: \'JetBrains Mono\', \'Courier New\', monospace;',
            'font-size: 11px;',
            'z-index: 9999;',
            'display: none;'
        ].join('');
        
        document.addEventListener('keydown', function(e) {
            if (e.key === '`' && e.ctrlKey) {
                e.preventDefault();
                if (_consoleContainer) {
                    _consoleContainer.style.display = 
                        _consoleContainer.style.display === 'none' ? 'block' : 'none';
                }
            }
        });
        
        document.body.appendChild(_consoleContainer);
    }
    
    function addToConsole(message, type) {
        if (!_config.consoleEnabled) return;
        createConsole();
        
        type = type || 'info';
        
        const timestamp = new Date().toLocaleTimeString();
        const line = {
            timestamp: timestamp,
            message: message,
            type: type,
            id: Date.now()
        };
        
        _consoleMessages.push(line);
        if (_consoleMessages.length > _config.consoleMaxLines) {
            _consoleMessages.shift();
        }
        
        const colors = {
            success: '#22c55e',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#00f2ff',
            audit: '#8b5cf6'
        };
        
        const lineEl = document.createElement('div');
        lineEl.style.cssText = [
            'padding: 2px 4px;',
            'color: ' + (colors[type] || colors.info) + ';',
            'border-bottom: 1px solid #1e293b;',
            'white-space: pre-wrap;',
            'word-break: break-word;'
        ].join('');
        lineEl.textContent = '[' + timestamp + '] ' + message;
        
        if (_consoleContainer) {
            _consoleContainer.appendChild(lineEl);
            _consoleContainer.scrollTop = _consoleContainer.scrollHeight;
        }
    }
    
    // ================================================================
    // 7. NOTIFICACIONES 3D (Billboards)
    // ================================================================
    
    function show3DNotification(position, text, type) {
        if (!_config.show3DNotifications || !_renderer3D) return;
        
        const scene = _renderer3D.getScene();
        if (!scene) return;
        
        type = type || 'info';
        
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        const colors = {
            success: '#22c55e',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#00f2ff'
        };
        const color = colors[type] || colors.info;
        
        ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(10, 10, 492, 108, 12);
        } else {
            ctx.rect(10, 10, 492, 108);
        }
        ctx.fill();
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(10, 10, 492, 108, 12);
        } else {
            ctx.rect(10, 10, 492, 108);
        }
        ctx.stroke();
        
        ctx.fillStyle = color;
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        words.forEach(function(word) {
            const test = currentLine + word + ' ';
            if (ctx.measureText(test).width > 460) {
                lines.push(currentLine);
                currentLine = word + ' ';
            } else {
                currentLine = test;
            }
        });
        if (currentLine) lines.push(currentLine);
        
        lines.forEach(function(line, i) {
            ctx.fillText(line.trim(), 256, 40 + i * 30);
        });
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(material);
        
        const pos = position || { x: 0, y: 3000, z: 0 };
        sprite.position.set(pos.x, pos.y + 2000, pos.z);
        sprite.scale.set(_config.notificationBillboardSize, _config.notificationBillboardSize / 4, 1);
        
        scene.add(sprite);
        _threeBillboards.push({ sprite: sprite, addedAt: Date.now() });
        
        setTimeout(function() {
            scene.remove(sprite);
            texture.dispose();
            material.dispose();
            _threeBillboards = _threeBillboards.filter(function(b) { return b.sprite !== sprite; });
        }, _config.notification3DDuration);
    }
    
    function cleanup3DBillboards() {
        if (!_renderer3D) return;
        const scene = _renderer3D.getScene();
        if (!scene) return;
        
        const now = Date.now();
        _threeBillboards.forEach(function(b) {
            const age = now - b.addedAt;
            if (age > _config.notification3DDuration * 0.7) {
                b.sprite.material.opacity = 1 - (age - _config.notification3DDuration * 0.7) / (_config.notification3DDuration * 0.3);
            }
        });
    }
    
    // ================================================================
    // 8. NOTIFICACIÓN PRINCIPAL UNIFICADA
    // ================================================================
    
    function notify(message, type, options) {
        type = type || 'info';
        options = options || {};
        
        const shouldSpeak = options.speak !== undefined ? options.speak : true;
        const shouldToast = options.toast !== undefined ? options.toast : true;
        const shouldConsole = options.console !== undefined ? options.console : true;
        const shouldSound = options.sound !== undefined ? options.sound : true;
        const position3D = options.position3D || null;
        const show3D = options.show3D || false;
        
        // Detectar tipo por prefijos existentes
        let detectedType = type;
        if (message.startsWith('✅')) detectedType = 'success';
        else if (message.startsWith('❌')) detectedType = 'error';
        else if (message.startsWith('⚠️')) detectedType = 'warning';
        else if (message.startsWith('🔍')) detectedType = 'audit';
        
        // 1. Barra de estado (compatibilidad)
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) {
            statusEl.innerText = message;
            statusEl.style.color = detectedType === 'error' ? '#ef4444' : 
                                   detectedType === 'warning' ? '#f59e0b' : '#00f2ff';
        }
        
        // 2. Toast temporal
        if (shouldToast) {
            showToast(message, detectedType);
        }
        
        // 3. Consola de historial
        if (shouldConsole) {
            addToConsole(message, detectedType);
        }
        
        // 4. Voz
        if (shouldSpeak && _config.voiceEnabled) {
            speak(message, detectedType === 'error');
        }
        
        // 5. Sonido
        if (shouldSound) {
            if (detectedType === 'error') playSound(_soundBuffers.error);
            else if (detectedType === 'warning') playSound(_soundBuffers.warning);
            else if (detectedType === 'success') playSound(_soundBuffers.success);
            else playSound(_soundBuffers.click);
        }
        
        // 6. Notificación 3D
        if (show3D && position3D) {
            show3DNotification(position3D, message, detectedType);
        }
        
        // 7. Callback original si existe
        if (_originalNotifyUI) {
            _originalNotifyUI(message, detectedType === 'error');
        }
    }
    
    // ================================================================
    // 9. INICIALIZACIÓN
    // ================================================================
    
    function init(config) {
        if (config && typeof config === 'object') {
            for (const key in config) {
                if (config.hasOwnProperty(key) && _config.hasOwnProperty(key)) {
                    _config[key] = config[key];
                }
            }
        }
        
        initSpeech();
        initAudio();
        createToastContainer();
        createConsole();
        
        addGlobalStyles();
        
        console.log('SmartFlowNotifications v2.0 inicializado');
    }
    
    function addGlobalStyles() {
        if (document.getElementById('sf-notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'sf-notification-styles';
        style.textContent = [
            '@keyframes sf-slide-in {',
            '  from { opacity: 0; transform: translateX(100px) scale(0.9); }',
            '  to { opacity: 1; transform: translateX(0) scale(1); }',
            '}',
            '',
            '.sf-toast:hover {',
            '  transform: scale(1.02) !important;',
            '  box-shadow: 0 12px 40px rgba(0,0,0,0.5) !important;',
            '}',
            '',
            '#sf-console::-webkit-scrollbar { width: 6px; }',
            '#sf-console::-webkit-scrollbar-track { background: transparent; }',
            '#sf-console::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }'
        ].join('\n');
        document.head.appendChild(style);
    }
    
    function hookIntoExisting(originalNotifyUI, originalVoiceFn) {
        _originalNotifyUI = originalNotifyUI;
        _originalVoiceFn = originalVoiceFn;
    }
    
    function setRenderer3D(renderer) {
        _renderer3D = renderer;
    }
    
    // ================================================================
    // 10. API PÚBLICA
    // ================================================================
    
    return {
        init: init,
        notify: notify,
        hookIntoExisting: hookIntoExisting,
        setRenderer3D: setRenderer3D,
        
        // Toast
        showToast: showToast,
        
        // Voz
        speak: speak,
        setVoiceConfig: function(rate, pitch, lang) {
            _config.voiceRate = rate;
            _config.voicePitch = pitch;
            _config.voiceLang = lang;
        },
        toggleVoice: function(enabled) { _config.voiceEnabled = enabled; },
        
        // Sonidos
        playSound: playSound,
        toggleSound: function(enabled) { _config.soundEnabled = enabled; },
        setVolume: function(vol) { _config.soundVolume = vol; },
        
        // Consola
        getConsoleHistory: function() { return _consoleMessages.slice(); },
        clearConsole: function() {
            _consoleMessages = [];
            if (_consoleContainer) _consoleContainer.innerHTML = '';
        },
        showConsole: function() { if (_consoleContainer) _consoleContainer.style.display = 'block'; },
        hideConsole: function() { if (_consoleContainer) _consoleContainer.style.display = 'none'; },
        
        // 3D
        show3DNotification: show3DNotification,
        cleanup3DBillboards: cleanup3DBillboards,
        
        // Configuración
        setConfig: function(key, value) { _config[key] = value; },
        getConfig: function() { return _config; },
        
        // Limpieza
        dispose: function() {
            if (_toastContainer) _toastContainer.remove();
            if (_consoleContainer) _consoleContainer.remove();
            if (_synth) _synth.cancel();
            if (_audioContext) _audioContext.close();
        }
    };
})();
