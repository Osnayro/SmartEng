
// ============================================================
// SMARTFLOW CORE v6.5 (Expone _animate para render)
// Archivo: js/core.js
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
    
    // --- Estado de la aplicación ---
    let _db = {
        equipos: [],
        lines: [],
        metadata: { version: "6.5", lastModified: Date.now() }
    };
    
    // --- Mapa visual: tag -> objeto 3D ---
    let _visualMap = new Map();
    
    // --- Selección actual ---
    let _selectedElement = null;
    
    // --- Historial (undo/redo) ---
    let _history = { past: [], future: [], maxSize: 50 };
    
    // --- Suscriptores ---
    let _subscribers = [];
    
    // --- Factoría visual (inyectada desde Catalog) ---
    let _visualFactory = null;
    
    // --- Timer auto-guardado ---
    let _autoSaveTimer = null;
    
    // --- Función de animación (expuesta para modificaciones) ---
    let _animate = null;
    
    // -------------------- PRIVADAS --------------------
    const _deepClone = (obj) => {
        try { return structuredClone(obj); } catch(e) { return JSON.parse(JSON.stringify(obj)); }
    };
    
    const _dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
    
    const _saveToHistory = () => {
        const state = _deepClone({ equipos: _db.equipos, lines: _db.lines });
        _history.past.push(state);
        if (_history.past.length > _history.maxSize) _history.past.shift();
        _history.future = [];
    };
    
    const _notify = () => {
        _db.metadata.lastModified = Date.now();
        _subscribers.forEach(cb => cb(_db));
        if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
        _autoSaveTimer = setTimeout(() => {
            localStorage.setItem('smartflow_project', JSON.stringify(_db));
        }, 500);
    };
    
    const _removeVisual = (tag) => {
        const obj = _visualMap.get(tag);
        if (obj && _scene) { _scene.remove(obj); _visualMap.delete(tag); }
    };
    
    const _refreshVisuals = () => {
        if (!_scene || !_visualFactory) return;
        _visualMap.forEach(obj => _scene.remove(obj));
        _visualMap.clear();
        _db.equipos.forEach(eq => {
            try {
                const mesh = _visualFactory.createEquipmentMesh(eq);
                if (mesh) { _scene.add(mesh); _visualMap.set(eq.tag, mesh); }
            } catch(e) { console.warn(`Error visual equipo ${eq.tag}`, e); }
        });
        _db.lines.forEach(line => {
            try {
                const mesh = _visualFactory.createLineMesh(line);
                if (mesh) { _scene.add(mesh); _visualMap.set(line.tag, mesh); }
            } catch(e) { console.warn(`Error visual línea ${line.tag}`, e); }
        });
        _notify();
    };
    
    const _setupRaycaster = () => {
        if (!_container) return;
        _container.addEventListener('click', (e) => {
            const rect = _container.getBoundingClientRect();
            _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            _raycaster.setFromCamera(_mouse, _camera);
            const intersects = _raycaster.intersectObjects(Array.from(_visualMap.values()), true);
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
    
    // -------------------- API PÚBLICA --------------------
    return {
        // Inicialización
        init: function(containerIdOrElement) {
            const container = typeof containerIdOrElement === 'string' 
                ? document.getElementById(containerIdOrElement)
                : containerIdOrElement;
            if (!container) throw new Error("Contenedor no encontrado");
            _container = container;
            
            _scene = new THREE.Scene();
            _scene.background = new THREE.Color(0x0f172a);
            _camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 1000000);
            _camera.position.set(8000, 8000, 8000);
            _renderer = new THREE.WebGLRenderer({ antialias: true });
            _renderer.setSize(container.clientWidth, container.clientHeight);
            container.appendChild(_renderer.domElement);
            
            _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
            _controls.enableDamping = true;
            _controls.target.set(0, 0, 0);
            
            _raycaster = new THREE.Raycaster();
            _mouse = new THREE.Vector2();
            _setupRaycaster();
            
            // Iluminación
            const ambient = new THREE.AmbientLight(0x404040, 1.5);
            const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
            dirLight.position.set(5000, 10000, 5000);
            const fill = new THREE.PointLight(0x4466cc, 0.5);
            fill.position.set(-2000, 2000, 3000);
            _scene.add(ambient, dirLight, fill);
            _scene.add(new THREE.GridHelper(20000, 40, 0x334155, 0x1e293b));
            
            // Definir y exponer el bucle de animación
            _animate = () => {
                requestAnimationFrame(_animate);
                _controls.update();
                _renderer.render(_scene, _camera);
            };
            _animate(); // iniciar
            
            const saved = localStorage.getItem('smartflow_project');
            if (saved) try { _db = JSON.parse(saved); if (_visualFactory) _refreshVisuals(); } catch(e) {}
            console.log("✔ Core Three.js v6.5 listo");
            _notify();
        },
        
        // Exponer la función de animación para que otros módulos (ej. render) la modifiquen
        getAnimate: () => _animate,
        setAnimate: (fn) => { _animate = fn; fn(); },
        
        registerVisualFactory: function(factory) {
            _visualFactory = factory;
            if (_db.equipos.length || _db.lines.length) _refreshVisuals();
        },
        
        // --- Equipos ---
        addEquipment: function(eq) {
            if (_db.equipos.find(e => e.tag === eq.tag)) return false;
            _db.equipos.push(eq);
            if (_visualFactory) {
                const mesh = _visualFactory.createEquipmentMesh(eq);
                if (mesh) { _scene.add(mesh); _visualMap.set(eq.tag, mesh); }
            }
            _saveToHistory(); _notify();
            return true;
        },
        updateEquipment: function(tag, updates) {
            const eq = _db.equipos.find(e => e.tag === tag);
            if (!eq) return false;
            Object.assign(eq, updates);
            _removeVisual(tag);
            if (_visualFactory) {
                const mesh = _visualFactory.createEquipmentMesh(eq);
                if (mesh) { _scene.add(mesh); _visualMap.set(tag, mesh); }
            }
            _saveToHistory(); _notify();
            return true;
        },
        deleteEquipment: function(tag) {
            const idx = _db.equipos.findIndex(e => e.tag === tag);
            if (idx === -1) return false;
            _db.equipos.splice(idx, 1);
            _removeVisual(tag);
            _saveToHistory(); _notify();
            return true;
        },
        
        // --- Líneas ---
        addLine: function(line) {
            const idx = _db.lines.findIndex(l => l.tag === line.tag);
            if (idx !== -1) _db.lines[idx] = { ..._db.lines[idx], ...line };
            else _db.lines.push(line);
            _removeVisual(line.tag);
            if (_visualFactory) {
                const mesh = _visualFactory.createLineMesh(line);
                if (mesh) { _scene.add(mesh); _visualMap.set(line.tag, mesh); }
            }
            _saveToHistory(); _notify();
            return true;
        },
        updateLine: function(tag, updates) {
            const line = _db.lines.find(l => l.tag === tag);
            if (!line) return false;
            Object.assign(line, updates);
            _removeVisual(tag);
            if (_visualFactory) {
                const mesh = _visualFactory.createLineMesh(line);
                if (mesh) { _scene.add(mesh); _visualMap.set(tag, mesh); }
            }
            _saveToHistory(); _notify();
            return true;
        },
        deleteLine: function(tag) {
            const idx = _db.lines.findIndex(l => l.tag === tag);
            if (idx === -1) return false;
            _db.lines.splice(idx, 1);
            _removeVisual(tag);
            _saveToHistory(); _notify();
            return true;
        },
        
        // --- Puertos (CORREGIDO: usa _saveToHistory y _notify) ---
        updatePuerto: function(ownerTag, puertoId, cambios) {
            const owner = _db.equipos.find(e => e.tag === ownerTag) || _db.lines.find(l => l.tag === ownerTag);
            if (!owner) { console.warn(`Objeto ${ownerTag} no encontrado`); return false; }
            const puerto = owner.puertos?.find(p => p.id === puertoId);
            if (!puerto) { console.warn(`Puerto ${puertoId} no encontrado en ${ownerTag}`); return false; }
            
            if (cambios.pos) {
                puerto.relX = cambios.pos.x;
                puerto.relY = cambios.pos.y;
                puerto.relZ = cambios.pos.z;
            }
            if (cambios.diametro !== undefined) {
                puerto.diametro = cambios.diametro;
            }
            if (cambios.dir) {
                const len = Math.hypot(cambios.dir.dx, cambios.dir.dy, cambios.dir.dz);
                if (len > 0) {
                    puerto.orientacion = {
                        dx: cambios.dir.dx / len,
                        dy: cambios.dir.dy / len,
                        dz: cambios.dir.dz / len
                    };
                } else {
                    puerto.orientacion = { dx: 0, dy: 0, dz: 1 };
                }
            }
            if (cambios.status) puerto.status = cambios.status;
            if (cambios.connectedLine !== undefined) puerto.connectedLine = cambios.connectedLine;
            
            _saveToHistory();
            _notify();
            return true;
        },
        
        // --- Utilidades de proyecto ---
        clearProject: function() {
            _visualMap.forEach(obj => _scene.remove(obj));
            _visualMap.clear();
            _db.equipos = [];
            _db.lines = [];
            _saveToHistory(); _notify();
        },
        
        // --- Selección ---
        setSelected: function(selection) { _selectedElement = selection; _notify(); },
        getSelected: function() { return _selectedElement; },
        
        // --- Consultas ---
        getDb: function() { return _db; },
        getEquipos: function() { return _db.equipos; },
        getLines: function() { return _db.lines; },
        
        // --- Exposición de recursos Three.js ---
        getScene: () => _scene,
        getCamera: () => _camera,
        getRenderer: () => _renderer,
        getControls: () => _controls,
        getVisualMesh: (tag) => _visualMap.get(tag),
        
        // --- Persistencia ---
        exportProject: function() { return JSON.stringify(_db); },
        importState: function(state) {
            if (!state || !state.equipos || !state.lines) return false;
            _visualMap.forEach(obj => _scene.remove(obj));
            _visualMap.clear();
            _db = _deepClone(state);
            if (_visualFactory) _refreshVisuals();
            _saveToHistory(); _notify();
            return true;
        },
        
        // --- Suscripción ---
        subscribe: function(callback) {
            _subscribers.push(callback);
            callback(_db);
            return () => { _subscribers = _subscribers.filter(cb => cb !== callback); };
        },
        
        // --- Undo/Redo ---
        undo: function() {
            if (_history.past.length <= 1) return false;
            const current = _deepClone({ equipos: _db.equipos, lines: _db.lines });
            _history.future.push(current);
            _history.past.pop();
            const prev = _history.past[_history.past.length-1];
            return this.importState(prev);
        },
        redo: function() {
            if (_history.future.length === 0) return false;
            const next = _history.future.pop();
            return this.importState(next);
        },
        
        // --- Auditoría ---
        auditModel: function() {
            let report = "--- Auditoría SmartFlow ---\n";
            let errors = 0;
            _db.lines.forEach(line => {
                if (!line.points && !line._cachedPoints) {
                    report += `⚠️ Línea ${line.tag} sin geometría.\n`;
                    errors++;
                }
            });
            return errors === 0 ? "✅ Modelo íntegro." : report;
        },
        
        // --- SplitLine (para comando split) ---
        splitLine: function(lineTag, point, config = {}) {
            const line = _db.lines.find(l => l.tag === lineTag);
            if (!line) return null;
            let pts = line.points || line._cachedPoints;
            if (!pts || pts.length < 2) return null;
            let minDist = Infinity, insertIdx = -1;
            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i], b = pts[i+1];
                const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
                const ap = { x: point.x - a.x, y: point.y - a.y, z: point.z - a.z };
                const t = (ap.x*ab.x + ap.y*ab.y + ap.z*ab.z) / (ab.x*ab.x + ab.y*ab.y + ab.z*ab.z || 1);
                if (t >= 0 && t <= 1) {
                    const proj = { x: a.x + t*ab.x, y: a.y + t*ab.y, z: a.z + t*ab.z };
                    const d = _dist(point, proj);
                    if (d < minDist) { minDist = d; insertIdx = i+1; }
                }
            }
            if (insertIdx === -1) return null;
            pts.splice(insertIdx, 0, point);
            line.points = pts;
            line._cachedPoints = pts;
            this.updateLine(lineTag, { points: pts, _cachedPoints: pts });
            const teeTag = `TEE-${Date.now().slice(-6)}`;
            const teeComp = { type: 'TEE_EQUAL', tag: teeTag, param: insertIdx / (pts.length-1) };
            line.components = line.components || [];
            line.components.push(teeComp);
            this.updateLine(lineTag, { components: line.components });
            _notify();
            return { componente: teeComp, linea: line };
        },
        
        // --- Métodos de compatibilidad ---
        syncPhysicalData: function() { _notify(); },
        getElevation: () => 0,
        setElevation: (level) => {},
        _saveState: _saveToHistory
    };
})();
