
// ============================================================
// SMARTFLOW CORE v6.2 (Three.js + Reactivo + Desacoplado)
// Módulo principal - Archivo: js/core.js
// ============================================================

const SmartFlowCore = (function() {
    // --- Recursos Three.js ---
    let _scene = null;
    let _camera = null;
    let _renderer = null;
    let _controls = null;
    let _raycaster = null;
    let _mouse = null;
    let _container = null;
    
    // --- Estado de la aplicación (única fuente de verdad) ---
    let _db = {
        equipos: [],
        lines: [],
        metadata: { version: "6.2", lastModified: Date.now() }
    };
    
    // --- Mapa visual: tag -> objeto 3D (Mesh o Group) ---
    let _visualMap = new Map();
    
    // --- Selección actual ---
    let _selectedElement = null;
    
    // --- Historial (undo/redo) ---
    let _history = { past: [], future: [], maxSize: 50 };
    
    // --- Suscriptores a cambios (UI y otros módulos) ---
    let _subscribers = [];
    
    // --- Factoría visual (inyectada desde Catalog) ---
    let _visualFactory = null;
    
    // --- Timer para auto-guardado ---
    let _autoSaveTimer = null;
    
    // --- Funciones privadas ---
    
    // Clonación profunda (fallback a JSON si structuredClone no existe)
    const _deepClone = (obj) => {
        try {
            return structuredClone(obj);
        } catch(e) {
            return JSON.parse(JSON.stringify(obj));
        }
    };
    
    // Distancia euclidiana
    const _distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    
    // Guardar estado actual en el historial (antes de modificaciones)
    const _saveToHistory = () => {
        const state = _deepClone({ equipos: _db.equipos, lines: _db.lines });
        _history.past.push(state);
        if (_history.past.length > _history.maxSize) _history.past.shift();
        _history.future = [];
    };
    
    // Notificar a suscriptores y auto-guardar
    const _notify = () => {
        _db.metadata.lastModified = Date.now();
        _subscribers.forEach(cb => cb(_db));
        if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
        _autoSaveTimer = setTimeout(() => {
            localStorage.setItem('smartflow_project', JSON.stringify(_db));
        }, 500);
    };
    
    // Eliminar un objeto visual por su tag
    const _removeVisual = (tag) => {
        const obj = _visualMap.get(tag);
        if (obj && _scene) {
            _scene.remove(obj);
            _visualMap.delete(tag);
        }
    };
    
    // Reconstruir toda la escena visual a partir de _db (usando la factoría)
    const _refreshVisuals = () => {
        if (!_scene || !_visualFactory) return;
        // Eliminar todos los visuales actuales
        _visualMap.forEach(obj => _scene.remove(obj));
        _visualMap.clear();
        
        // Recrear equipos
        _db.equipos.forEach(eq => {
            try {
                const mesh = _visualFactory.createEquipmentMesh(eq);
                if (mesh) {
                    _scene.add(mesh);
                    _visualMap.set(eq.tag, mesh);
                }
            } catch(e) { console.warn(`Error visual equipo ${eq.tag}`, e); }
        });
        
        // Recrear líneas
        _db.lines.forEach(line => {
            try {
                const mesh = _visualFactory.createLineMesh(line);
                if (mesh) {
                    _scene.add(mesh);
                    _visualMap.set(line.tag, mesh);
                }
            } catch(e) { console.warn(`Error visual línea ${line.tag}`, e); }
        });
        
        _notify();
    };
    
    // Configurar el raycaster para selección de objetos
    const _setupRaycaster = () => {
        if (!_container) return;
        _container.addEventListener('click', (e) => {
            const rect = _container.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            _raycaster.setFromCamera(_mouse, _camera);
            const objects = Array.from(_visualMap.values());
            const intersects = _raycaster.intersectObjects(objects, true);
            if (intersects.length) {
                let hit = intersects[0].object;
                while (hit && !hit.userData.tag) hit = hit.parent;
                if (hit && hit.userData.tag) {
                    const tag = hit.userData.tag;
                    const eq = _db.equipos.find(e => e.tag === tag);
                    const line = _db.lines.find(l => l.tag === tag);
                    _selectedElement = eq ? { type: 'equipment', obj: eq } : line ? { type: 'line', obj: line } : null;
                    _notify();
                    return;
                }
            }
            _selectedElement = null;
            _notify();
        });
    };
    
    // --- API PÚBLICA ---
    return {
        // Inicialización del motor 3D dentro de un contenedor
        init: function(containerIdOrElement) {
            const container = typeof containerIdOrElement === 'string' 
                ? document.getElementById(containerIdOrElement)
                : containerIdOrElement;
            if (!container) throw new Error("Contenedor no encontrado");
            _container = container;
            
            // Escena
            _scene = new THREE.Scene();
            _scene.background = new THREE.Color(0x0f172a); // azul oscuro industrial
            
            // Cámara (perspectiva isométrica inicial)
            _camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 1000000);
            _camera.position.set(8000, 8000, 8000);
            
            // Renderer
            _renderer = new THREE.WebGLRenderer({ antialias: true });
            _renderer.setSize(container.clientWidth, container.clientHeight);
            _renderer.setPixelRatio(window.devicePixelRatio);
            container.appendChild(_renderer.domElement);
            
            // Controles orbitales
            _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
            _controls.enableDamping = true;
            _controls.dampingFactor = 0.05;
            _controls.rotateSpeed = 1.0;
            _controls.zoomSpeed = 1.2;
            _controls.panSpeed = 0.8;
            _controls.target.set(0, 0, 0);
            
            // Raycaster
            _raycaster = new THREE.Raycaster();
            _mouse = new THREE.Vector2();
            _setupRaycaster();
            
            // Iluminación profesional
            const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
            _scene.add(ambientLight);
            
            const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
            dirLight.position.set(5000, 10000, 5000);
            dirLight.castShadow = true;
            dirLight.receiveShadow = false;
            _scene.add(dirLight);
            
            const fillLight = new THREE.PointLight(0x4466cc, 0.5);
            fillLight.position.set(-2000, 2000, 3000);
            _scene.add(fillLight);
            
            // Grid de ingeniería (plano de referencia)
            const gridHelper = new THREE.GridHelper(20000, 40, 0x334155, 0x1e293b);
            _scene.add(gridHelper);
            
            // Bucle de animación
            const animate = () => {
                requestAnimationFrame(animate);
                if (_controls) _controls.update();
                if (_renderer && _scene && _camera) _renderer.render(_scene, _camera);
            };
            animate();
            
            // Cargar proyecto guardado en localStorage (si existe)
            const saved = localStorage.getItem('smartflow_project');
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    _db = data;
                    if (_visualFactory) _refreshVisuals();
                } catch(e) { console.warn("Error cargando proyecto previo", e); }
            }
            
            console.log("✔ SmartFlowCore v6.2 inicializado (Three.js)");
            _notify();
        },
        
        // Registrar la factoría visual (normalmente el Catálogo)
        registerVisualFactory: function(factory) {
            _visualFactory = factory;
            if (_db.equipos.length || _db.lines.length) _refreshVisuals();
        },
        
        // --- Gestión de equipos ---
        addEquipment: function(equipo) {
            if (_db.equipos.find(e => e.tag === equipo.tag)) return false;
            _db.equipos.push(equipo);
            if (_visualFactory) {
                const mesh = _visualFactory.createEquipmentMesh(equipo);
                if (mesh) {
                    _scene.add(mesh);
                    _visualMap.set(equipo.tag, mesh);
                }
            }
            _saveToHistory();
            _notify();
            return true;
        },
        
        updateEquipment: function(tag, updates) {
            const eq = _db.equipos.find(e => e.tag === tag);
            if (!eq) return false;
            Object.assign(eq, updates);
            _removeVisual(tag);
            if (_visualFactory) {
                const mesh = _visualFactory.createEquipmentMesh(eq);
                if (mesh) {
                    _scene.add(mesh);
                    _visualMap.set(tag, mesh);
                }
            }
            _saveToHistory();
            _notify();
            return true;
        },
        
        deleteEquipment: function(tag) {
            const idx = _db.equipos.findIndex(e => e.tag === tag);
            if (idx === -1) return false;
            _db.equipos.splice(idx, 1);
            _removeVisual(tag);
            _saveToHistory();
            _notify();
            return true;
        },
        
        // --- Gestión de líneas ---
        addLine: function(lineData) {
            const existingIdx = _db.lines.findIndex(l => l.tag === lineData.tag);
            if (existingIdx !== -1) {
                _db.lines[existingIdx] = { ..._db.lines[existingIdx], ...lineData };
            } else {
                _db.lines.push(lineData);
            }
            _removeVisual(lineData.tag);
            if (_visualFactory) {
                const mesh = _visualFactory.createLineMesh(lineData);
                if (mesh) {
                    _scene.add(mesh);
                    _visualMap.set(lineData.tag, mesh);
                }
            }
            _saveToHistory();
            _notify();
            return true;
        },
        
        updateLine: function(tag, updates) {
            const line = _db.lines.find(l => l.tag === tag);
            if (!line) return false;
            Object.assign(line, updates);
            _removeVisual(tag);
            if (_visualFactory) {
                const mesh = _visualFactory.createLineMesh(line);
                if (mesh) {
                    _scene.add(mesh);
                    _visualMap.set(tag, mesh);
                }
            }
            _saveToHistory();
            _notify();
            return true;
        },
        
        deleteLine: function(tag) {
            const idx = _db.lines.findIndex(l => l.tag === tag);
            if (idx === -1) return false;
            _db.lines.splice(idx, 1);
            _removeVisual(tag);
            _saveToHistory();
            _notify();
            return true;
        },
        
        // --- Limpiar todo el proyecto ---
        clearProject: function() {
            _visualMap.forEach(obj => _scene.remove(obj));
            _visualMap.clear();
            _db.equipos = [];
            _db.lines = [];
            _saveToHistory();
            _notify();
        },
        
        // --- Selección ---
        setSelected: function(selection) {
            _selectedElement = selection;
            _notify();
        },
        
        getSelected: function() {
            return _selectedElement;
        },
        
        // --- Consultas ---
        getDb: function() { return _db; },
        getEquipos: function() { return _db.equipos; },
        getLines: function() { return _db.lines; },
        
        // --- Exposición de recursos Three.js para otros módulos (Render, Router, etc.) ---
        getScene: function() { return _scene; },
        getCamera: function() { return _camera; },
        getRenderer: function() { return _renderer; },
        getControls: function() { return _controls; },
        getVisualMesh: function(tag) { return _visualMap.get(tag); },
        
        // --- Persistencia ---
        exportProject: function() {
            return JSON.stringify(_db);
        },
        
        importState: function(state) {
            if (!state || !state.equipos || !state.lines) return false;
            _visualMap.forEach(obj => _scene.remove(obj));
            _visualMap.clear();
            _db = _deepClone(state);
            if (_visualFactory) _refreshVisuals();
            _saveToHistory();
            _notify();
            return true;
        },
        
        // --- Suscripción a cambios (con cleanup) ---
        subscribe: function(callback) {
            _subscribers.push(callback);
            callback(_db);
            return () => { _subscribers = _subscribers.filter(cb => cb !== callback); };
        },
        
        // --- Undo / Redo ---
        undo: function() {
            if (_history.past.length <= 1) return false;
            const current = _deepClone({ equipos: _db.equipos, lines: _db.lines });
            _history.future.push(current);
            _history.past.pop();
            const prev = _history.past[_history.past.length - 1];
            return this.importState(prev);
        },
        
        redo: function() {
            if (_history.future.length === 0) return false;
            const next = _history.future.pop();
            return this.importState(next);
        },
        
        // --- Auditoría de modelo (básica) ---
        auditModel: function() {
            let report = "--- Auditoría SmartFlow 3D ---\n";
            let errors = 0;
            _db.lines.forEach(line => {
                const pts = line.points || line._cachedPoints;
                if (!pts || pts.length < 2) {
                    report += `⚠️ Línea ${line.tag} sin geometría.\n`;
                    errors++;
                }
            });
            if (errors === 0) report += "✅ Modelo íntegro sin errores geométricos.";
            return report;
        },
        
        // --- Métodos de compatibilidad con la versión anterior (2D) ---
        syncPhysicalData: function() {
            // En Three.js no es necesario recalcular puntos, pero mantenemos la API
            _notify();
        },
        
        getElevation: function() { return 0; },
        setElevation: function(level) { /* No op, se mantiene por compatibilidad */ }
    };
})();
