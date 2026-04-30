
// ============================================================
// MÓDULO: SMARTFLOW RENDER v6.1 (Visual Effects & UI Bridge)
// Archivo: js/render.js
// ============================================================

const SmartFlowRender = (function() {
    // --- Recursos de Three.js (obtenidos del Core) ---
    let _composer = null;
    let _outlinePass = null;
    let _currentHighlighted = null;
    let _infoPanel = null;
    
    // --- Referencia al Core (se obtiene globalmente) ---
    let _core = null;
    
    // ==================== 1. CONFIGURACIÓN DE POST-PROCESADO ====================
    function setupEffects() {
        const scene = _core.getScene();
        const camera = _core.getCamera();
        const renderer = _core.getRenderer();
        if (!scene || !camera || !renderer) {
            console.warn("Render: Core no expone escena/cámara/renderer");
            return;
        }
        
        // Verificar que los complementos de post-procesado estén disponibles
        if (typeof THREE.EffectComposer !== 'undefined' && 
            typeof THREE.RenderPass !== 'undefined' && 
            typeof THREE.OutlinePass !== 'undefined') {
            
            _composer = new THREE.EffectComposer(renderer);
            const renderPass = new THREE.RenderPass(scene, camera);
            _composer.addPass(renderPass);
            
            _outlinePass = new THREE.OutlinePass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                scene, camera
            );
            _outlinePass.edgeStrength = 3;
            _outlinePass.edgeGlow = 0.6;
            _outlinePass.edgeThickness = 1.5;
            _outlinePass.pulsePeriod = 2;
            _outlinePass.visibleEdgeColor.setHex(0x00f2ff);  // cian brillante
            _outlinePass.hiddenEdgeColor.setHex(0x1e293b);
            _composer.addPass(_outlinePass);
            
            // Reemplazar el render loop del Core para usar el composer
            // Guardamos la función original si existe
            const originalAnimate = _core._animate;
            if (originalAnimate) {
                _core._animate = () => {
                    if (_core.getControls()) _core.getControls().update();
                    if (_composer) _composer.render();
                    requestAnimationFrame(_core._animate);
                };
            } else {
                // Si no hay animate guardado, creamos uno nuevo
                const animate = () => {
                    requestAnimationFrame(animate);
                    if (_core.getControls()) _core.getControls().update();
                    if (_composer) _composer.render();
                };
                animate();
            }
            console.log("✔ Efectos de post-procesado (Outline) configurados");
        } else {
            console.warn("Render: EffectComposer no disponible, usando render básico");
        }
    }
    
    // ==================== 2. RESALTADO DE SELECCIÓN ====================
    function updateSelectionHighlight() {
        const selected = _core.getSelected();
        
        if (_outlinePass) {
            // Usar outline pass
            if (selected && selected.obj) {
                const tag = selected.obj.tag;
                const mesh = _core.getVisualMesh(tag);
                if (mesh) {
                    _outlinePass.selectedObjects = [mesh];
                    _currentHighlighted = mesh;
                } else {
                    _outlinePass.selectedObjects = [];
                    _currentHighlighted = null;
                }
            } else {
                _outlinePass.selectedObjects = [];
                _currentHighlighted = null;
            }
        } else {
            // Fallback: cambiar material emisivo
            if (_currentHighlighted && _currentHighlighted.material) {
                _currentHighlighted.material.emissiveIntensity = 0;
            }
            if (selected && selected.obj) {
                const tag = selected.obj.tag;
                const mesh = _core.getVisualMesh(tag);
                if (mesh && mesh.material) {
                    mesh.material.emissiveIntensity = 0.5;
                    mesh.material.emissive = new THREE.Color(0x00f2ff);
                    _currentHighlighted = mesh;
                }
            } else {
                _currentHighlighted = null;
            }
        }
    }
    
    // ==================== 3. VISTAS PREDEFINIDAS (CÁMARA) ====================
    /**
     * Cambia la vista de la cámara a una posición predefinida.
     * @param {string} type - 'top', 'front', 'side', 'iso'
     */
    function setView(type) {
        const camera = _core.getCamera();
        const controls = _core.getControls();
        if (!camera) return;
        
        const distance = 8000;
        const target = new THREE.Vector3(0, 0, 0);
        
        switch(type) {
            case 'top':
                camera.position.set(0, distance, 0);
                break;
            case 'front':
                camera.position.set(0, 0, distance);
                break;
            case 'side':
                camera.position.set(distance, 0, 0);
                break;
            case 'iso':
                camera.position.set(distance, distance, distance);
                break;
            default:
                return;
        }
        camera.lookAt(target);
        if (controls) {
            controls.target.copy(target);
            controls.update();
        }
        _notifyUI(`Vista cambiada a: ${type.toUpperCase()}`, false);
    }
    
    // ==================== 4. PUENTE CON LA UI (PANEL DE INFORMACIÓN) ====================
    function createInfoPanel() {
        let panel = document.getElementById('selectionInfo');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'selectionInfo';
            panel.style.cssText = `
                position: fixed;
                bottom: 80px;
                right: 20px;
                background: rgba(15, 23, 42, 0.9);
                backdrop-filter: blur(8px);
                border: 1px solid #00f2ff;
                border-radius: 8px;
                padding: 12px;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                color: #e0e6ed;
                width: 280px;
                pointer-events: none;
                z-index: 1000;
                box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            `;
            document.body.appendChild(panel);
        }
        return panel;
    }
    
    function updateInfoPanel(selected) {
        if (!_infoPanel) _infoPanel = createInfoPanel();
        
        if (selected && selected.obj) {
            const obj = selected.obj;
            const pos = { x: obj.posX || 0, y: obj.posY || 0, z: obj.posZ || 0 };
            _infoPanel.innerHTML = `
                <div style="color: #00f2ff; font-weight: bold; border-bottom: 1px solid #334155; margin-bottom: 8px; padding-bottom: 4px;">
                    📌 ${obj.tag}
                </div>
                <div><span style="color:#94a3b8;">TIPO:</span> ${selected.type.toUpperCase()}</div>
                <div><span style="color:#94a3b8;">MATERIAL:</span> ${obj.material || 'N/A'}</div>
                <div><span style="color:#94a3b8;">DIÁMETRO:</span> ${obj.diameter || obj.diametro || '-'}"</div>
                <div><span style="color:#94a3b8;">POSICIÓN:</span> X:${Math.round(pos.x)} Y:${Math.round(pos.y)} Z:${Math.round(pos.z)}</div>
                ${obj.spec ? `<div><span style="color:#94a3b8;">SPEC:</span> ${obj.spec}</div>` : ''}
                ${obj.puertos ? `<div style="margin-top:6px;"><span style="color:#94a3b8;">PUERTOS:</span> ${obj.puertos.map(p => p.id).join(', ')}</div>` : ''}
            `;
        } else {
            _infoPanel.innerHTML = `
                <div style="color: #00f2ff; font-weight: bold; border-bottom: 1px solid #334155; margin-bottom: 8px;">
                    🔍 SIN SELECCIÓN
                </div>
                <div style="color:#94a3b8;">Haga clic en un equipo o tubería para ver sus propiedades técnicas.</div>
            `;
        }
    }
    
    function initUIBridge() {
        if (!_core) {
            console.warn("Render: Core no disponible para UI bridge");
            return;
        }
        _infoPanel = createInfoPanel();
        
        // Suscribirse al Core para actualizar el panel y el resaltado
        _core.subscribe(() => {
            const selected = _core.getSelected();
            updateInfoPanel(selected);
            updateSelectionHighlight();
        });
    }
    
    // ==================== 5. INICIALIZACIÓN ====================
    function init(coreInstance) {
        _core = coreInstance;
        if (!_core) {
            console.error("Render: se requiere una instancia del Core");
            return;
        }
        
        setupEffects();
        initUIBridge();
        
        // Añadir función global para vistas (opcional, para botones)
        window.set3DView = setView;
        
        console.log("✔ SmartFlowRender v6.1 listo (efectos visuales + UI)");
    }
    
    // ==================== 6. NOTIFICACIÓN INTERNA ====================
    function _notifyUI(msg, isErr) {
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) {
            statusEl.innerText = msg;
            statusEl.style.color = isErr ? '#ef4444' : '#00f2ff';
        }
        console.log(msg);
    }
    
    // ==================== API PÚBLICA ====================
    return {
        init: init,
        setView: setView,
        updateSelectionHighlight: updateSelectionHighlight,
        // Exponer composer y outline si se necesita acceso externo
        getComposer: () => _composer,
        getOutlinePass: () => _outlinePass
    };
})();
