
// ============================================================
// SMARTFLOW ADAPTER v1.0 - Puente entre Core 2D y Render 3D
// Archivo: js/smartflow-adapter.js
// Cargar ANTES que core.js
// ============================================================

(function() {
    // Esperar a que SmartFlowCore esté definido
    const originalInit = window.SmartFlowCore?.init;
    
    // Variables para almacenar referencias 3D
    let _scene = null;
    let _camera = null;
    let _renderer = null;
    let _controls = null;
    let _animateFn = null;
    let _visualMeshes = new Map();
    let _visualFactory = null;
    
    // Métodos que agregaremos al core
    const extensions = {
        // Registro de fábrica visual (para catalog)
        registerVisualFactory: function(catalog) {
            _visualFactory = catalog;
            console.log('✅ Visual factory registrado en adapter');
        },
        
        getVisualFactory: function() {
            return _visualFactory;
        },
        
        // Registro de elementos visuales 3D
        registerVisuals: function(scene, camera, renderer, controls) {
            _scene = scene;
            _camera = camera;
            _renderer = renderer;
            _controls = controls;
            console.log('✅ Visuales 3D registrados en adapter');
        },
        
        getScene: function() { return _scene; },
        getCamera: function() { return _camera; },
        getRenderer: function() { return _renderer; },
        getControls: function() { return _controls; },
        
        setCamera: function(cam) {
            _camera = cam;
            if (_controls) _controls.object = cam;
        },
        
        setAnimate: function(fn) { 
            _animateFn = fn; 
        },
        
        getAnimate: function() { 
            return _animateFn; 
        },
        
        registerVisualMesh: function(tag, mesh) {
            _visualMeshes.set(tag, mesh);
        },
        
        getVisualMesh: function(tag) {
            return _visualMeshes.get(tag);
        },
        
        removeVisualMesh: function(tag) {
            _visualMeshes.delete(tag);
        },
        
        clearVisualMeshes: function() {
            _visualMeshes.clear();
        },
        
        getVisualMeshMap: function() {
            return _visualMeshes;
        }
    };
    
    // Aplicar extensiones cuando SmartFlowCore esté listo
    function applyExtensions() {
        if (window.SmartFlowCore) {
            // Agregar métodos al core existente
            for (const [key, fn] of Object.entries(extensions)) {
                if (typeof window.SmartFlowCore[key] !== 'function') {
                    window.SmartFlowCore[key] = fn;
                }
            }
            console.log('✅ Adapter: Métodos 3D agregados al Core');
        } else {
            // Esperar a que core cargue
            setTimeout(applyExtensions, 100);
        }
    }
    
    // Iniciar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyExtensions);
    } else {
        applyExtensions();
    }
})();
```

---

📁 Orden de carga en index.html (CRÍTICO)

```html
<!-- PRIMERO: El adapter (puente) -->
<script src="js/smartflow-adapter.js"></script>

<!-- LUEGO: Tu core 2D original (sin modificar) -->
<script src="js/core.js"></script>

<!-- DESPUÉS: Los demás módulos -->
<script src="js/catalog.js"></script>
<script src="js/router.js"></script>
<script src="js/render.js"></script>
<script src="js/commands.js"></script>
<script src="js/accessibility.js"></script>
<script src="js/autocomplete.js"></script>
<script src="js/labels.js"></script>
<script src="js/io.js"></script>
<script src="js/main.js"></script>
```

---

✅ Ventajas de esta solución

Problema Solución
registerVisualFactory no existe El adapter lo agrega
getScene/getCamera no existen El adapter los provee
Tu core 2D se rompe si lo modificas No lo modificas - el adapter lo extiende
Migración compleja Simple: solo agregas un archivo

---

🧪 Verificación

Después de implementar esto, abre la consola y verifica:

```javascript
// Deberían existir todos estos métodos
console.log(typeof SmartFlowCore.registerVisualFactory);  // function
console.log(typeof SmartFlowCore.getScene);               // function
console.log(typeof SmartFlowCore.getCamera);              // function
console.log(typeof SmartFlowCore.getRenderer);            // function
