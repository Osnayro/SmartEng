// ============================================================
// SMARTFLOW RENDER ENGINE v3.1 - Motor 3D Corregido
// Archivo: js/renderer3d.js
// Requiere: Three.js v0.157 cargado globalmente antes de este script
// Compatible: SmartFlowCore v5.5 + SmartFlowCatalog v4.0
// ============================================================

const SmartFlowRenderer3D = (function() {
    "use strict";
    
    // ================================================================
    // 0. VERIFICACIÓN DE DEPENDENCIA CRÍTICA
    // ================================================================
    if (typeof THREE === 'undefined') {
        console.error('❌ SmartFlowRenderer3D: THREE.js no está cargado.');
        console.error('   Asegúrese de incluir el CDN antes de este script:');
        console.error('   <script src="https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.min.js"></script>');
        console.error('   <script src="https://cdn.jsdelivr.net/npm/three@0.157.0/examples/js/controls/OrbitControls.js"></script>');
        
        // Devolver stub para evitar errores en cadena
        return {
            init: function() { return false; },
            rebuildScene: function() {},
            setView: function() {},
            setIsoView: function() {},
            focusOn: function() {},
            zoomToFit: function() {},
            deselectObject: function() {},
            getSelected: function() { return null; },
            onSelection: function() {},
            getScene: function() { return null; },
            getCamera: function() { return null; },
            getRenderer: function() { return null; },
            getControls: function() { return null; },
            setConfig: function() {},
            getConfig: function() { return {}; },
            dispose: function() {}
        };
    }
    
    // ================================================================
    // 1. REFERENCIAS Y ESTADO INTERNO
    // ================================================================
    let _core = null;
    let _catalog = null;
    
    // Three.js objects
    let _scene = null;
    let _camera = null;
    let _renderer = null;
    let _controls = null;
    let _container = null;
    
    // Iluminación
    let _ambientLight = null;
    let _directionalLight = null;
    let _hemisphereLight = null;
    
    // Gestión de objetos
    let _equipmentMeshes = new Map();    // tag → THREE.Group
    let _lineMeshes = new Map();         // tag → THREE.Group
    let _gridHelper = null;
    let _groundPlane = null;
    
    // Configuración
    let _config = {
        isoAngle: 30,
        cameraDistance: 20000,
        backgroundColor: 0x0a0e17,
        gridSize: 20000,
        gridDivisions: 40,
        enableShadows: true,
        pipeSegments: 24,
        flangeDetail: 20,
        valveDetail: 24
    };
    
    // Control de render loop
    let _renderLoopId = null;
    let _isRendering = false;
    let _needsBuild = true;
    let _initComplete = false;
    
    // Callbacks
    let _onSelectionCallback = null;
    
    // ================================================================
    // 2. MATERIALES PBR SIMPLIFICADOS
    // ================================================================
    
    function createSteelMaterial(color, roughness, metalness) {
        return new THREE.MeshStandardMaterial({
            color: color || 0x64748b,
            roughness: roughness !== undefined ? roughness : 0.35,
            metalness: metalness !== undefined ? metalness : 0.85
        });
    }
    
    function createPlasticMaterial(color) {
        return new THREE.MeshStandardMaterial({
            color: color || 0x7c3aed,
            roughness: 0.5,
            metalness: 0.1
        });
    }
    
    function createHighlightMaterial(color) {
        return new THREE.MeshStandardMaterial({
            color: color || 0xffd700,
            roughness: 0.3,
            metalness: 0.5,
            emissive: color || 0xffd700,
            emissiveIntensity: 0.3
        });
    }
    
    // ================================================================
    // 3. GENERADORES DE GEOMETRÍA
    // ================================================================
    
    /**
     * Crea un cilindro de tubería entre dos puntos 3D
     */
    function createPipeGeometry(start, end, diameter, specColor) {
        var dx = end.x - start.x;
        var dy = end.y - start.y;
        var dz = end.z - start.z;
        var length = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        if (length < 0.1) {
            return new THREE.Group(); // Evitar geometría degenerada
        }
        
        var radius = (diameter * 25.4) / 2; // Pulgadas a mm, luego radio
        
        var geometry = new THREE.CylinderGeometry(radius, radius, length, _config.pipeSegments);
        var material = createSteelMaterial(specColor);
        var mesh = new THREE.Mesh(geometry, material);
        
        // Posicionar en punto medio
        mesh.position.set(
            (start.x + end.x) / 2,
            (start.y + end.y) / 2,
            (start.z + end.z) / 2
        );
        
        // Orientar a lo largo del segmento
        var direction = new THREE.Vector3(dx, dy, dz).normalize();
        var quaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction
        );
        mesh.setRotationFromQuaternion(quaternion);
        
        if (_config.enableShadows) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        }
        
        return mesh;
    }
    
    /**
     * Crea una brida detallada en una posición y dirección
     */
    function createFlangeGeometry(position, direction, diameter, specColor) {
        var group = new THREE.Group();
        var color = specColor || 0x64748b;
        var radius = (diameter * 25.4) / 2;
        var flangeRadius = radius * 1.5;
        var flangeThickness = diameter <= 4 ? 15 : 22;
        
        // Disco principal
        var flangeGeom = new THREE.CylinderGeometry(flangeRadius, flangeRadius, flangeThickness, _config.flangeDetail);
        var flangeMat = createSteelMaterial(color, 0.3, 0.9);
        var flangeMesh = new THREE.Mesh(flangeGeom, flangeMat);
        group.add(flangeMesh);
        
        // Cara realzada
        var rfGeom = new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, 2, _config.flangeDetail);
        var rfMat = createSteelMaterial(0xc0c0c0, 0.15, 0.95);
        var rfMesh = new THREE.Mesh(rfGeom, rfMat);
        rfMesh.position.y = flangeThickness / 2 + 1;
        group.add(rfMesh);
        
        // Posicionar y orientar
        group.position.set(position.x, position.y, position.z);
        
        var dirVec = new THREE.Vector3(direction.dx, direction.dy, direction.dz).normalize();
        var quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec);
        group.setRotationFromQuaternion(quat);
        
        return group;
    }
    
    /**
     * Crea un mesh para cualquier tipo de equipo del catálogo
     */
    function createEquipmentMesh(eq) {
        var group = new THREE.Group();
        group.name = eq.tag || 'equipment';
        group.userData = { tag: eq.tag, type: 'equipment', data: eq };
        
        var specColor = 0x64748b;
        if (_catalog && eq.spec) {
            var spec = _catalog.getSpec(eq.spec);
            if (spec) specColor = spec.color;
        }
        
        var material = createSteelMaterial(specColor);
        var geometry;
        var tipo = (eq.tipo || '').toLowerCase();
        
        // Determinar geometría según tipo
        if (tipo.includes('tanque_v') || tipo.includes('torre') || tipo.includes('reactor') || 
            tipo.includes('desgasificador') || tipo.includes('desmineralizador') || 
            tipo.includes('filtro') || tipo.includes('clarificador') || tipo.includes('columna') ||
            tipo.includes('evaporador') || tipo.includes('cristalizador') || tipo.includes('absorbedor') ||
            tipo.includes('agitador') || tipo.includes('suavizador') || tipo.includes('centrifuga_discos') ||
            tipo.includes('tanque_aseptico')) {
            // Cilindro vertical
            var radius = (eq.diametro || 1000) / 2;
            var height = eq.altura || 1500;
            geometry = new THREE.CylinderGeometry(radius, radius, height, _config.pipeSegments);
        } else if (tipo.includes('tanque_h') || tipo.includes('separador') || 
                   tipo.includes('slug') || tipo.includes('calentador') || tipo.includes('secador') ||
                   tipo.includes('filtro_tambor') || tipo.includes('molino')) {
            // Cilindro horizontal
            var rx = (eq.largo || 2000) / 2;
            var ry = (eq.diametro || 1000) / 2;
            geometry = new THREE.CylinderGeometry(ry, ry, rx * 2, _config.pipeSegments);
            geometry.rotateZ(Math.PI / 2);
        } else if (tipo.includes('bomba') || tipo.includes('compresor') || tipo.includes('dosificador') ||
                   tipo.includes('skid') || tipo.includes('homogeneizador') || tipo.includes('pasteurizador') ||
                   tipo.includes('esterilizador') || tipo.includes('llenadora') || tipo.includes('osmosis') ||
                   tipo.includes('celda_electrolitica') || tipo.includes('filtro_prensa') ||
                   tipo.includes('intercambiador') || tipo.includes('condensador') || tipo.includes('caldera')) {
            // Caja rectangular
            var w = eq.largo || 1000;
            var h = eq.altura || 800;
            var d = eq.ancho || 800;
            geometry = new THREE.BoxGeometry(w, h, d);
        } else if (tipo.includes('plataforma')) {
            var pw = eq.largo || 6000;
            var ph = eq.altura || 400;
            var pd = eq.ancho || 3000;
            geometry = new THREE.BoxGeometry(pw, ph, pd);
        } else if (tipo.includes('antorcha')) {
            var flareRadius = 200;
            var flareHeight = eq.altura || 15000;
            geometry = new THREE.CylinderGeometry(flareRadius, flareRadius * 2, flareHeight, _config.pipeSegments);
        } else if (tipo.includes('espesador')) {
            var topR = (eq.diametro || 5000) / 2;
            var botR = 300;
            geometry = new THREE.CylinderGeometry(topR, botR, eq.altura || 4000, _config.pipeSegments);
        } else if (tipo.includes('canaleta')) {
            var cl = eq.largo || 4000;
            geometry = new THREE.BoxGeometry(cl, 600, 800);
        } else if (tipo.includes('tina') || tipo.includes('floculador')) {
            geometry = new THREE.BoxGeometry(eq.largo || 3000, eq.altura || 1500, eq.ancho || 2000);
        } else {
            // Genérico
            var gw = eq.largo || 1000;
            var gh = eq.altura || 1000;
            var gd = eq.ancho || 1000;
            geometry = new THREE.BoxGeometry(gw, gh, gd);
        }
        
        var mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(eq.posX || 0, eq.posY || 0, eq.posZ || 0);
        
        if (_config.enableShadows) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        }
        
        group.add(mesh);
        return group;
    }
    
    // ================================================================
    // 4. CONSTRUCCIÓN Y GESTIÓN DE ESCENA
    // ================================================================
    
    function disposeGroup(group) {
        if (!group) return;
        group.traverse(function(child) {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(function(m) { m.dispose(); });
                } else {
                    child.material.dispose();
                }
            }
        });
    }
    
    function clearAllMeshes() {
        _equipmentMeshes.forEach(function(group) {
            if (_scene) _scene.remove(group);
            disposeGroup(group);
        });
        _equipmentMeshes.clear();
        
        _lineMeshes.forEach(function(group) {
            if (_scene) _scene.remove(group);
            disposeGroup(group);
        });
        _lineMeshes.clear();
    }
    
    function buildScene() {
        if (!_core || !_catalog || !_scene) {
            return;
        }
        
        // Limpiar escena existente
        clearAllMeshes();
        
        var db = _core.getDb();
        var equipos = db.equipos || [];
        var lines = db.lines || [];
        
        // Construir equipos (con try-catch para cada uno)
        for (var i = 0; i < equipos.length; i++) {
            try {
                var eq = equipos[i];
                var mesh = createEquipmentMesh(eq);
                _scene.add(mesh);
                _equipmentMeshes.set(eq.tag, mesh);
            } catch (e) {
                console.warn('Error construyendo equipo ' + (equipos[i].tag || '?') + ': ' + e.message);
            }
        }
        
        // Construir líneas
        for (var j = 0; j < lines.length; j++) {
            try {
                var line = lines[j];
                var group = new THREE.Group();
                group.name = line.tag;
                group.userData = { tag: line.tag, type: 'line', data: line };
                
                var pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
                
                if (pts.length >= 2) {
                    var specColor = 0x7c3aed;
                    if (_catalog && line.spec) {
                        var spec = _catalog.getSpec(line.spec);
                        if (spec) specColor = spec.color;
                    }
                    var diameter = line.diameter || 4;
                    
                    for (var k = 0; k < pts.length - 1; k++) {
                        var pipeMesh = createPipeGeometry(pts[k], pts[k+1], diameter, specColor);
                        pipeMesh.userData = { tag: line.tag, type: 'pipe', segmentIndex: k };
                        group.add(pipeMesh);
                        
                        // Añadir codo si hay cambio de dirección
                        if (k < pts.length - 2) {
                            var d1x = pts[k+1].x - pts[k].x;
                            var d1y = pts[k+1].y - pts[k].y;
                            var d1z = pts[k+1].z - pts[k].z;
                            var d2x = pts[k+2].x - pts[k+1].x;
                            var d2y = pts[k+2].y - pts[k+1].y;
                            var d2z = pts[k+2].z - pts[k+1].z;
                            
                            var len1 = Math.sqrt(d1x*d1x + d1y*d1y + d1z*d1z);
                            var len2 = Math.sqrt(d2x*d2x + d2y*d2y + d2z*d2z);
                            
                            if (len1 > 0 && len2 > 0) {
                                var dot = (d1x*d2x + d1y*d2y + d1z*d2z) / (len1 * len2);
                                var angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
                                
                                if (angle > 5) {
                                    var elbowGroup = new THREE.Group();
                                    var radius = (diameter * 25.4) / 2;
                                    var bendRadius = radius * 1.5;
                                    var torusGeom = new THREE.TorusGeometry(bendRadius, radius, _config.pipeSegments, _config.pipeSegments, Math.PI / 2);
                                    var torusMesh = new THREE.Mesh(torusGeom, createSteelMaterial(specColor));
                                    elbowGroup.add(torusMesh);
                                    elbowGroup.position.set(pts[k+1].x, pts[k+1].y, pts[k+1].z);
                                    elbowGroup.userData = { tag: line.tag, type: 'elbow' };
                                    group.add(elbowGroup);
                                }
                            }
                        }
                    }
                    
                    // Bridas en extremos
                    if (line.origin && line.origin.objTag) {
                        var dirStart = { dx: pts[1].x - pts[0].x, dy: pts[1].y - pts[0].y, dz: pts[1].z - pts[0].z };
                        var flange = createFlangeGeometry(pts[0], dirStart, diameter, specColor);
                        flange.userData = { tag: line.tag, type: 'flange', position: 'origin' };
                        group.add(flange);
                    }
                    if (line.destination && line.destination.objTag) {
                        var n = pts.length;
                        var dirEnd = { dx: pts[n-1].x - pts[n-2].x, dy: pts[n-1].y - pts[n-2].y, dz: pts[n-1].z - pts[n-2].z };
                        var endFlange = createFlangeGeometry(pts[n-1], dirEnd, diameter, specColor);
                        endFlange.userData = { tag: line.tag, type: 'flange', position: 'destination' };
                        group.add(endFlange);
                    }
                }
                
                _scene.add(group);
                _lineMeshes.set(line.tag, group);
            } catch (e) {
                console.warn('Error construyendo línea ' + (lines[j].tag || '?') + ': ' + e.message);
            }
        }
        
        _needsBuild = false;
    }
    
    // ================================================================
    // 5. CÁMARA Y VISTAS
    // ================================================================
    
    function setIsoView() {
        if (!_camera) return;
        
        var angle = _config.isoAngle * Math.PI / 180;
        var dist = _config.cameraDistance;
        
        _camera.position.set(
            dist * Math.cos(angle),
            dist * Math.sin(angle),
            dist * Math.cos(angle)
        );
        _camera.lookAt(0, 0, 0);
        
        if (_controls) {
            _controls.target.set(0, 0, 0);
            _controls.update();
        }
    }
    
    function setView(viewName) {
        if (!_camera) return;
        
        var dist = _config.cameraDistance;
        
        switch(viewName) {
            case 'top':
                _camera.position.set(0, dist, 10);
                _camera.lookAt(0, 0, 0);
                break;
            case 'front':
                _camera.position.set(0, 0, dist);
                _camera.lookAt(0, 0, 0);
                break;
            case 'right':
                _camera.position.set(dist, 0, 0);
                _camera.lookAt(0, 0, 0);
                break;
            case 'iso':
            default:
                setIsoView();
                return;
        }
        
        if (_controls) {
            _controls.target.set(0, 0, 0);
            _controls.update();
        }
    }
    
    function zoomToFit() {
        if (!_scene || !_camera) return;
        
        var box = new THREE.Box3();
        var hasContent = false;
        
        _scene.traverse(function(child) {
            if (child.isMesh && child.geometry) {
                box.expandByObject(child);
                hasContent = true;
            }
        });
        
        if (!hasContent) {
            setIsoView();
            return;
        }
        
        var center = new THREE.Vector3();
        box.getCenter(center);
        var size = new THREE.Vector3();
        box.getSize(size);
        var maxDim = Math.max(size.x, size.y, size.z);
        var dist = Math.max(maxDim * 1.5, 5000);
        
        _camera.position.set(
            center.x + dist * 0.6,
            center.y + dist * 0.6,
            center.z + dist * 0.6
        );
        _camera.lookAt(center);
        
        if (_controls) {
            _controls.target.copy(center);
            _controls.update();
        }
    }
    
    function focusOn(position) {
        if (!_controls || !position) return;
        _controls.target.set(position.x, position.y, position.z);
        _controls.update();
    }
    
    // ================================================================
    // 6. SELECCIÓN POR RAYCASTER
    // ================================================================
    
    var _raycaster = new THREE.Raycaster();
    var _mouse = new THREE.Vector2();
    var _selectedObject = null;
    var _highlightedMeshes = [];
    
    function onMouseClick(event) {
        if (!_container || !_camera || !_scene) return;
        
        var rect = _container.getBoundingClientRect();
        _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        _raycaster.setFromCamera(_mouse, _camera);
        
        var allMeshes = [];
        _scene.traverse(function(child) {
            if (child.isMesh && child.userData && child.userData.tag) {
                allMeshes.push(child);
            }
        });
        
        var intersects = _raycaster.intersectObjects(allMeshes, false);
        
        if (intersects.length > 0) {
            var obj = intersects[0].object;
            var tag = obj.userData.tag;
            var type = obj.userData.type || 'equipment';
            
            var coreObj = _core.findObjectByTag(tag);
            if (coreObj) {
                // Quitar highlight anterior
                removeAllHighlights();
                
                _selectedObject = { obj: coreObj, type: type, mesh: obj };
                
                // Aplicar highlight
                highlightMeshAndParents(obj);
                
                if (_onSelectionCallback) {
                    _onSelectionCallback(_selectedObject);
                }
                
                if (_core.setSelected) {
                    _core.setSelected({ obj: coreObj, type: type });
                }
            }
        } else {
            deselectObject();
        }
    }
    
    function highlightMeshAndParents(mesh) {
        if (!mesh) return;
        
        // Recorrer hacia arriba para encontrar el grupo
        var current = mesh;
        while (current) {
            if (current.isMesh && current.material) {
                var clonedMat = current.material.clone();
                clonedMat.emissive = new THREE.Color(_config.highlightColor || 0xffd700);
                clonedMat.emissiveIntensity = 0.3;
                current.material = clonedMat;
                _highlightedMeshes.push(current);
            }
            current = current.parent;
            if (current === _scene || !current) break;
        }
    }
    
    function removeAllHighlights() {
        for (var i = 0; i < _highlightedMeshes.length; i++) {
            var mesh = _highlightedMeshes[i];
            if (mesh && mesh.material) {
                if (mesh.material.emissive) {
                    mesh.material.emissive = new THREE.Color(0x000000);
                    mesh.material.emissiveIntensity = 0;
                }
            }
        }
        _highlightedMeshes = [];
    }
    
    function deselectObject() {
        removeAllHighlights();
        _selectedObject = null;
        
        if (_onSelectionCallback) {
            _onSelectionCallback(null);
        }
        
        if (_core && _core.setSelected) {
            _core.setSelected(null);
        }
    }
    
    // ================================================================
    // 7. RENDER LOOP CONTROLADO
    // ================================================================
    
    function startRenderLoop() {
        if (_isRendering) return;
        _isRendering = true;
        
        function render() {
            if (!_isRendering) {
                return;
            }
            
            _renderLoopId = requestAnimationFrame(render);
            
            // Reconstruir escena si es necesario
            if (_needsBuild && _core && _catalog && _scene) {
                buildScene();
            }
            
            // Actualizar controles
            if (_controls) {
                _controls.update();
            }
            
            // Renderizar
            if (_renderer && _scene && _camera) {
                _renderer.render(_scene, _camera);
            }
        }
        
        render();
    }
    
    function stopRenderLoop() {
        _isRendering = false;
        if (_renderLoopId) {
            cancelAnimationFrame(_renderLoopId);
            _renderLoopId = null;
        }
    }
    
    // ================================================================
    // 8. INICIALIZACIÓN PRINCIPAL
    // ================================================================
    
    function init(container, coreInstance, catalogInstance, config) {
        // Validar parámetros
        if (!container) {
            console.error('❌ Renderer3D.init: contenedor no proporcionado');
            return false;
        }
        if (!coreInstance) {
            console.error('❌ Renderer3D.init: SmartFlowCore no proporcionado');
            return false;
        }
        if (!catalogInstance) {
            console.error('❌ Renderer3D.init: SmartFlowCatalog no proporcionado');
            return false;
        }
        
        _container = container;
        _core = coreInstance;
        _catalog = catalogInstance;
        
        // Merge de configuración
        if (config && typeof config === 'object') {
            for (var key in config) {
                if (config.hasOwnProperty(key) && _config.hasOwnProperty(key)) {
                    _config[key] = config[key];
                }
            }
        }
        
        // Limpiar contenedor
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        
        try {
            // ─── Escena ──────────────────────────────────────
            _scene = new THREE.Scene();
            _scene.background = new THREE.Color(_config.backgroundColor);
            
            // ─── Cámara ───────────────────────────────────────
            var aspect = container.clientWidth / (container.clientHeight || 1);
            _camera = new THREE.PerspectiveCamera(45, aspect, 100, 100000);
            
            // ─── Renderer ─────────────────────────────────────
            _renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                alpha: false,
                powerPreference: 'high-performance'
            });
            _renderer.setSize(container.clientWidth, container.clientHeight);
            _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            
            if (_config.enableShadows) {
                _renderer.shadowMap.enabled = true;
                _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            }
            
            container.appendChild(_renderer.domElement);
            
            // ─── OrbitControls ────────────────────────────────
            _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
            _controls.enableDamping = true;
            _controls.dampingFactor = 0.08;
            _controls.minDistance = 500;
            _controls.maxDistance = 50000;
            _controls.maxPolarAngle = Math.PI * 0.48;
            _controls.target.set(0, 0, 0);
            _controls.update();
            
            // ─── Iluminación ──────────────────────────────────
            _ambientLight = new THREE.AmbientLight(0x404060, 1.5);
            _scene.add(_ambientLight);
            
            _hemisphereLight = new THREE.HemisphereLight(0x8888ff, 0x443322, 0.8);
            _scene.add(_hemisphereLight);
            
            _directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
            _directionalLight.position.set(20000, 30000, 15000);
            
            if (_config.enableShadows) {
                _directionalLight.castShadow = true;
                _directionalLight.shadow.mapSize.width = 2048;
                _directionalLight.shadow.mapSize.height = 2048;
                _directionalLight.shadow.camera.near = 100;
                _directionalLight.shadow.camera.far = 80000;
                _directionalLight.shadow.camera.left = -20000;
                _directionalLight.shadow.camera.right = 20000;
                _directionalLight.shadow.camera.top = 20000;
                _directionalLight.shadow.camera.bottom = -20000;
            }
            
            _scene.add(_directionalLight);
            
            // ─── Grid ──────────────────────────────────────────
            _gridHelper = new THREE.GridHelper(_config.gridSize, _config.gridDivisions, 0x334455, 0x1a1a2e);
            _scene.add(_gridHelper);
            
            // ─── Plano de suelo para sombras ───────────────────
            _groundPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(50000, 50000),
                new THREE.ShadowMaterial({ opacity: 0.3 })
            );
            _groundPlane.rotation.x = -Math.PI / 2;
            _groundPlane.position.y = -100;
            if (_config.enableShadows) {
                _groundPlane.receiveShadow = true;
            }
            _scene.add(_groundPlane);
            
            // ─── Eventos ──────────────────────────────────────
            _renderer.domElement.addEventListener('click', onMouseClick);
            
            window.addEventListener('resize', function() {
                if (!_container || !_camera || !_renderer) return;
                var w = _container.clientWidth;
                var h = _container.clientHeight;
                if (w > 0 && h > 0) {
                    _camera.aspect = w / h;
                    _camera.updateProjectionMatrix();
                    _renderer.setSize(w, h);
                }
            });
            
            // ─── Vista inicial ─────────────────────────────────
            setIsoView();
            
            // ─── Construir escena inicial ──────────────────────
            _needsBuild = true;
            buildScene();
            
            // ─── Iniciar render loop ───────────────────────────
            startRenderLoop();
            
            _initComplete = true;
            console.log('✅ SmartFlowRenderer3D v3.1 inicializado correctamente');
            return true;
            
        } catch (e) {
            console.error('❌ Error fatal inicializando Renderer3D:', e.message);
            console.error(e.stack);
            return false;
        }
    }
    
    function rebuildScene() {
        _needsBuild = true;
        if (_scene && _core && _catalog) {
            buildScene();
        }
    }
    
    function dispose() {
        stopRenderLoop();
        clearAllMeshes();
        
        if (_renderer) {
            _renderer.dispose();
            if (_renderer.domElement && _renderer.domElement.parentNode) {
                _renderer.domElement.parentNode.removeChild(_renderer.domElement);
            }
        }
        
        _scene = null;
        _camera = null;
        _renderer = null;
        _controls = null;
        _container = null;
        _core = null;
        _catalog = null;
        _initComplete = false;
        
        if (_gridHelper) {
            _gridHelper.dispose();
            _gridHelper = null;
        }
    }
    
    // ================================================================
    // 9. API PÚBLICA
    // ================================================================
    
    return {
        // Inicialización
        init: init,
        rebuildScene: rebuildScene,
        dispose: dispose,
        
        // Vistas
        setView: setView,
        setIsoView: setIsoView,
        focusOn: focusOn,
        zoomToFit: zoomToFit,
        
        // Selección
        deselectObject: deselectObject,
        getSelected: function() { return _selectedObject; },
        onSelection: function(callback) { _onSelectionCallback = callback; },
        
        // Acceso a objetos Three.js
        getScene: function() { return _scene; },
        getCamera: function() { return _camera; },
        getRenderer: function() { return _renderer; },
        getControls: function() { return _controls; },
        
        // Configuración
        setConfig: function(key, value) { 
            if (_config.hasOwnProperty(key)) {
                _config[key] = value;
            }
        },
        getConfig: function() { return _config; },
        
        // Estado
        isReady: function() { return _initComplete; }
    };
})();
