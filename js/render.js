
// ============================================================
// SMARTFLOW RENDER v6.3 (Zoom suave, focusOnObject y fitCameraToEquipments)
// Archivo: js/render.js
// ============================================================

const SmartFlowRender = (function() {
    // --- Recursos de Three.js (obtenidos del Core) ---
    let _composer = null;
    let _outlinePass = null;
    let _currentHighlighted = null;
    let _infoPanel = null;
    let _core = null;
    
    // --- Variables para animación de cámara ---
    let _isAnimating = false;
    let _targetPos = new THREE.Vector3();
    let _targetLookAt = new THREE.Vector3();
    const _transitionSpeed = 0.08;
    
    // ==================== 1. CONFIGURACIÓN DE POST-PROCESADO ====================
    function setupEffects() {
        const scene = _core.getScene();
        const camera = _core.getCamera();
        const renderer = _core.getRenderer();
        if (!scene || !camera || !renderer) {
            console.warn("Render: Core no expone escena/cámara/renderer");
            return;
        }
        
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
            _outlinePass.visibleEdgeColor.setHex(0x00f2ff);
            _outlinePass.hiddenEdgeColor.setHex(0x1e293b);
            _composer.addPass(_outlinePass);
            
            console.log("✔ Efectos de post-procesado (Outline) configurados");
        } else {
            console.warn("Render: EffectComposer no disponible, usando render básico");
        }
    }
    
    // ==================== 2. FUNCIÓN DE ENFOQUE (ZOOM-TO-FIT) ====================
    function focusOnObject(mesh) {
        if (!mesh || !_core.getControls()) return;
        const camera = _core.getCamera();
        const controls = _core.getControls();
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8;
        const direction = new THREE.Vector3().subVectors(camera.position, center).normalize();
        _targetPos.copy(center).add(direction.multiplyScalar(cameraZ));
        _targetLookAt.copy(center);
        _isAnimating = true;
    }
    
    // ==================== 3. FIT CAMERA TO ALL EQUIPMENTS (Zoom Extents) ====================
    function fitCameraToEquipments() {
        const scene = _core.getScene();
        const camera = _core.getCamera();
        const controls = _core.getControls();
        if (!scene || !camera || !controls) return;
        
        const bounds = new THREE.Box3();
        scene.traverse((child) => {
            if (child.isMesh && child.visible) {
                bounds.expandByObject(child);
            }
        });
        
        if (bounds.isEmpty()) {
            _notifyUI("No hay objetos en la escena", true);
            return;
        }
        
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let distance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
        
        const angleRad = 45 * (Math.PI / 180);
        const posX = center.x + distance * Math.sin(angleRad);
        const posZ = center.z + distance * Math.cos(angleRad);
        const posY = center.y + distance * 0.6;
        
        camera.position.set(posX, posY, posZ);
        controls.target.copy(center);
        controls.update();
        
        _notifyUI("Vista ajustada a todos los equipos", false);
    }
    
    // ==================== 4. RESALTADO DE SELECCIÓN ====================
    function updateSelectionHighlight() {
        const selected = _core.getSelected();
        
        if (_outlinePass) {
            if (selected && selected.obj) {
                const tag = selected.obj.tag;
                const mesh = _core.getVisualMesh(tag);
                if (mesh) {
                    _outlinePass.selectedObjects = [mesh];
                    _currentHighlighted = mesh;
                    focusOnObject(mesh);
                } else {
                    _outlinePass.selectedObjects = [];
                    _currentHighlighted = null;
                }
            } else {
                _outlinePass.selectedObjects = [];
                _currentHighlighted = null;
            }
        } else {
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
                    focusOnObject(mesh);
                }
            } else {
                _currentHighlighted = null;
            }
        }
    }
    
    // ==================== 5. VISTAS PREDEFINIDAS ====================
    function setView(type) {
        const camera = _core.getCamera();
        const controls = _core.getControls();
        if (!camera) return;
        const distance = 8000;
        const target = new THREE.Vector3(0, 0, 0);
        switch(type) {
            case 'top': camera.position.set(0, distance, 0); break;
            case 'front': camera.position.set(0, 0, distance); break;
            case 'side': camera.position.set(distance, 0, 0); break;
            case 'iso': camera.position.set(distance, distance, distance); break;
            default: return;
        }
        camera.lookAt(target);
        if (controls) {
            controls.target.copy(target);
            controls.update();
        }
        _notifyUI(`Vista cambiada a: ${type.toUpperCase()}`, false);
    }
    
    // ==================== 6. PUENTE CON LA UI (PANEL DE INFORMACIÓN) ====================
    function createInfoPanel() {
        let panel = document.getElementById('selectionInfo');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'selectionInfo';
            panel.style.cssText = `
                position: fixed; bottom: 80px; right: 20px;
                background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px);
                border: 1px solid #00f2ff; border-radius: 8px;
                padding: 12px; font-family: 'Courier New', monospace;
                font-size: 12px; color: #e0e6ed; width: 280px;
                pointer-events: none; z-index: 1000;
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
        if (!_core) return;
        _infoPanel = createInfoPanel();
        _core.subscribe(() => {
            const selected = _core.getSelected();
            updateInfoPanel(selected);
            updateSelectionHighlight();
        });
    }
    
    // ==================== 7. INICIALIZACIÓN CON ANIMACIÓN SUAVE ====================
    function init(coreInstance) {
        _core = coreInstance;
        if (!_core) return;
        setupEffects();
        initUIBridge();
        
        // Reemplazar el bucle de animación del Core para interpolar cámara
        const originalAnimate = _core.getAnimate();
        if (originalAnimate) {
            const newAnimate = () => {
                if (_isAnimating) {
                    const camera = _core.getCamera();
                    const controls = _core.getControls();
                    camera.position.lerp(_targetPos, _transitionSpeed);
                    controls.target.lerp(_targetLookAt, _transitionSpeed);
                    controls.update();
                    if (camera.position.distanceTo(_targetPos) < 1) {
                        _isAnimating = false;
                    }
                } else {
                    if (_core.getControls()) _core.getControls().update();
                }
                if (_composer) _composer.render();
                requestAnimationFrame(newAnimate);
            };
            _core.setAnimate(newAnimate);
        } else {
            console.warn("No se pudo reemplazar el bucle de animación del Core");
        }
        
        window.set3DView = setView;
        console.log("✔ SmartFlowRender v6.3 listo (zoom suave, focusOnObject y fitCameraToEquipments)");
    }
    
    // ==================== 8. NOTIFICACIÓN INTERNA ====================
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
        fitCameraToEquipments: fitCameraToEquipments,
        updateSelectionHighlight: updateSelectionHighlight,
        getComposer: () => _composer,
        getOutlinePass: () => _outlinePass
    };
})();
