
// ============================================================
// MÓDULO: SMARTFLOW RENDER v6.3 (Ultra-ligero, sin EffectComposer)
// Archivo: js/render.js
// ============================================================

const SmartFlowRender = (function() {
    let _core = null;
    let _currentHighlighted = null;
    let _infoPanel = null;
    let _originalMaterial = null; // guardar material original para restaurar

    // ------------------------------------------------------------
    // 1. RESALTADO DE SELECCIÓN (simple por material)
    // ------------------------------------------------------------
    function updateSelectionHighlight() {
        const selected = _core.getSelected();

        // Restaurar material anterior si existe
        if (_currentHighlighted && _currentHighlighted.material) {
            if (_originalMaterial) {
                _currentHighlighted.material = _originalMaterial;
                _originalMaterial = null;
            } else {
                _currentHighlighted.material.emissiveIntensity = 0;
                _currentHighlighted.material.emissive = new THREE.Color(0x000000);
            }
        }

        if (selected && selected.obj) {
            const tag = selected.obj.tag;
            const mesh = _core.getVisualMesh(tag);
            if (mesh && mesh.material) {
                // Guardar material original si es necesario
                if (!_originalMaterial && mesh.material) {
                    _originalMaterial = mesh.material.clone();
                }
                mesh.material.emissiveIntensity = 0.6;
                mesh.material.emissive = new THREE.Color(0x00f2ff);
                _currentHighlighted = mesh;
            }
        } else {
            _currentHighlighted = null;
        }
    }

    // ------------------------------------------------------------
    // 2. VISTAS PREDEFINIDAS
    // ------------------------------------------------------------
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
    }

    // ------------------------------------------------------------
    // 3. PANEL DE INFORMACIÓN FLOTANTE
    // ------------------------------------------------------------
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
        if (!_core) return;
        _infoPanel = createInfoPanel();
        _core.subscribe(() => {
            const selected = _core.getSelected();
            updateInfoPanel(selected);
            updateSelectionHighlight();
        });
    }

    // ------------------------------------------------------------
    // 4. INICIALIZACIÓN
    // ------------------------------------------------------------
    function init(coreInstance) {
        _core = coreInstance;
        if (!_core) return;
        initUIBridge();
        window.set3DView = setView;
        console.log("✔ SmartFlowRender v6.3 listo (sin post-procesado)");
    }

    return { init, setView, updateSelectionHighlight };
})();
