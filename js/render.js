
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
```

---

📁 2. index.html simplificado (sin EffectComposer)

Copia este index.html completo. Asegúrate de que todas las rutas a tus módulos js sean correctas.

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>SmartEngp 3D | AcQuaBlue</title>
    
    <!-- Three.js básico + OrbitControls (sin post-procesado) -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    
    <!-- Librerías de exportación -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    
    <style>
        :root { --primary-bg: #0a0e17; --panel-bg: rgba(20,28,45,0.95); --accent-cyan: #00f2ff; --accent-blue: #1e4eb8; --text-main: #e0e6ed; --toolbar-bg: #0f172a; --button-bg: #1e293b; --button-border: #334155; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: var(--primary-bg); color: var(--text-main); height: 100vh; display: flex; flex-direction: column; overflow: hidden; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        /* Splash screen, welcome panel, toolbar, etc. - usa los mismos estilos que tenías en tu HTML original */
        /* Por brevedad, no duplico todos los estilos aquí, pero mantén los que ya funcionaban */
        /* Lo esencial: canvas-container debe ocupar el espacio restante */
        #canvas-container { flex: 1; background: #000; position: relative; overflow: hidden; }
        .toolbar { background: var(--toolbar-bg); padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid var(--accent-blue); }
        button { background: var(--button-bg); border: 1px solid var(--button-border); color: white; padding: 8px 14px; border-radius: 4px; cursor: pointer; }
        .btn-primary { background: #238636; }
        .property-panel { position: absolute; top: 20px; right: 20px; width: 280px; background: var(--panel-bg); border: 1px solid var(--accent-blue); border-radius: 8px; padding: 15px; z-index: 100; overflow-y: auto; transition: transform 0.3s; }
        .property-panel.hidden { transform: translateX(320px); }
        .command-panel { position: fixed; left: 10px; bottom: 10px; width: 90%; max-width: 500px; background: var(--panel-bg); border-radius: 12px; border: 1px solid var(--accent-cyan); z-index: 1000; display: none; }
        /* ... resto de estilos (los mismos que tenías) ... */
    </style>
</head>
<body>
    <!-- Splash, welcome panel, modal, toolbar, canvas-container, panels... 
         Copia exactamente el contenido del body desde tu index.html original, 
         pero asegúrate de que el canvas esté dentro de un div con id="canvas-container" -->
    
    <div id="canvas-container" class="canvas-container"></div>
    
    <!-- El resto de paneles (property, command, etc.) igual que antes -->
    
    <!-- Módulos de la app -->
    <script src="js/core.js"></script>
    <script src="js/catalog.js"></script>
    <script src="js/router.js"></script>
    <script src="js/render.js"></script>
    <script src="js/commands.js"></script>
    <script src="js/accessibility.js"></script>
    <script src="js/autocomplete.js"></script>
    <script src="js/io.js"></script>
    <script src="js/main.js"></script>
    
    <script>
        // Variables globales
        window.voiceEnabled = true;
        window.currentProjectName = "Proyecto_SmartEngp3D";
        function setElevation(level) { if (SmartFlowCore && SmartFlowCore.setElevation) SmartFlowCore.setElevation(level); }
        function togglePanel(show) { const panel = document.getElementById('side-panel'); if (panel) { if (show) panel.classList.remove('hidden'); else panel.classList.add('hidden'); } }
        // ... resto de funciones auxiliares (igual que antes)
    </script>
</body>
</html>
