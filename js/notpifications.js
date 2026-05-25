
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
        toastDuration: 4000,          // ms que permanece visible
        toastMaxVisible: 5,          // máximo de toasts simultáneos
        toastPosition: 'bottom-right', // 'top-right', 'bottom-right', 'top-center'
        
        // Sonidos
        soundEnabled: true,
        soundVolume: 0.3,
        soundSuccess: null,           // AudioBuffer o URL
        soundError: null,
        soundWarning: null,
        soundClick: null,
        
        // Voz
        voiceEnabled: true,
        voiceRate: 1.1,              // Velocidad (0.5-2.0)
        voicePitch: 1.0,
        voiceLang: 'es-ES',          // Idioma por defecto
        voiceVolume: 0.7,
        
        // Consola
        consoleMaxLines: 500,        // Máximo de líneas en historial
        consoleEnabled: true,
        
        // Indicadores visuales 3D
        show3DNotifications: true,   // Mostrar notificaciones en viewport 3D
        notificationBillboardSize: 300, // Tamaño en mm del billboard 3D
        notification3DDuration: 3000,   // ms que dura en 3D
        
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
            // Precargar voces
            _synth.getVoices();
            _synth.onvoiceschanged = () => _synth.getVoices();
        }
    }
    
    function speak(text, isError = false) {
        if (!_config.voiceEnabled || !_synth) return;
        
        // Cancelar cualquier voz anterior
        _synth.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Buscar voz en español
        const voices = _synth.getVoices();
        const spanishVoice = voices.find(v => v.lang.startsWith('es')) ||
                             voices.find(v => v.lang.startsWith('en'));
        
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
        
        // Sonido de éxito: tono ascendente
        _soundBuffers.success = createToneBuffer([523.25, 659.25, 783.99], 0.08);
        
        // Sonido de error: tono descendente con distorsión
        _soundBuffers.error = createToneBuffer([200, 150], 0.15, 'sawtooth');
        
        // Sonido de advertencia: dos tonos
        _soundBuffers.warning = createToneBuffer([440, 440], 0.06);
        
        // Sonido de click
        _soundBuffers.click = createToneBuffer([800], 0.02, 'sine');
    }
    
    function createToneBuffer(frequencies, duration, type = 'sine') {
        if (!_audioContext) return null;
        
        const sampleRate = _audioContext.sampleRate;
        const totalSamples = Math.floor(sampleRate * duration * frequencies.length);
        const buffer = _audioContext.createBuffer(1, totalSamples, sampleRate);
        const data = buffer.getChannelData(0);
        
        frequencies.forEach((freq, noteIndex) => {
            const startSample = Math.floor(noteIndex * sampleRate * duration);
            const endSample = Math.floor((noteIndex + 1) * sampleRate * duration);
            
            for (let i = startSample; i < endSample && i < totalSamples; i++) {
                const t = (i - startSample) / sampleRate;
                const envelope = Math.max(0, 1 - t / duration);
                
                switch (type) {
                    case 'sawtooth':
                        data[i] = (2 * (freq * t % 1) - 1) * envelope * 0.3;
                        break;
                    case 'square':
                        data[i] = (Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1) * envelope * 0.2;
                        break;
                    default:
                        data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4;
                }
            }
        });
        
        return buffer;
    }
    
    function playSound(buffer) {
        if (!_config.soundEnabled || !_audioContext || !buffer) return;
        
        // Reanudar contexto si está suspendido
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
    // 5. TOASTS VISUALES (Notificaciones temporales)
    // ================================================================
    
    function createToastContainer() {
        if (_toastContainer) return;
        
        _toastContainer = document.createElement('div');
        _toastContainer.id = 'sf-toast-container';
        _toastContainer.style.cssText = `
            position: fixed;
            z-index: 10000;
            pointer-events: none;
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;
        
        // Posicionar según configuración
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
    
    function showToast(message, type = 'info', duration = null) {
        if (!_config.toastEnabled) return;
        
        createToastContainer();
        
        const d = duration || _config.toastDuration;
        
        // Limitar toasts visibles
        while (_activeToasts.length >= _config.toastMaxVisible) {
            const oldest = _activeToasts.shift();
            if (oldest && oldest.parentNode) oldest.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = 'sf-toast';
        
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
        
        toast.style.cssText = `
            background: rgba(15, 15, 35, 0.95);
            border: 1px solid ${color};
            border-left: 4px solid ${color};
            border-radius: 8px;
            padding: 12px 16px;
            color: #e2e8f0;
            font-family: 'Inter', 'Segoe UI', monospace;
            font-size: 13px;
            max-width: 420px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 16px ${color}22;
            pointer-events: auto;
            animation: sf-slide-in 0.3s ease-out;
            transition: opacity 0.3s, transform 0.3s;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            line-height: 1.4;
        `;
        
        toast.innerHTML = `
            <span style="font-size: 16px; flex-shrink: 0;">${icon}</span>
            <span style="flex: 1; white-space: pre-wrap; word-break: break-word;">${escapeHtml(message)}</span>
            <button onclick="this.parentElement.remove()" 
                    style="background: none; border: none; color: #64748b; cursor: pointer; 
                           font-size: 18px; padding: 0; line-height: 1; flex-shrink: 0;"
                    title="Cerrar">×</button>
        `;
        
        _toastContainer.appendChild(toast);
        _activeToasts.push(toast);
        
        // Auto-eliminar
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                    _activeToasts = _activeToasts.filter(t => t !== toast);
                }
            }, 300);
        }, d);
        
        // Sonido correspondiente
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
        _consoleContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 500px;
            max-height: 200px;
            background: rgba(10, 10, 30, 0.9);
            border: 1px solid #334155;
            border-radius: 8px;
            overflow-y: auto;
            padding: 8px;
            font-family: 'JetBrains Mono', 'Courier New', monospace;
            font-size: 11px;
            z-index: 9999;
            display: none;
        `;
        
        // Toggle con tecla `
        document.addEventListener('keydown', (e) => {
            if (e.key === '`' && e.ctrlKey) {
                e.preventDefault();
                _consoleContainer.style.display = 
                    _consoleContainer.style.display === 'none' ? 'block' : 'none';
            }
        });
        
        document.body.appendChild(_consoleContainer);
    }
    
    function addToConsole(message, type = 'info') {
        if (!_config.consoleEnabled) return;
        createConsole();
        
        const timestamp = new Date().toLocaleTimeString();
        const line = {
            timestamp,
            message,
            type,
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
        lineEl.style.cssText = `
            padding: 2px 4px;
            color: ${colors[type] || colors.info};
            border-bottom: 1px solid #1e293b;
            white-space: pre-wrap;
            word-break: break-word;
        `;
        lineEl.textContent = `[${timestamp}] ${message}`;
        
        if (_consoleContainer) {
            _consoleContainer.appendChild(lineEl);
            _consoleContainer.scrollTop = _consoleContainer.scrollHeight;
        }
    }
    
    // ================================================================
    // 7. NOTIFICACIONES 3D (Billboards en el viewport)
    // ================================================================
    
    function show3DNotification(position, text, type = 'info') {
        if (!_config.show3DNotifications || !_renderer3D) return;
        
        const scene = _renderer3D.getScene();
        if (!scene) return;
        
        // Crear sprite con canvas
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
        
        // Fondo
        ctx.fillStyle = 'rgba(10, 10, 30, 0.85)';
        ctx.beginPath();
        ctx.roundRect(10, 10, 492, 108, 12);
        ctx.fill();
        
        // Borde
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(10, 10, 492, 108, 12);
        ctx.stroke();
        
        // Texto
        ctx.fillStyle = color;
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Wrap text
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        words.forEach(word => {
            const test = currentLine + word + ' ';
            if (ctx.measureText(test).width > 460) {
                lines.push(currentLine);
                currentLine = word + ' ';
            } else {
                currentLine = test;
            }
        });
        if (currentLine) lines.push(currentLine);
        
        lines.forEach((line, i) => {
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
        _threeBillboards.push({ sprite, addedAt: Date.now() });
        
        // Auto-eliminar
        setTimeout(() => {
            scene.remove(sprite);
            texture.dispose();
            material.dispose();
            _threeBillboards = _threeBillboards.filter(b => b.sprite !== sprite);
        }, _config.notification3DDuration);
    }
    
    function cleanup3DBillboards() {
        if (!_renderer3D) return;
        const scene = _renderer3D.getScene();
        if (!scene) return;
        
        const now = Date.now();
        _threeBillboards.forEach(b => {
            // Efecto de fade out
            const age = now - b.addedAt;
            if (age > _config.notification3DDuration * 0.7) {
                b.sprite.material.opacity = 1 - (age - _config.notification3DDuration * 0.7) / (_config.notification3DDuration * 0.3);
            }
        });
    }
    
    // ================================================================
    // 8. NOTIFICACIÓN PRINCIPAL (Reemplaza notifyWithVoice)
    // ================================================================
    
    function notify(message, type = 'info', options = {}) {
        const {
            speak: shouldSpeak = true,
            toast: shouldToast = true,
            console: shouldConsole = true,
            sound: shouldSound = true,
            position3D = null,
            show3D = false
        } = options;
        
        // Determinar tipo por prefijos existentes
        let detectedType = type;
        if (message.startsWith('✅')) detectedType = 'success';
        else if (message.startsWith('❌')) detectedType = 'error';
        else if (message.startsWith('⚠️')) detectedType = 'warning';
        else if (message.startsWith('🔍')) detectedType = 'audit';
        
        // 1. Barra de estado (compatibilidad con sistema original)
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
        
        // 7. Llamar al callback original si existe
        if (_originalNotifyUI) {
            _originalNotifyUI(message, detectedType === 'error');
        }
    }
    
    // ================================================================
    // 9. INICIALIZACIÓN Y ENGANCHE CON SISTEMA EXISTENTE
    // ================================================================
    
    function init(config = {}) {
        Object.assign(_config, config);
        
        // Inicializar subsistemas
        initSpeech();
        initAudio();
        createToastContainer();
        createConsole();
        
        // Añadir estilos CSS globales
        addGlobalStyles();
        
        console.log('SmartFlowNotifications v2.0 inicializado');
    }
    
    function addGlobalStyles() {
        if (document.getElementById('sf-notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'sf-notification-styles';
        style.textContent = `
            @keyframes sf-slide-in {
                from { opacity: 0; transform: translateX(100px) scale(0.9); }
                to { opacity: 1; transform: translateX(0) scale(1); }
            }
            
            .sf-toast:hover {
                transform: scale(1.02) !important;
                box-shadow: 0 12px 40px rgba(0,0,0,0.5) !important;
            }
            
            #sf-console::-webkit-scrollbar {
                width: 6px;
            }
            #sf-console::-webkit-scrollbar-track {
                background: transparent;
            }
            #sf-console::-webkit-scrollbar-thumb {
                background: #334155;
                border-radius: 3px;
            }
            
            #sf-status-bar {
                transition: all 0.3s ease;
            }
        `;
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
        init,
        notify,
        hookIntoExisting,
        setRenderer3D,
        
        // Toast
        showToast,
        
        // Voz
        speak,
        setVoiceConfig: (rate, pitch, lang) => {
            _config.voiceRate = rate;
            _config.voicePitch = pitch;
            _config.voiceLang = lang;
        },
        toggleVoice: (enabled) => { _config.voiceEnabled = enabled; },
        
        // Sonidos
        playSound,
        toggleSound: (enabled) => { _config.soundEnabled = enabled; },
        setVolume: (vol) => { _config.soundVolume = vol; },
        
        // Consola
        getConsoleHistory: () => [..._consoleMessages],
        clearConsole: () => {
            _consoleMessages = [];
            if (_consoleContainer) _consoleContainer.innerHTML = '';
        },
        showConsole: () => { if (_consoleContainer) _consoleContainer.style.display = 'block'; },
        hideConsole: () => { if (_consoleContainer) _consoleContainer.style.display = 'none'; },
        
        // 3D
        show3DNotification,
        cleanup3DBillboards,
        
        // Configuración
        setConfig: (key, value) => { _config[key] = value; },
        getConfig: () => _config,
        
        // Limpieza
        dispose: () => {
            if (_toastContainer) _toastContainer.remove();
            if (_consoleContainer) _consoleContainer.remove();
            if (_synth) _synth.cancel();
            if (_audioContext) _audioContext.close();
        }
    };
})();
```

---

Cómo Integrarlo Sin Romper lo Existente

```javascript
// ============================================================
// En tu app.js o main.js - INTEGRACIÓN MÍNIMA
// ============================================================

// 1. Inicializar sistema de notificaciones
SmartFlowNotifications.init({
    toastEnabled: true,
    toastPosition: 'bottom-right',
    soundEnabled: true,
    voiceEnabled: true,
    voiceRate: 1.1,
    voiceLang: 'es-ES',
    show3DNotifications: true,
    consoleEnabled: true
});

// 2. Conectar con el render 3D
SmartFlowNotifications.setRenderer3D(SmartFlowRenderer3D);

// 3. Enganchar con el sistema existente SIN ROMPERLO
SmartFlowNotifications.hookIntoExisting(
    window._originalNotifyUI,  // si existe
    window._originalVoiceFn    // si existe
);

// 4. Wrapper para SmartFlowCommands que usa ambos sistemas
const originalNotifyWithVoice = window._notifyWithVoice;
window._notifyWithVoice = function(message, isError) {
    // Sistema original (barra de estado)
    if (originalNotifyWithVoice) originalNotifyWithVoice(message, isError);
    
    // Nuevo sistema (toast + sonido + voz + consola)
    SmartFlowNotifications.notify(message, isError ? 'error' : 'info', {
        sound: true,
        console: true
    });
};

// 5. Comando para mostrar/ocultar consola
// En tu intérprete de comandos:
// "console show" → SmartFlowNotifications.showConsole()
// "console hide" → SmartFlowNotifications.hideConsole()
```

---

Resumen del Sistema

Componente Función Tecnología
Toast Notificación temporal con animación CSS Animations + DOM
Voz Síntesis de voz configurable Web Speech API
Sonidos Feedback auditivo (éxito/error/warning) Web Audio API
Consola Historial persistente (Ctrl+`) DOM + Scroll
3D Billboard Notificación flotante en viewport Three.js Sprite
Barra estado Compatibilidad con sistema original #statusMsg

Todo esto no toca SmartFlowCore, SmartFlowCommands, SmartFlowCatalog ni SmartFlowRenderer3D. Es una capa independiente que se engancha mediante callbacks. Entiendo perfectamente. El etiquetado, cotas y dimensiones en isométricos de ingeniería no se renderizan en el espacio 3D como el resto de la geometría. Se trabaja en espacio de pantalla (screen space) o mediante un plano de anotación 2D superpuesto que se recalcula en cada frame.

Aquí está mi análisis como especialista:

---

El Problema Técnico

Aspecto Espacio 3D (Geometría) Espacio Anotación (Etiquetas/Cotas)
Coordenadas Mundo 3D (x, y, z) Pantalla 2D + profundidad
Perspectiva Afectado por cámara Siempre legible (billboard)
Oclusión Natural (depth test) Manual (debe evitar solaparse)
Escala Absoluta (mm) Relativa al viewport
Normas ISO No aplica ISO 10303, ANSI/ISA-5.1

---

Arquitectura de la Solución

```
┌─────────────────────────────────────────────────┐
│               RENDER LOOP                        │
│                                                  │
│  ┌──────────────┐    ┌──────────────────────────┐│
│  │ Escena 3D    │    │ Capa de Anotación 2D     ││
│  │ (Three.js)   │    │ (Canvas 2D / SVG Layer)  ││
│  │              │    │                          ││
│  │ • Tuberías   │    │ • Tags de equipo         ││
│  │ • Equipos    │    │ • Cotas de tubería       ││
│  │ • Válvulas   │    │ • Líneas de referencia   ││
│  │ • Sombras    │    │ • Tablas BOM             ││
│  └──────┬───────┘    └───────────┬──────────────┘│
│         │                        │               │
│         └────────┬───────────────┘               │
│                  ▼                                │
│         Canvas Composite (Z-index)                │
└─────────────────────────────────────────────────┘
```

---

Te entrego el Sistema de Anotaciones Isométricas completo, que trabaja sobre un Canvas 2D superpuesto al render 3D:

```javascript
// ============================================================
// SMARTFLOW ANNOTATION ENGINE v2.0
// Archivo: js/annotationEngine.js
// Etiquetado, Cotas y Dimensiones según normas ISA/ISO
// Capa 2D sobre el render 3D - No interfiere con geometría
// ============================================================

const SmartFlowAnnotations = (function() {
    
    // ================================================================
    // 1. REFERENCIAS
    // ================================================================
    let _core = null;
    let _renderer3D = null;
    let _catalog = null;
    
    // Canvas 2D para anotaciones
    let _annotationCanvas = null;
    let _ctx = null;
    let _container = null;
    
    // Datos de anotación
    let _equipmentLabels = new Map();    // tag → { position3D, label, style }
    let _pipeLabels = new Map();         // tag → [{ position3D, text, type }]
    let _dimensionLines = [];            // [{ from, to, value, unit }]
    let _callouts = [];                  // [{ position3D, text, leaderLine }]
    let _bomTable = null;               // Datos de tabla BOM en pantalla
    
    // Configuración de normas
    let _config = {
        // Norma de etiquetado
        standard: 'ISA',              // 'ISA', 'ISO', 'DIN', 'ANSI'
        
        // Estilos de texto
        fontFamily: 'monospace',
        fontSizeTag: 11,             // px para tags de equipo
        fontSizeDimension: 9,        // px para cotas
        fontSizeNote: 8,             // px para notas
        
        // Colores de anotación
        tagColor: '#00f2ff',         // Cian brillante para tags
        dimensionColor: '#ffd700',   // Dorado para cotas
        leaderColor: '#94a3b8',      // Gris para líneas guía
        backgroundColor: 'rgba(10, 10, 30, 0.85)', // Fondo de etiquetas
        bomBorderColor: '#334155',
        
        // Comportamiento
        billboardMode: true,          // Etiquetas siempre frente a cámara
        minLabelDistance: 500,       // Distancia mínima entre etiquetas (mm)
        maxDimensionLines: 100,      // Máximo de cotas visibles
        showBOM: true,               // Mostrar tabla BOM
        bomPosition: 'bottom-right', // Posición de tabla BOM
        dimensionUnit: 'mm',         // Unidad de cotas
        alternateUnit: 'in',         // Unidad alternativa
        dualDimension: false,        // Mostrar doble unidad
        
        // Tolerancias
        angularTolerance: 2,         // Grados para considerar alineado
        snapToGrid: 100,             // Grid para cotas (mm)
        
        // Capas toggleables
        showEquipmentTags: true,
        showPipeTags: true,
        showDimensions: true,
        showCallouts: true,
        showBOMTable: true,
        showFlowArrows: true,
        showElevationMarkers: true,
        showNorthArrow: true
    };
    
    // Estado interno
    let _isDirty = true;             // Recalcular en próximo frame
    let _animationFrameId = null;
    let _lastCameraMatrix = null;
    
    // ================================================================
    // 2. PROYECCIÓN 3D → 2D (Screen Space)
    // ================================================================
    
    function project3Dto2D(point3D) {
        if (!_renderer3D) return null;
        
        const camera = _renderer3D.getCamera();
        if (!camera) return null;
        
        const vector = new THREE.Vector3(point3D.x, point3D.y, point3D.z);
        vector.project(camera);
        
        const canvas = _annotationCanvas;
        if (!canvas) return null;
        
        return {
            x: (vector.x * 0.5 + 0.5) * canvas.width,
            y: (-vector.y * 0.5 + 0.5) * canvas.height,
            z: vector.z, // Profundidad para ordenamiento
            visible: vector.z < 1 // Delante de la cámara
        };
    }
    
    function isBehindCamera(point3D) {
        const camera = _renderer3D.getCamera();
        if (!camera) return true;
        
        const camPos = camera.position;
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        
        const toPoint = new THREE.Vector3(point3D.x, point3D.y, point3D.z).sub(camPos);
        return toPoint.dot(camDir) < 0;
    }
    
    // ================================================================
    // 3. GENERADORES DE ETIQUETAS SEGÚN NORMA
    // ================================================================
    
    function generateEquipmentTag(eq) {
        const standard = _config.standard;
        
        switch (standard) {
            case 'ISA':
                // ISA-5.1: TAG = Área-Tipo-Número
                return {
                    mainTag: eq.tag,
                    serviceDescription: eq.servicio || eq.tipo || '',
                    format: 'ISA-5.1',
                    line1: eq.tag,
                    line2: eq.servicio || '',
                    fontSize: _config.fontSizeTag
                };
            case 'ISO':
                // ISO 10628: Cuadro con divisiones
                return {
                    mainTag: eq.tag,
                    unitNumber: eq.area || '',
                    equipmentCode: eq.tipo?.toUpperCase() || '',
                    format: 'ISO-10628',
                    line1: eq.tag,
                    fontSize: _config.fontSizeTag
                };
            case 'DIN':
                return {
                    mainTag: eq.tag,
                    line1: eq.tag,
                    line2: `${eq.material || ''} ${eq.spec || ''}`,
                    fontSize: _config.fontSizeTag
                };
            default:
                return {
                    mainTag: eq.tag,
                    line1: eq.tag,
                    fontSize: _config.fontSizeTag
                };
        }
    }
    
    function generateLineTag(line) {
        return {
            mainTag: line.tag,
            line1: line.tag,
            line2: `${line.diameter || '?'}" ${line.spec || ''} ${line.material || ''}`,
            fontSize: _config.fontSizePipe || _config.fontSizeTag - 1
        };
    }
    
    function generateDimensionText(value, unit = 'mm') {
        if (_config.dualDimension) {
            const altValue = unit === 'mm' ? value / 25.4 : value * 25.4;
            const altUnit = unit === 'mm' ? 'in' : 'mm';
            return `${value.toFixed(0)} ${unit} [${altValue.toFixed(2)} ${altUnit}]`;
        }
        return `${value.toFixed(0)} ${unit}`;
    }
    
    // ================================================================
    // 4. DIBUJO DE ANOTACIONES (Canvas 2D)
    // ================================================================
    
    function drawRoundedRect(x, y, width, height, radius, fillColor, strokeColor, lineWidth = 1) {
        _ctx.save();
        _ctx.beginPath();
        _ctx.moveTo(x + radius, y);
        _ctx.lineTo(x + width - radius, y);
        _ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        _ctx.lineTo(x + width, y + height - radius);
        _ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        _ctx.lineTo(x + radius, y + height);
        _ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        _ctx.lineTo(x, y + radius);
        _ctx.quadraticCurveTo(x, y, x + radius, y);
        _ctx.closePath();
        
        if (fillColor) {
            _ctx.fillStyle = fillColor;
            _ctx.fill();
        }
        if (strokeColor) {
            _ctx.strokeStyle = strokeColor;
            _ctx.lineWidth = lineWidth;
            _ctx.stroke();
        }
        _ctx.restore();
    }
    
    function drawEquipmentLabel(screenPos, tagData, isSelected) {
        const padding = 6;
        const lineHeight = 14;
        const lines = [tagData.line1];
        if (tagData.line2) lines.push(tagData.line2);
        
        // Medir texto
        _ctx.font = `bold ${tagData.fontSize}px ${_config.fontFamily}`;
        let maxWidth = 0;
        lines.forEach(line => {
            const metrics = _ctx.measureText(line);
            if (metrics.width > maxWidth) maxWidth = metrics.width;
        });
        
        const boxWidth = maxWidth + padding * 2;
        const boxHeight = lines.length * lineHeight + padding * 2;
        
        // Posición centrada sobre el punto 3D
        let x = screenPos.x - boxWidth / 2;
        let y = screenPos.y - boxHeight - 15;
        
        // Evitar que salga del canvas
        const canvas = _annotationCanvas;
        x = Math.max(2, Math.min(x, canvas.width - boxWidth - 2));
        y = Math.max(2, Math.min(y, canvas.height - boxHeight - 2));
        
        // Línea guía desde el centro inferior al punto 3D
        _ctx.strokeStyle = _config.leaderColor;
        _ctx.lineWidth = 1;
        _ctx.setLineDash([2, 2]);
        _ctx.beginPath();
        _ctx.moveTo(x + boxWidth / 2, y + boxHeight);
        _ctx.lineTo(screenPos.x, screenPos.y);
        _ctx.stroke();
        _ctx.setLineDash([]);
        
        // Punto en la posición 3D
        _ctx.fillStyle = isSelected ? '#ffd700' : _config.tagColor;
        _ctx.beginPath();
        _ctx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
        _ctx.fill();
        
        // Caja de fondo
        const bgColor = isSelected ? 'rgba(255, 215, 0, 0.2)' : _config.backgroundColor;
        const borderColor = isSelected ? '#ffd700' : _config.tagColor;
        drawRoundedRect(x, y, boxWidth, boxHeight, 4, bgColor, borderColor, isSelected ? 2 : 1);
        
        // Texto
        _ctx.fillStyle = isSelected ? '#ffffff' : _config.tagColor;
        _ctx.font = `bold ${tagData.fontSize}px ${_config.fontFamily}`;
        _ctx.textAlign = 'left';
        _ctx.textBaseline = 'top';
        
        lines.forEach((line, i) => {
            _ctx.fillText(line, x + padding, y + padding + i * lineHeight);
        });
        
        return { x, y, width: boxWidth, height: boxHeight };
    }
    
    function drawPipeTag(screenPos, tagData) {
        const text = tagData.line1;
        _ctx.font = `${tagData.fontSize}px ${_config.fontFamily}`;
        const metrics = _ctx.measureText(text);
        const width = metrics.width + 8;
        const height = 14;
        
        const x = screenPos.x - width / 2;
        const y = screenPos.y - height - 8;
        
        drawRoundedRect(x, y, width, height, 3, _config.backgroundColor, _config.tagColor, 0.5);
        
        _ctx.fillStyle = _config.tagColor;
        _ctx.font = `${tagData.fontSize}px ${_config.fontFamily}`;
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText(text, screenPos.x, y + height / 2);
    }
    
    function drawDimensionLine(from2D, to2D, valueText, orientation) {
        const dx = to2D.x - from2D.x;
        const dy = to2D.y - from2D.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < 30) return; // Muy corto para dibujar
        
        // Offset para separar la cota de la geometría
        const offsetDist = 40;
        const perpX = -dy / dist * offsetDist;
        const perpY = dx / dist * offsetDist;
        
        const lineFromX = from2D.x + perpX;
        const lineFromY = from2D.y + perpY;
        const lineToX = to2D.x + perpX;
        const lineToY = to2D.y + perpY;
        
        // Líneas de extensión (witness lines)
        _ctx.strokeStyle = _config.dimensionColor;
        _ctx.lineWidth = 0.5;
        _ctx.setLineDash([]);
        
        // From witness
        _ctx.beginPath();
        _ctx.moveTo(from2D.x, from2D.y);
        _ctx.lineTo(lineFromX, lineFromY);
        _ctx.stroke();
        
        // To witness
        _ctx.beginPath();
        _ctx.moveTo(to2D.x, to2D.y);
        _ctx.lineTo(lineToX, lineToY);
        _ctx.stroke();
        
        // Línea de cota
        _ctx.strokeStyle = _config.dimensionColor;
        _ctx.lineWidth = 1;
        _ctx.beginPath();
        _ctx.moveTo(lineFromX, lineFromY);
        _ctx.lineTo(lineToX, lineToY);
        _ctx.stroke();
        
        // Flechas en extremos
        drawArrow(lineFromX, lineFromY, dx/dist * 10, dy/dist * 10, 6, _config.dimensionColor);
        drawArrow(lineToX, lineToY, -dx/dist * 10, -dy/dist * 10, 6, _config.dimensionColor);
        
        // Ticks (marcas) según norma
        drawTick(lineFromX, lineFromY, perpX, perpY, 8, _config.dimensionColor);
        drawTick(lineToX, lineToY, perpX, perpY, 8, _config.dimensionColor);
        
        // Texto de cota centrado
        const midX = (lineFromX + lineToX) / 2;
        const midY = (lineFromY + lineToY) / 2;
        
        _ctx.fillStyle = _config.backgroundColor;
        const textWidth = _ctx.measureText(valueText).width + 6;
        _ctx.fillRect(midX - textWidth/2, midY - 8, textWidth, 16);
        
        _ctx.fillStyle = _config.dimensionColor;
        _ctx.font = `${_config.fontSizeDimension}px ${_config.fontFamily}`;
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText(valueText, midX, midY);
    }
    
    function drawArrow(x, y, dx, dy, size, color) {
        _ctx.fillStyle = color;
        _ctx.beginPath();
        _ctx.moveTo(x, y);
        _ctx.lineTo(x - dx + dy * 0.5, y - dy - dx * 0.5);
        _ctx.lineTo(x - dx - dy * 0.5, y - dy + dx * 0.5);
        _ctx.closePath();
        _ctx.fill();
    }
    
    function drawTick(x, y, nx, ny, size, color) {
        _ctx.strokeStyle = color;
        _ctx.lineWidth = 1;
        _ctx.beginPath();
        _ctx.moveTo(x - nx * size * 0.5, y - ny * size * 0.5);
        _ctx.lineTo(x + nx * size * 0.5, y + ny * size * 0.5);
        _ctx.stroke();
    }
    
    function drawFlowArrow(from2D, to2D) {
        const midX = (from2D.x + to2D.x) / 2;
        const midY = (from2D.y + to2D.y) / 2;
        const dx = to2D.x - from2D.x;
        const dy = to2D.y - from2D.y;
        const len = Math.hypot(dx, dy) || 1;
        
        const arrowSize = 10;
        _ctx.fillStyle = '#00ff88';
        _ctx.strokeStyle = '#00ff88';
        _ctx.lineWidth = 1.5;
        
        _ctx.beginPath();
        _ctx.moveTo(midX, midY);
        _ctx.lineTo(
            midX - dx/len * arrowSize - dy/len * arrowSize * 0.5,
            midY - dy/len * arrowSize + dx/len * arrowSize * 0.5
        );
        _ctx.lineTo(
            midX - dx/len * arrowSize + dy/len * arrowSize * 0.5,
            midY - dy/len * arrowSize - dx/len * arrowSize * 0.5
        );
        _ctx.closePath();
        _ctx.fill();
    }
    
    // ================================================================
    // 5. TABLA BOM EN PANTALLA
    // ================================================================
    
    function drawBOMTable() {
        if (!_bomTable || !_config.showBOMTable) return;
        
        const canvas = _annotationCanvas;
        const tableWidth = 320;
        const rowHeight = 18;
        const headerHeight = 24;
        const padding = 8;
        const numRows = Math.min(_bomTable.length, 20);
        const tableHeight = headerHeight + numRows * rowHeight + padding * 2;
        
        // Posición según configuración
        let tableX, tableY;
        switch (_config.bomPosition) {
            case 'top-left':
                tableX = 10; tableY = 10; break;
            case 'top-right':
                tableX = canvas.width - tableWidth - 10; tableY = 10; break;
            case 'bottom-left':
                tableX = 10; tableY = canvas.height - tableHeight - 10; break;
            case 'bottom-right':
            default:
                tableX = canvas.width - tableWidth - 10;
                tableY = canvas.height - tableHeight - 10;
        }
        
        // Fondo
        drawRoundedRect(tableX, tableY, tableWidth, tableHeight, 6, 
            'rgba(10, 10, 35, 0.92)', _config.bomBorderColor, 1);
        
        // Título
        _ctx.fillStyle = '#ffffff';
        _ctx.font = `bold 11px ${_config.fontFamily}`;
        _ctx.textAlign = 'left';
        _ctx.fillText('LISTA DE MATERIALES (BOM)', tableX + padding, tableY + padding + 14);
        
        // Encabezados
        const colX = [tableX + padding, tableX + 80, tableX + 180, tableX + 240];
        _ctx.fillStyle = _config.tagColor;
        _ctx.font = `bold 8px ${_config.fontFamily}`;
        _ctx.fillText('ITEM', colX[0], tableY + headerHeight + 4);
        _ctx.fillText('DESCRIPCIÓN', colX[1], tableY + headerHeight + 4);
        _ctx.fillText('CANT', colX[2], tableY + headerHeight + 4);
        _ctx.fillText('UNIDAD', colX[3], tableY + headerHeight + 4);
        
        // Línea separadora
        _ctx.strokeStyle = _config.bomBorderColor;
        _ctx.lineWidth = 0.5;
        _ctx.beginPath();
        _ctx.moveTo(tableX + padding, tableY + headerHeight + 10);
        _ctx.lineTo(tableX + tableWidth - padding, tableY + headerHeight + 10);
        _ctx.stroke();
        
        // Filas
        _ctx.fillStyle = '#cbd5e1';
        _ctx.font = `8px ${_config.fontFamily}`;
        for (let i = 0; i < numRows; i++) {
            const item = _bomTable[i];
            const rowY = tableY + headerHeight + 12 + (i + 1) * rowHeight;
            
            _ctx.fillText(item.item || (i + 1), colX[0], rowY);
            _ctx.fillText((item.desc || item.description || '').substring(0, 25), colX[1], rowY);
            _ctx.fillText(String(item.qty || item.quantity || ''), colX[2], rowY);
            _ctx.fillText(item.unit || item.unidad || 'und', colX[3], rowY);
        }
    }
    
    // ================================================================
    // 6. FLECHA NORTE Y MARCADORES DE ELEVACIÓN
    // ================================================================
    
    function drawNorthArrow() {
        if (!_config.showNorthArrow) return;
        
        const canvas = _annotationCanvas;
        const cx = 60;
        const cy = canvas.height - 60;
        const size = 30;
        
        // Círculo
        _ctx.strokeStyle = _config.dimensionColor;
        _ctx.lineWidth = 1.5;
        _ctx.beginPath();
        _ctx.arc(cx, cy, size, 0, Math.PI * 2);
        _ctx.stroke();
        
        // Flecha Norte
        _ctx.fillStyle = '#ff4444';
        _ctx.beginPath();
        _ctx.moveTo(cx, cy - size + 4);
        _ctx.lineTo(cx - 8, cy - 2);
        _ctx.lineTo(cx + 8, cy - 2);
        _ctx.closePath();
        _ctx.fill();
        
        // Flecha Sur (gris)
        _ctx.fillStyle = '#666666';
        _ctx.beginPath();
        _ctx.moveTo(cx, cy + size - 4);
        _ctx.lineTo(cx - 5, cy + 2);
        _ctx.lineTo(cx + 5, cy + 2);
        _ctx.closePath();
        _ctx.fill();
        
        // Etiqueta N
        _ctx.fillStyle = '#ffffff';
        _ctx.font = `bold 12px ${_config.fontFamily}`;
        _ctx.textAlign = 'center';
        _ctx.fillText('N', cx, cy - size - 8);
    }
    
    function drawElevationMarker(screenPos, elevation) {
        if (!_config.showElevationMarkers) return;
        
        const elText = `EL +${(elevation / 1000).toFixed(3)} m`;
        _ctx.font = `8px ${_config.fontFamily}`;
        const width = _ctx.measureText(elText).width + 10;
        
        _ctx.fillStyle = 'rgba(10, 10, 35, 0.85)';
        _ctx.fillRect(screenPos.x - width/2, screenPos.y - 20, width, 16);
        
        _ctx.strokeStyle = '#22d3ee';
        _ctx.lineWidth = 0.5;
        _ctx.strokeRect(screenPos.x - width/2, screenPos.y - 20, width, 16);
        
        _ctx.fillStyle = '#22d3ee';
        _ctx.textAlign = 'center';
        _ctx.fillText(elText, screenPos.x, screenPos.y - 8);
        
        // Símbolo de elevación: círculo con cruz
        _ctx.strokeStyle = '#22d3ee';
        _ctx.beginPath();
        _ctx.arc(screenPos.x, screenPos.y, 6, 0, Math.PI * 2);
        _ctx.stroke();
        _ctx.beginPath();
        _ctx.moveTo(screenPos.x - 4, screenPos.y);
        _ctx.lineTo(screenPos.x + 4, screenPos.y);
        _ctx.moveTo(screenPos.x, screenPos.y - 4);
        _ctx.lineTo(screenPos.x, screenPos.y + 4);
        _ctx.stroke();
    }
    
    // ================================================================
    // 7. RECOLECCIÓN DE DATOS DE ANOTACIÓN DESDE EL MODELO
    // ================================================================
    
    function collectAnnotations() {
        if (!_core) return;
        
        _equipmentLabels.clear();
        _pipeLabels.clear();
        _dimensionLines = [];
        _callouts = [];
        
        const db = _core.getDb();
        
        // 1. Etiquetas de equipos
        (db.equipos || []).forEach(eq => {
            const tagData = generateEquipmentTag(eq);
            const position3D = {
                x: eq.posX || 0,
                y: (eq.posY || 0) + (eq.altura || 1500) / 2 + 300,
                z: eq.posZ || 0
            };
            _equipmentLabels.set(eq.tag, { position3D, tagData, equipment: eq });
        });
        
        // 2. Etiquetas de tuberías
        (db.lines || []).forEach(line => {
            const pts = _core.getLinePoints(line) || line._cachedPoints || [];
            if (pts.length < 2) return;
            
            // Etiqueta en el punto medio
            const midIdx = Math.floor(pts.length / 2);
            const midPoint = pts[midIdx];
            
            const tagData = generateLineTag(line);
            _pipeLabels.set(line.tag, {
                position3D: midPoint,
                tagData,
                line: line
            });
            
            // Cotas entre puntos de cambio de dirección
            if (_config.showDimensions) {
                for (let i = 1; i < pts.length; i++) {
                    const dist = Math.hypot(
                        pts[i].x - pts[i-1].x,
                        pts[i].y - pts[i-1].y,
                        pts[i].z - pts[i-1].z
                    );
                    
                    if (dist > 100) { // Solo segmentos > 100mm
                        _dimensionLines.push({
                            from: pts[i-1],
                            to: pts[i],
                            value: dist,
                            unit: _config.dimensionUnit,
                            text: generateDimensionText(dist, _config.dimensionUnit),
                            orientation: Math.abs(pts[i].y - pts[i-1].y) > Math.abs(pts[i].x - pts[i-1].x) ? 'vertical' : 'horizontal',
                            line: line
                        });
                    }
                }
            }
            
            // Marcadores de elevación en cambios
            if (_config.showElevationMarkers) {
                for (let i = 1; i < pts.length; i++) {
                    if (Math.abs(pts[i].y - pts[i-1].y) > 500) {
                        _callouts.push({
                            position3D: pts[i],
                            text: `EL +${(pts[i].y/1000).toFixed(3)}m`,
                            type: 'elevation'
                        });
                    }
                }
            }
        });
        
        // 3. Tabla BOM
        _bomTable = collectBOMData();
    }
    
    function collectBOMData() {
        if (!_core) return [];
        
        const db = _core.getDb();
        const items = [];
        let itemNum = 1;
        
        // Equipos
        (db.equipos || []).forEach(eq => {
            items.push({
                item: itemNum++,
                desc: `${eq.tipo || 'EQUIPO'} ${eq.tag}`,
                qty: 1,
                unit: 'und'
            });
        });
        
        // Tuberías (agrupadas por diámetro y material)
        const pipeMap = new Map();
        (db.lines || []).forEach(line => {
            const pts = _core.getLinePoints(line) || line._cachedPoints || [];
            let totalLen = 0;
            for (let i = 0; i < pts.length - 1; i++) {
                totalLen += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            }
            if (totalLen > 0) {
                const key = `${line.diameter}" ${line.material || ''} ${line.spec || ''}`;
                if (pipeMap.has(key)) {
                    pipeMap.get(key).length += totalLen;
                } else {
                    pipeMap.set(key, { length: totalLen, dia: line.diameter, mat: line.material, spec: line.spec });
                }
            }
        });
        
        pipeMap.forEach((data, key) => {
            items.push({
                item: itemNum++,
                desc: `Tubo ${data.mat} ${data.dia}" ${data.spec}`,
                qty: (data.length / 1000).toFixed(2),
                unit: 'm'
            });
        });
        
        // Componentes
        const compCount = new Map();
        (db.lines || []).forEach(line => {
            if (line.components) {
                line.components.forEach(comp => {
                    const key = comp.type || comp.tipo || 'COMP';
                    compCount.set(key, (compCount.get(key) || 0) + 1);
                });
            }
        });
        
        compCount.forEach((count, type) => {
            items.push({
                item: itemNum++,
                desc: type,
                qty: count,
                unit: 'und'
            });
        });
        
        return items;
    }
    
    // ================================================================
    // 8. RENDER LOOP DE ANOTACIONES
    // ================================================================
    
    function renderAnnotations() {
        if (!_ctx || !_annotationCanvas) return;
        
        const canvas = _annotationCanvas;
        _ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Verificar si la cámara se movió
        const camera = _renderer3D?.getCamera();
        if (camera) {
            const currentMatrix = camera.matrixWorldInverse.clone();
            if (_lastCameraMatrix && currentMatrix.equals(_lastCameraMatrix) && !_isDirty) {
                return; // No es necesario redibujar
            }
            _lastCameraMatrix = currentMatrix;
        }
        _isDirty = false;
        
        // Recolectar datos frescos
        collectAnnotations();
        
        // Ordenar por profundidad (z-buffer manual)
        const allLabels = [];
        
        // 1. Etiquetas de equipos
        if (_config.showEquipmentTags) {
            _equipmentLabels.forEach((data, tag) => {
                const screenPos = project3Dto2D(data.position3D);
                if (screenPos && screenPos.visible && !isBehindCamera(data.position3D)) {
                    allLabels.push({ ...data, screenPos, tag, type: 'equipment' });
                }
            });
        }
        
        // 2. Etiquetas de tuberías
        if (_config.showPipeTags) {
            _pipeLabels.forEach((data, tag) => {
                const screenPos = project3Dto2D(data.position3D);
                if (screenPos && screenPos.visible && !isBehindCamera(data.position3D)) {
                    allLabels.push({ ...data, screenPos, tag, type: 'pipe' });
                }
            });
        }
        
        // Ordenar por profundidad (más lejos primero)
        allLabels.sort((a, b) => a.screenPos.z - b.screenPos.z);
        
        // Evitar solapamiento
        const placedBoxes = [];
        const filteredLabels = [];
        
        allLabels.forEach(label => {
            const boxW = 120, boxH = 30;
            let overlaps = false;
            
            for (const box of placedBoxes) {
                if (Math.abs(label.screenPos.x - box.x) < boxW &&
                    Math.abs(label.screenPos.y - box.y) < boxH) {
                    overlaps = true;
                    break;
                }
            }
            
            if (!overlaps) {
                filteredLabels.push(label);
                placedBoxes.push({ x: label.screenPos.x, y: label.screenPos.y });
            }
        });
        
        // ─── DIBUJAR ──────────────────────────────────
        
        // 1. Cotas (debajo de todo)
        if (_config.showDimensions) {
            _dimensionLines.slice(0, _config.maxDimensionLines).forEach(dim => {
                const from2D = project3Dto2D(dim.from);
                const to2D = project3Dto2D(dim.to);
                if (from2D && to2D && from2D.visible && to2D.visible) {
                    drawDimensionLine(from2D, to2D, dim.text, dim.orientation);
                }
            });
        }
        
        // 2. Flechas de flujo
        if (_config.showFlowArrows) {
            _core.getDb().lines.forEach(line => {
                const pts = _core.getLinePoints(line) || [];
                if (pts.length >= 2) {
                    for (let i = 0; i < pts.length - 1; i++) {
                        const from2D = project3Dto2D(pts[i]);
                        const to2D = project3Dto2D(pts[i + 1]);
                        if (from2D && to2D && from2D.visible && to2D.visible) {
                            drawFlowArrow(from2D, to2D);
                        }
                    }
                }
            });
        }
        
        // 3. Marcadores de elevación
        if (_config.showElevationMarkers) {
            _callouts.forEach(callout => {
                const screenPos = project3Dto2D(callout.position3D);
                if (screenPos && screenPos.visible) {
                    drawElevationMarker(screenPos, callout.position3D.y);
                }
            });
        }
        
        // 4. Etiquetas de equipos
        filteredLabels.forEach(label => {
            if (label.type === 'equipment') {
                const isSelected = _renderer3D?.getSelected()?.obj?.tag === label.tag;
                drawEquipmentLabel(label.screenPos, label.tagData, isSelected);
            }
        });
        
        // 5. Etiquetas de tuberías
        filteredLabels.forEach(label => {
            if (label.type === 'pipe') {
                drawPipeTag(label.screenPos, label.tagData);
            }
        });
        
        // 6. Tabla BOM
        drawBOMTable();
        
        // 7. Flecha Norte
        drawNorthArrow();
    }
    
    function startAnnotationLoop() {
        function loop() {
            renderAnnotations();
            _animationFrameId = requestAnimationFrame(loop);
        }
        loop();
    }
    
    function stopAnnotationLoop() {
        if (_animationFrameId) {
            cancelAnimationFrame(_animationFrameId);
            _animationFrameId = null;
        }
    }
    
    // ================================================================
    // 9. INICIALIZACIÓN
    // ================================================================
    
    function init(container, coreInstance, renderer3DInstance, catalogInstance, config = {}) {
        _container = container;
        _core = coreInstance;
        _renderer3D = renderer3DInstance;
        _catalog = catalogInstance;
        
        Object.assign(_config, config);
        
        // Crear canvas 2D superpuesto
        _annotationCanvas = document.createElement('canvas');
        _annotationCanvas.id = 'annotation-layer';
        _annotationCanvas.style.position = 'absolute';
        _annotationCanvas.style.top = '0';
        _annotationCanvas.style.left = '0';
        _annotationCanvas.style.pointerEvents = 'none'; // No bloquear eventos 3D
        _annotationCanvas.style.zIndex = '10';
        
        // Ajustar tamaño al contenedor
        function resize() {
            _annotationCanvas.width = container.clientWidth;
            _annotationCanvas.height = container.clientHeight;
            _isDirty = true;
        }
        resize();
        window.addEventListener('resize', resize);
        
        container.appendChild(_annotationCanvas);
        _ctx = _annotationCanvas.getContext('2d');
        
        // Iniciar loop de anotaciones
        startAnnotationLoop();
        
        console.log('SmartFlowAnnotations inicializado - Capa 2D activa');
    }
    
    function markDirty() {
        _isDirty = true;
    }
    
    function dispose() {
        stopAnnotationLoop();
        if (_annotationCanvas && _annotationCanvas.parentNode) {
            _annotationCanvas.parentNode.removeChild(_annotationCanvas);
        }
        _annotationCanvas = null;
        _ctx = null;
    }
    
    // ================================================================
    // 10. API PÚBLICA
    // ================================================================
    
    return {
        init,
        markDirty,
        dispose,
        renderAnnotations,
        
        // Configuración
        setConfig: (key, value) => { 
            _config[key] = value; 
            _isDirty = true; 
        },
        getConfig: () => _config,
        
        // Capas
        toggleLayer: (layerName) => {
            const key = `show${layerName.charAt(0).toUpperCase() + layerName.slice(1)}`;
            if (_config[key] !== undefined) {
                _config[key] = !_config[key];
                _isDirty = true;
            }
        },
        
        // Normas
        setStandard: (standard) => {
            _config.standard = standard;
            _isDirty = true;
        },
        
        // Acceso
        getCanvas: () => _annotationCanvas,
        getContext: () => _ctx,
        
        // Recolección manual
        refreshBOM: () => {
            _bomTable = collectBOMData();
            _isDirty = true;
        }
    };
})();
```

---

Integración de los Tres Sistemas

```javascript
// ============================================================
// INTEGRACIÓN COMPLETA - js/app.js
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Inicializar Core
    SmartFlowCore.init(notifyUI, renderUI, updatePropertyPanel);
    
    // 2. Inicializar Catálogo
    // (SmartFlowCatalog ya está disponible como variable global)
    
    // 3. Inicializar Renderer 3D
    const container3D = document.getElementById('viewport-3d');
    
    SmartFlowRenderer3D.init(container3D, SmartFlowCore, SmartFlowCatalog, {
        enableShadows: true,
        enableAO: true,
        enableAA: true,
        isoAngle: 30
    });
    
    // 4. Inicializar Capa de Anotaciones 2D
    SmartFlowAnnotations.init(container3D, SmartFlowCore, SmartFlowRenderer3D, SmartFlowCatalog, {
        standard: 'ISA',
        showEquipmentTags: true,
        showPipeTags: true,
        showDimensions: true,
        showBOMTable: true,
        showFlowArrows: true,
        showNorthArrow: true,
        dualDimension: true,
        bomPosition: 'bottom-right'
    });
    
    // 5. Sincronizar selección
    SmartFlowRenderer3D.onSelection((selectionData) => {
        // La selección ya se comunica con el Core internamente
        SmartFlowAnnotations.markDirty(); // Redibujar etiquetas
    });
    
    // 6. Comandos de capas
    window.toggleAnnotations = (layer) => {
        SmartFlowAnnotations.toggleLayer(layer);
    };
    
    // 7. Exportar isométrico
    window.exportIsometric = () => {
        const canvas3D = SmartFlowRenderer3D.getRenderer().domElement;
        const canvas2D = SmartFlowAnnotations.getCanvas();
        
        // Combinar ambos canvas
        const combined = document.createElement('canvas');
        combined.width = canvas3D.width;
        combined.height = canvas3D.height;
        const ctx = combined.getContext('2d');
        ctx.drawImage(canvas3D, 0, 0);
        ctx.drawImage(canvas2D, 0, 0);
        
        const link = document.createElement('a');
        link.download = `Isometrico_${new Date().toISOString().slice(0,10)}.png`;
        link.href = combined.toDataURL('image/png');
        link.click();
    };
    
    console.log('SmartFlow Isométrico 3D + Anotaciones inicializado');
});
y
