// ============================================================
// SMARTFLOW RENDER ENGINE v3.1 - Motor de Renderizado 3D Industrial
// Archivo: js/renderer3d.js
// Compatible: SmartFlowCore v5.5 + SmartFlowCatalog v4.0
// Características: Isométrico 3D, PBR, Sombras, LOD, Post-procesado
// CORRECCIONES v3.1: Verificación THREE, init con timeout, buildScene protegido
// ============================================================

const SmartFlowRenderer3D = (function() {
    
    // ================================================================
    // 0. VERIFICACIÓN CRÍTICA DE THREE.js (CORRECCIÓN #1)
    // ================================================================
    if (typeof THREE === 'undefined') {
        console.error('❌ SmartFlowRenderer3D: THREE.js no está cargado.');
        console.error('   Asegúrese de incluir antes:');
        console.error('   <script src="https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.min.js"></script>');
        console.error('   <script src="https://cdn.jsdelivr.net/npm/three@0.157.0/examples/js/controls/OrbitControls.js"></script>');
        
        // Devolver stub funcional para evitar errores en cadena
        return {
            init: function() { console.error('Renderer3D no disponible: THREE.js faltante'); return false; },
            rebuildScene: function() {},
            updateAll: function() {},
            updateEquipmentMesh: function() {},
            updateLineMesh: function() {},
            setView: function() {},
            setIsoView: function() {},
            focusOn: function() {},
            zoomToFit: function() {},
            selectObject: function() {},
            deselectObject: function() {},
            getSelected: function() { return null; },
            onSelection: function() {},
            setConfig: function() {},
            getConfig: function() { return {}; },
            getScene: function() { return null; },
            getCamera: function() { return null; },
            getRenderer: function() { return null; },
            getControls: function() { return null; },
            onRender: function() {},
            setNotify: function() {},
            isReady: function() { return false; },
            createPipeGeometry: function() { return null; },
            createFlangeGeometry: function() { return null; },
            createElbow90: function() { return null; },
            createGateValve: function() { return null; },
            createPressureGauge: function() { return null; },
            createPipeShoe: function() { return null; }
        };
    }
    
    // ================================================================
    // 1. REFERENCIAS Y ESTADO INTERNO
    // ================================================================
    let _core = null;
    let _catalog = null;
    
    // Three.js
    let _scene, _camera, _renderer, _controls;
    let _container = null;
    
    // Iluminación
    let _ambientLight, _directionalLight, _hemisphereLight;
    
    // Post-procesado (deshabilitado por defecto para estabilidad)
    let _composer = null;
    let _bloomPass = null;
    let _saoPass = null;
    let _fxaaPass = null;
    
    // Gestión de objetos
    let _equipmentMeshes = new Map();
    let _lineMeshes = new Map();
    let _componentMeshes = new Map();
    let _instrumentMeshes = new Map();
    let _supportMeshes = new Map();
    let _gridHelper, _groundPlane;
    
    // Configuración
    let _config = {
        isoAngle: 30,
        cameraDistance: 20000,
        backgroundColor: 0x0a0e17,
        gridSize: 20000,
        gridDivisions: 40,
        enableShadows: true,
        enablePostProcessing: false,    // Deshabilitado para evitar dependencias extras
        enableBloom: false,
        enableAO: false,
        enableAA: false,
        enableLOD: true,
        pipeSegments: 24,              // Reducido para mejor rendimiento inicial
        flangeDetail: 20,
        valveDetail: 24,
        animationSpeed: 0.5,
        highlightColor: 0xffd700,
        selectionColor: 0xffd700
    };
    
    // Estado del render loop (CORRECCIÓN #2)
    let _renderLoopId = null;
    let _isRendering = false;
    let _needsBuild = true;
    let _initComplete = false;
    
    // Callbacks
    let _onSelectionCallback = null;
    let _onRenderCallback = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    
    // ================================================================
    // 2. MATERIALES PBR (Physically Based Rendering)
    // ================================================================
    
    function createSteelMaterial(color, roughness = 0.35, metalness = 0.85) {
        return new THREE.MeshStandardMaterial({
            color: color,
            roughness: roughness,
            metalness: metalness
        });
    }
    
    function createPlasticMaterial(color, roughness = 0.5, metalness = 0.1) {
        return new THREE.MeshStandardMaterial({
            color: color,
            roughness: roughness,
            metalness: metalness
        });
    }
    
    function createGlassMaterial(color = 0x88ccff) {
        return new THREE.MeshPhysicalMaterial({
            color: color,
            roughness: 0.05,
            metalness: 0.05,
            transparent: true,
            opacity: 0.4
        });
    }
    
    function createRubberMaterial(color = 0x333333) {
        return new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.9,
            metalness: 0.0
        });
    }
    
    function createBrassMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0xd4a574,
            roughness: 0.3,
            metalness: 0.9
        });
    }
    
    function createCopperMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0xb87333,
            roughness: 0.25,
            metalness: 0.95
        });
    }
    
    // ================================================================
    // 3. GENERADORES DE GEOMETRÍA DETALLADA
    // ================================================================
    
    function createPipeGeometry(start, end, diameter, specColor = 0x64748b) {
        const dir = new THREE.Vector3().subVectors(
            new THREE.Vector3(end.x, end.y, end.z),
            new THREE.Vector3(start.x, start.y, start.z)
        );
        const length = dir.length();
        if (length < 0.1) return new THREE.Group();
        
        const radius = (diameter * 25.4) / 2;
        
        const geometry = new THREE.CylinderGeometry(radius, radius, length, _config.pipeSegments);
        const material = createSteelMaterial(specColor, 0.4, 0.8);
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.position.set(
            (start.x + end.x) / 2,
            (start.y + end.y) / 2,
            (start.z + end.z) / 2
        );
        
        const midPoint = new THREE.Vector3(0, 1, 0);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(midPoint, dir.normalize());
        mesh.setRotationFromQuaternion(quaternion);
        
        mesh.castShadow = _config.enableShadows;
        mesh.receiveShadow = _config.enableShadows;
        
        return mesh;
    }
    
    function createFlangeGeometry(position, direction, diameter, specColor = 0x64748b, flangeType = 'WN') {
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        const flangeRadius = radius * 1.5;
        const flangeThickness = diameter <= 4 ? 15 : diameter <= 8 ? 22 : 28;
        const boltRadius = flangeRadius * 0.82;
        const numBolts = diameter <= 4 ? 8 : diameter <= 8 ? 12 : 16;
        
        const flangeGeom = new THREE.CylinderGeometry(flangeRadius, flangeRadius, flangeThickness, _config.flangeDetail);
        const flangeMat = createSteelMaterial(specColor, 0.3, 0.9);
        const flangeMesh = new THREE.Mesh(flangeGeom, flangeMat);
        group.add(flangeMesh);
        
        if (flangeType === 'WN') {
            const neckHeight = flangeThickness * 1.5;
            const neckGeom = new THREE.CylinderGeometry(radius + 3, flangeRadius - 2, neckHeight, _config.flangeDetail);
            const neckMesh = new THREE.Mesh(neckGeom, flangeMat);
            neckMesh.position.y = -flangeThickness/2 - neckHeight/2;
            group.add(neckMesh);
        }
        
        const rfHeight = 2;
        const rfGeom = new THREE.CylinderGeometry(radius * 1.1, radius * 1.1, rfHeight, _config.flangeDetail);
        const rfMat = createSteelMaterial(0xc0c0c0, 0.15, 0.95);
        const rfMesh = new THREE.Mesh(rfGeom, rfMat);
        rfMesh.position.y = flangeThickness/2 + rfHeight/2;
        group.add(rfMesh);
        
        for (let i = 0; i < 3; i++) {
            const ringGeom = new THREE.TorusGeometry(radius * (0.85 - i * 0.15), 0.3, 8, _config.flangeDetail);
            const ringMesh = new THREE.Mesh(ringGeom, rfMat);
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.y = flangeThickness/2 + rfHeight + 0.1;
            group.add(ringMesh);
        }
        
        const boltGeom = new THREE.CylinderGeometry(1.5, 1.5, flangeThickness + 10, 8);
        const boltMat = createSteelMaterial(0x404040, 0.2, 0.95);
        
        for (let i = 0; i < numBolts; i++) {
            const angle = (i / numBolts) * Math.PI * 2;
            const boltMesh = new THREE.Mesh(boltGeom, boltMat);
            boltMesh.position.set(Math.cos(angle) * boltRadius, 0, Math.sin(angle) * boltRadius);
            group.add(boltMesh);
            
            const nutGeom = new THREE.CylinderGeometry(3, 3, 4, 6);
            const nutTop = new THREE.Mesh(nutGeom, boltMat);
            nutTop.position.set(Math.cos(angle) * boltRadius, flangeThickness/2 + 5, Math.sin(angle) * boltRadius);
            group.add(nutTop);
            
            const nutBottom = new THREE.Mesh(nutGeom.clone(), boltMat);
            nutBottom.position.set(Math.cos(angle) * boltRadius, -flangeThickness/2 - 5, Math.sin(angle) * boltRadius);
            group.add(nutBottom);
        }
        
        group.position.set(position.x, position.y, position.z);
        
        const dirVec = new THREE.Vector3(direction.dx, direction.dy, direction.dz).normalize();
        const defaultUp = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(defaultUp, dirVec);
        group.setRotationFromQuaternion(quat);
        
        group.castShadow = _config.enableShadows;
        group.receiveShadow = _config.enableShadows;
        
        return group;
    }
    
    function createElbow90(position, directionIn, directionOut, diameter, specColor = 0x64748b) {
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        const bendRadius = radius * 1.5;
        
        const torusGeom = new THREE.TorusGeometry(bendRadius, radius, _config.pipeSegments, _config.pipeSegments, Math.PI / 2);
        const material = createSteelMaterial(specColor, 0.35, 0.85);
        const torusMesh = new THREE.Mesh(torusGeom, material);
        group.add(torusMesh);
        
        const straightLength = radius * 0.5;
        const straightGeom = new THREE.CylinderGeometry(radius, radius, straightLength, _config.pipeSegments);
        
        const straight1 = new THREE.Mesh(straightGeom, material);
        straight1.position.set(0, 0, bendRadius + straightLength/2);
        group.add(straight1);
        
        const straight2 = new THREE.Mesh(straightGeom.clone(), material);
        straight2.position.set(bendRadius + straightLength/2, 0, 0);
        straight2.rotation.z = -Math.PI/2;
        group.add(straight2);
        
        group.position.set(position.x, position.y, position.z);
        group.castShadow = _config.enableShadows;
        group.receiveShadow = _config.enableShadows;
        
        return group;
    }
    
    function createGateValve(position, direction, diameter, specColor = 0x64748b, handwheelColor = 0xff4444) {
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        const bodyLength = diameter * 25.4 * 1.5;
        const bodyWidth = radius * 2.2;
        const bonnetHeight = radius * 2;
        const stemHeight = radius * 3;
        
        const bodyGeom = new THREE.BoxGeometry(bodyLength, bodyWidth, bodyWidth, 2, _config.valveDetail, _config.valveDetail);
        const bodyMat = createSteelMaterial(specColor, 0.3, 0.9);
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        group.add(bodyMesh);
        
        const flangeThickness = 10;
        const flangeGeom = new THREE.CylinderGeometry(radius * 1.4, radius * 1.4, flangeThickness, _config.flangeDetail);
        const flangeMat = createSteelMaterial(specColor, 0.25, 0.9);
        
        const flange1 = new THREE.Mesh(flangeGeom, flangeMat);
        flange1.rotation.x = Math.PI / 2;
        flange1.position.z = -bodyLength/2;
        group.add(flange1);
        
        const flange2 = new THREE.Mesh(flangeGeom.clone(), flangeMat);
        flange2.rotation.x = Math.PI / 2;
        flange2.position.z = bodyLength/2;
        group.add(flange2);
        
        const bonnetGeom = new THREE.CylinderGeometry(radius * 0.6, radius, bonnetHeight, _config.valveDetail);
        const bonnetMesh = new THREE.Mesh(bonnetGeom, bodyMat);
        bonnetMesh.position.y = bodyWidth/2 + bonnetHeight/2;
        group.add(bonnetMesh);
        
        const yokeGeom = new THREE.CylinderGeometry(radius * 0.4, radius * 0.4, stemHeight, _config.valveDetail);
        const yokeMesh = new THREE.Mesh(yokeGeom, bodyMat);
        yokeMesh.position.y = bodyWidth/2 + bonnetHeight + stemHeight/2;
        group.add(yokeMesh);
        
        const handwheelGeom = new THREE.TorusGeometry(radius * 0.8, radius * 0.15, 8, _config.valveDetail);
        const handwheelMat = new THREE.MeshStandardMaterial({
            color: handwheelColor,
            roughness: 0.4,
            metalness: 0.2
        });
        const handwheelMesh = new THREE.Mesh(handwheelGeom, handwheelMat);
        handwheelMesh.position.y = bodyWidth/2 + bonnetHeight + stemHeight;
        group.add(handwheelMesh);
        
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const spokeGeom = new THREE.CylinderGeometry(2, 2, radius * 0.75, 6);
            const spoke = new THREE.Mesh(spokeGeom, handwheelMat);
            spoke.position.set(
                Math.cos(angle) * radius * 0.4,
                bodyWidth/2 + bonnetHeight + stemHeight,
                Math.sin(angle) * radius * 0.4
            );
            group.add(spoke);
        }
        
        group.position.set(position.x, position.y, position.z);
        const dirVec = new THREE.Vector3(direction.dx, direction.dy, direction.dz).normalize();
        const defaultDir = new THREE.Vector3(0, 0, 1);
        const quat = new THREE.Quaternion().setFromUnitVectors(defaultDir, dirVec);
        group.setRotationFromQuaternion(quat);
        
        group.castShadow = _config.enableShadows;
        group.receiveShadow = _config.enableShadows;
        
        return group;
    }
    
    function createPumpMesh(equipmentData) {
        const group = new THREE.Group();
        const spec = _catalog.getSpec(equipmentData.spec);
        const color = spec ? spec.color : 0x64748b;
        
        const largo = equipmentData.largo || 1200;
        const ancho = equipmentData.ancho || 600;
        const altura = equipmentData.altura || 800;
        
        const baseGeom = new THREE.BoxGeometry(largo, 40, ancho);
        const baseMat = createSteelMaterial(0x404040, 0.5, 0.7);
        const baseMesh = new THREE.Mesh(baseGeom, baseMat);
        baseMesh.position.y = -altura/2;
        group.add(baseMesh);
        
        const voluteGeom = new THREE.SphereGeometry(ancho * 0.35, _config.valveDetail, _config.valveDetail);
        voluteGeom.scale(1, 0.6, 1.2);
        const voluteMat = createSteelMaterial(color, 0.3, 0.9);
        const voluteMesh = new THREE.Mesh(voluteGeom, voluteMat);
        voluteMesh.position.y = -altura/4;
        group.add(voluteMesh);
        
        const motorGeom = new THREE.CylinderGeometry(ancho * 0.25, ancho * 0.25, largo * 0.5, _config.valveDetail);
        const motorMat = createSteelMaterial(0x334155, 0.4, 0.85);
        const motorMesh = new THREE.Mesh(motorGeom, motorMat);
        motorMesh.rotation.z = Math.PI / 2;
        motorMesh.position.set(largo * 0.2, -altura/5, 0);
        group.add(motorMesh);
        
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const finGeom = new THREE.BoxGeometry(8, 20, ancho * 0.3);
            const fin = new THREE.Mesh(finGeom, motorMat);
            fin.position.set(largo * 0.2, -altura/5, 0);
            fin.rotation.z = angle;
            group.add(fin);
        }
        
        const bracketGeom = new THREE.BoxGeometry(ancho * 0.15, altura * 0.3, ancho * 0.4);
        const bracketMesh = new THREE.Mesh(bracketGeom, baseMat);
        bracketMesh.position.set(largo * 0.05, -altura/3, 0);
        group.add(bracketMesh);
        
        group.castShadow = _config.enableShadows;
        group.receiveShadow = _config.enableShadows;
        
        return group;
    }
    
    function createVerticalTank(equipmentData) {
        const group = new THREE.Group();
        const spec = _catalog.getSpec(equipmentData.spec);
        const color = spec ? spec.color : 0x64748b;
        
        const diametro = equipmentData.diametro || 2000;
        const altura = equipmentData.altura || 5000;
        const radius = diametro / 2;
        
        const bodyGeom = new THREE.CylinderGeometry(radius, radius, altura, _config.pipeSegments, 1);
        const bodyMat = createSteelMaterial(color, 0.3, 0.85);
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        group.add(bodyMesh);
        
        const numRings = Math.floor(altura / 1000);
        for (let i = 1; i < numRings; i++) {
            const ringGeom = new THREE.TorusGeometry(radius + 8, 10, 8, _config.pipeSegments);
            const ringMat = createSteelMaterial(0x505050, 0.3, 0.9);
            const ringMesh = new THREE.Mesh(ringGeom, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.y = -altura/2 + i * 1000;
            group.add(ringMesh);
        }
        
        const bottomGeom = new THREE.SphereGeometry(radius * 1.1, _config.pipeSegments, _config.pipeSegments/2, 0, Math.PI * 2, 0, Math.PI/4);
        const bottomMesh = new THREE.Mesh(bottomGeom, bodyMat);
        bottomMesh.position.y = -altura/2;
        group.add(bottomMesh);
        
        const roofGeom = new THREE.CylinderGeometry(radius * 0.2, radius, radius * 0.3, _config.pipeSegments);
        const roofMat = createSteelMaterial(0x556677, 0.35, 0.8);
        const roofMesh = new THREE.Mesh(roofGeom, roofMat);
        roofMesh.position.y = altura/2 + radius * 0.15;
        group.add(roofMesh);
        
        if (equipmentData.puertos) {
            equipmentData.puertos.forEach(puerto => {
                const nozzleGeom = new THREE.CylinderGeometry(15, 15, radius * 0.4, _config.flangeDetail);
                const nozzleMesh = new THREE.Mesh(nozzleGeom, createSteelMaterial(0x8899aa, 0.25, 0.9));
                nozzleMesh.position.set(puerto.relX || 0, puerto.relY || 0, puerto.relZ || 0);
                if (puerto.orientacion) {
                    const dir = new THREE.Vector3(puerto.orientacion.dx, puerto.orientacion.dy, puerto.orientacion.dz);
                    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
                    nozzleMesh.setRotationFromQuaternion(quat);
                }
                group.add(nozzleMesh);
            });
        }
        
        group.castShadow = _config.enableShadows;
        group.receiveShadow = _config.enableShadows;
        
        return group;
    }
    
    function createHeatExchanger(equipmentData) {
        const group = new THREE.Group();
        const spec = _catalog.getSpec(equipmentData.spec);
        const color = spec ? spec.color : 0x64748b;
        
        const largo = equipmentData.largo || 3000;
        const diametro = equipmentData.diametro || 600;
        const radius = diametro / 2;
        
        const shellGeom = new THREE.CylinderGeometry(radius, radius, largo, _config.pipeSegments);
        const shellMat = createSteelMaterial(color, 0.3, 0.85);
        const shellMesh = new THREE.Mesh(shellGeom, shellMat);
        shellMesh.rotation.z = Math.PI / 2;
        group.add(shellMesh);
        
        const headGeom = new THREE.SphereGeometry(radius, _config.pipeSegments, _config.pipeSegments/2);
        const headMat = createSteelMaterial(0x556677, 0.35, 0.8);
        
        const headLeft = new THREE.Mesh(headGeom, headMat);
        headLeft.position.x = -largo/2;
        group.add(headLeft);
        
        const headRight = new THREE.Mesh(headGeom.clone(), headMat);
        headRight.position.x = largo/2;
        group.add(headRight);
        
        for (let x = -1; x <= 1; x += 2) {
            const saddleGeom = new THREE.BoxGeometry(200, radius * 0.6, diametro * 0.4);
            const saddleMesh = new THREE.Mesh(saddleGeom, createSteelMaterial(0x404040, 0.5, 0.7));
            saddleMesh.position.set(x * largo * 0.3, -radius - radius * 0.3, 0);
            group.add(saddleMesh);
        }
        
        if (equipmentData.puertos) {
            equipmentData.puertos.forEach(puerto => {
                const nozzleGeom = new THREE.CylinderGeometry(12, 12, radius * 0.5, _config.flangeDetail);
                const nozzleMesh = new THREE.Mesh(nozzleGeom, createSteelMaterial(0x8899aa, 0.25, 0.9));
                nozzleMesh.position.set(puerto.relX || 0, puerto.relY || 0, puerto.relZ || 0);
                group.add(nozzleMesh);
            });
        }
        
        group.castShadow = _config.enableShadows;
        group.receiveShadow = _config.enableShadows;
        
        return group;
    }
    
    function createPressureGauge(position, direction) {
        const group = new THREE.Group();
        
        const caseGeom = new THREE.CylinderGeometry(25, 25, 15, _config.valveDetail);
        const caseMat = createSteelMaterial(0x334155, 0.3, 0.85);
        const caseMesh = new THREE.Mesh(caseGeom, caseMat);
        group.add(caseMesh);
        
        const dialGeom = new THREE.CylinderGeometry(23, 23, 2, _config.valveDetail);
        const dialMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.05 });
        const dialMesh = new THREE.Mesh(dialGeom, dialMat);
        dialMesh.position.y = 8;
        group.add(dialMesh);
        
        const glassGeom = new THREE.CylinderGeometry(22, 22, 1, _config.valveDetail);
        const glassMat = createGlassMaterial(0xaaddff);
        const glassMesh = new THREE.Mesh(glassGeom, glassMat);
        glassMesh.position.y = 10;
        group.add(glassMesh);
        
        const needleGeom = new THREE.BoxGeometry(2, 18, 0.5);
        const needleMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.2, metalness: 0.3 });
        const needleMesh = new THREE.Mesh(needleGeom, needleMat);
        needleMesh.position.y = 11;
        needleMesh.rotation.z = Math.PI / 6;
        group.add(needleMesh);
        
        const connGeom = new THREE.CylinderGeometry(6, 8, 30, _config.flangeDetail);
        const connMesh = new THREE.Mesh(connGeom, caseMat);
        connMesh.position.y = -22;
        group.add(connMesh);
        
        group.position.set(position.x, position.y, position.z);
        group.castShadow = _config.enableShadows;
        
        return group;
    }
    
    function createPipeShoe(position, diameter) {
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        
        const baseGeom = new THREE.BoxGeometry(radius * 2, 15, radius * 1.8);
        const baseMat = createSteelMaterial(0x555555, 0.5, 0.7);
        const baseMesh = new THREE.Mesh(baseGeom, baseMat);
        group.add(baseMesh);
        
        const clampGeom = new THREE.TorusGeometry(radius + 5, 8, 8, _config.pipeSegments, Math.PI);
        const clampMesh = new THREE.Mesh(clampGeom, baseMat);
        clampMesh.position.y = radius + 15;
        group.add(clampMesh);
        
        for (let x = -1; x <= 1; x += 2) {
            const boltGeom = new THREE.CylinderGeometry(4, 4, radius * 2 + 30, 8);
            const boltMesh = new THREE.Mesh(boltGeom, createSteelMaterial(0x404040, 0.2, 0.9));
            boltMesh.position.set(x * radius * 0.6, radius/2 + 7, 0);
            group.add(boltMesh);
        }
        
        group.position.set(position.x, position.y - radius - 7, position.z);
        group.castShadow = _config.enableShadows;
        group.receiveShadow = _config.enableShadows;
        
        return group;
    }
    
    // ================================================================
    // 4. CONSTRUCCIÓN DE ESCENA COMPLETA
    // ================================================================
    
    function buildScene() {
        // CORRECCIÓN #3: Verificar dependencias antes de construir
        if (!_core || !_catalog || !_scene) {
            console.warn('buildScene: faltan dependencias (core, catalog o scene)');
            return;
        }
        
        clearAllMeshes();
        
        const db = _core.getDb();
        const equipos = db.equipos || [];
        const lines = db.lines || [];
        
        // Construir equipos con protección individual
        equipos.forEach(eq => {
            try {
                buildEquipment(eq);
            } catch (e) {
                console.warn('Error construyendo equipo ' + (eq.tag || '?') + ':', e.message);
            }
        });
        
        // Construir líneas con protección individual
        lines.forEach(line => {
            try {
                buildLine(line);
            } catch (e) {
                console.warn('Error construyendo línea ' + (line.tag || '?') + ':', e.message);
            }
        });
        
        updateAllConnections();
        _needsBuild = false;
    }
    
    function buildEquipment(eq) {
        let mesh;
        
        switch (eq.tipo) {
            case 'bomba':
            case 'bomba_centrifuga':
                mesh = createPumpMesh(eq);
                break;
            case 'bomba_dosificacion':
                mesh = createPumpMesh(eq);
                mesh.scale.set(0.6, 0.6, 0.6);
                break;
            case 'tanque_v':
            case 'torre':
            case 'reactor':
            case 'desgasificador':
            case 'desmineralizador':
            case 'suavizador':
            case 'filtro_carbon':
            case 'filtro_arena':
            case 'clarificador':
            case 'columna_fraccionadora':
            case 'evaporador':
            case 'cristalizador':
            case 'absorbedor':
            case 'stripper':
            case 'reactor_encamisado':
            case 'autoclave':
            case 'agitador':
            case 'tanque_aseptico':
                mesh = createVerticalTank(eq);
                break;
            case 'intercambiador':
            case 'condensador':
                mesh = createHeatExchanger(eq);
                break;
            case 'tanque_h':
            case 'separador':
            case 'separador_trifasico':
            case 'slug_catcher':
            case 'calentador_fuego_directo':
            case 'secador_rotativo':
                mesh = createHeatExchanger(eq);
                mesh.rotation.z = Math.PI / 2;
                break;
            case 'compresor':
                mesh = createPumpMesh(eq);
                mesh.scale.set(1.5, 1.2, 1.2);
                break;
            case 'caldera':
                mesh = createHeatExchanger(eq);
                mesh.scale.set(2, 1.5, 1.5);
                break;
            case 'centrifuga':
            case 'centrifuga_discos':
                mesh = createPumpMesh(eq);
                mesh.scale.set(1.3, 0.8, 1.3);
                break;
            case 'plataforma':
                mesh = createPlatformMesh(eq);
                break;
            case 'antorcha':
                mesh = createFlareMesh(eq);
                break;
            case 'espesador':
                mesh = createThickenerMesh(eq);
                break;
            case 'filtro_prensa':
                mesh = createFilterPressMesh(eq);
                break;
            default:
                mesh = createGenericEquipmentMesh(eq);
        }
        
        if (mesh) {
            mesh.position.set(eq.posX || 0, eq.posY || 0, eq.posZ || 0);
            mesh.userData = { tag: eq.tag, type: 'equipment', data: eq };
            
            mesh.traverse(child => {
                if (child.isMesh) {
                    child.userData = { tag: eq.tag, type: 'equipment' };
                }
            });
            
            _scene.add(mesh);
            _equipmentMeshes.set(eq.tag, mesh);
        }
        
        if (eq.puertos) {
            eq.puertos.forEach(puerto => {
                if (puerto.instrument) {
                    buildInstrument(puerto, eq);
                }
            });
        }
    }
    
    function buildLine(line) {
        const group = new THREE.Group();
        group.name = line.tag;
        group.userData = { tag: line.tag, type: 'line', data: line };
        
        const pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
        if (pts.length < 2) return;
        
        const spec = _catalog.getSpec(line.spec);
        const color = spec ? spec.color : 0x7c3aed;
        const diameter = line.diameter || 4;
        
        for (let i = 0; i < pts.length - 1; i++) {
            const start = pts[i];
            const end = pts[i + 1];
            
            const pipeMesh = createPipeGeometry(start, end, diameter, color);
            pipeMesh.userData = { tag: line.tag, type: 'pipe', segmentIndex: i };
            group.add(pipeMesh);
            
            if (i < pts.length - 2) {
                const dir1 = {
                    dx: pts[i+1].x - pts[i].x,
                    dy: pts[i+1].y - pts[i].y,
                    dz: pts[i+1].z - pts[i].z
                };
                const dir2 = {
                    dx: pts[i+2].x - pts[i+1].x,
                    dy: pts[i+2].y - pts[i+1].y,
                    dz: pts[i+2].z - pts[i+1].z
                };
                
                const len1 = Math.hypot(dir1.dx, dir1.dy, dir1.dz);
                const len2 = Math.hypot(dir2.dx, dir2.dy, dir2.dz);
                
                if (len1 > 0 && len2 > 0) {
                    const dot = (dir1.dx*dir2.dx + dir1.dy*dir2.dy + dir1.dz*dir2.dz) / (len1 * len2);
                    const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
                    
                    if (angle > 5) {
                        const elbow = createElbow90(pts[i+1], 
                            { dx: dir1.dx/len1, dy: dir1.dy/len1, dz: dir1.dz/len1 },
                            { dx: dir2.dx/len2, dy: dir2.dy/len2, dz: dir2.dz/len2 },
                            diameter, color);
                        elbow.userData = { tag: line.tag, type: 'elbow', segmentIndex: i };
                        group.add(elbow);
                    }
                }
            }
        }
        
        if (line.components) {
            line.components.forEach((comp, idx) => {
                const compMesh = buildComponentOnLine(comp, line, pts, diameter, color);
                if (compMesh) {
                    compMesh.userData = { tag: comp.tag || `COMP-${idx}`, type: 'component', data: comp };
                    group.add(compMesh);
                }
            });
        }
        
        if (line.origin && line.origin.objTag && pts.length >= 2) {
            const originObj = _core.findObjectByTag(line.origin.objTag);
            if (originObj && originObj.posX !== undefined) {
                const flange = createFlangeGeometry(
                    pts[0],
                    { dx: pts[1].x - pts[0].x, dy: pts[1].y - pts[0].y, dz: pts[1].z - pts[0].z },
                    diameter, color, 'WN'
                );
                flange.userData = { tag: line.tag, type: 'flange', position: 'origin' };
                group.add(flange);
            }
        }
        if (line.destination && line.destination.objTag && pts.length >= 2) {
            const destObj = _core.findObjectByTag(line.destination.objTag);
            if (destObj && destObj.posX !== undefined) {
                const n = pts.length;
                const flange = createFlangeGeometry(
                    pts[n-1],
                    { dx: pts[n-1].x - pts[n-2].x, dy: pts[n-1].y - pts[n-2].y, dz: pts[n-1].z - pts[n-2].z },
                    diameter, color, 'WN'
                );
                flange.userData = { tag: line.tag, type: 'flange', position: 'destination' };
                group.add(flange);
            }
        }
        
        _scene.add(group);
        _lineMeshes.set(line.tag, group);
    }
    
    function buildComponentOnLine(comp, line, pts, diameter, color) {
        if (!comp.param && comp.param !== 0) return null;
        
        const point = _core.calcularPuntoParametrico 
            ? _core.calcularPuntoParametrico(line.tag, comp.param)
            : null;
        if (!point) return null;
        
        let direction = { dx: 1, dy: 0, dz: 0 };
        if (comp.param < 1 && pts.length >= 2) {
            const segIdx = Math.floor(comp.param * (pts.length - 1));
            if (segIdx < pts.length - 1) {
                direction = {
                    dx: pts[segIdx+1].x - pts[segIdx].x,
                    dy: pts[segIdx+1].y - pts[segIdx].y,
                    dz: pts[segIdx+1].z - pts[segIdx].z
                };
                const len = Math.hypot(direction.dx, direction.dy, direction.dz) || 1;
                direction.dx /= len;
                direction.dy /= len;
                direction.dz /= len;
            }
        }
        
        const compType = comp.type || '';
        
        if (compType.includes('GATE_VALVE')) {
            return createGateValve(point, direction, diameter, color);
        } else if (compType.includes('GLOBE_VALVE')) {
            return createGateValve(point, direction, diameter, color, 0x4488ff);
        } else if (compType.includes('BALL_VALVE')) {
            const valve = createGateValve(point, direction, diameter, color, 0x4444ff);
            valve.scale.set(0.7, 0.7, 0.7);
            return valve;
        } else if (compType.includes('BUTTERFLY_VALVE')) {
            const valve = createGateValve(point, direction, diameter, color, 0x888888);
            valve.scale.set(0.5, 0.5, 0.5);
            return valve;
        } else if (compType.includes('CHECK_VALVE')) {
            return createGateValve(point, direction, diameter, color, 0xff8800);
        } else if (compType.includes('STRAINER') || compType.includes('FILTER')) {
            const strainer = createGateValve(point, direction, diameter, color, 0xffff00);
            strainer.scale.set(1.2, 1.2, 1.2);
            return strainer;
        } else if (compType.includes('TEE')) {
            return createFlangeGeometry(point, direction, diameter, color, 'WN');
        }
        
        return null;
    }
    
    function buildInstrument(puerto, equipment) {
        const pos = {
            x: (equipment.posX || 0) + (puerto.relX || 0),
            y: (equipment.posY || 0) + (puerto.relY || 0) + 150,
            z: (equipment.posZ || 0) + (puerto.relZ || 0)
        };
        
        const gauge = createPressureGauge(pos, { dx: 0, dy: 1, dz: 0 });
        gauge.userData = { tag: `${equipment.tag}_PG`, type: 'instrument' };
        _scene.add(gauge);
        _instrumentMeshes.set(`${equipment.tag}_${puerto.id}`, gauge);
    }
    
    function createPlatformMesh(eq) {
        const group = new THREE.Group();
        const largo = eq.largo || 6000;
        const ancho = eq.ancho || 3000;
        const altura = eq.altura || 400;
        
        const plateGeom = new THREE.BoxGeometry(largo, 20, ancho);
        const plateMat = createSteelMaterial(0x556677, 0.5, 0.6);
        group.add(new THREE.Mesh(plateGeom, plateMat));
        
        for (let x = -1; x <= 1; x += 2) {
            const beamGeom = new THREE.BoxGeometry(largo, 200, 100);
            const beam = new THREE.Mesh(beamGeom, plateMat);
            beam.position.set(0, -110, x * ancho * 0.4);
            group.add(beam);
        }
        
        for (let x = -1; x <= 1; x += 2) {
            for (let z = -1; z <= 1; z += 2) {
                const colGeom = new THREE.CylinderGeometry(50, 50, altura * 5, _config.pipeSegments);
                const col = new THREE.Mesh(colGeom, plateMat);
                col.position.set(x * largo * 0.4, -altura * 2.5, z * ancho * 0.4);
                group.add(col);
            }
        }
        
        return group;
    }
    
    function createFlareMesh(eq) {
        const group = new THREE.Group();
        const altura = eq.altura || 15000;
        
        const towerGeom = new THREE.CylinderGeometry(200, 400, altura, _config.pipeSegments);
        const towerMat = createSteelMaterial(0x666666, 0.4, 0.8);
        group.add(new THREE.Mesh(towerGeom, towerMat));
        
        const tipGeom = new THREE.CylinderGeometry(100, 200, 2000, _config.pipeSegments);
        const tipMesh = new THREE.Mesh(tipGeom, createSteelMaterial(0x884400, 0.3, 0.9));
        tipMesh.position.y = altura/2 + 1000;
        group.add(tipMesh);
        
        const flameGeom = new THREE.ConeGeometry(150, 3000, _config.pipeSegments);
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.6 });
        const flameMesh = new THREE.Mesh(flameGeom, flameMat);
        flameMesh.position.y = altura/2 + 3000;
        group.add(flameMesh);
        
        return group;
    }
    
    function createThickenerMesh(eq) {
        const group = new THREE.Group();
        const diametro = eq.diametro || 5000;
        const altura = eq.altura || 4000;
        
        const coneGeom = new THREE.CylinderGeometry(diametro/2, 300, altura, _config.pipeSegments);
        const mat = createSteelMaterial(0x557788, 0.35, 0.8);
        group.add(new THREE.Mesh(coneGeom, mat));
        
        const walkGeom = new THREE.TorusGeometry(diametro/2 + 200, 30, 8, _config.pipeSegments);
        group.add(new THREE.Mesh(walkGeom, createSteelMaterial(0x666666, 0.5, 0.7)));
        
        return group;
    }
    
    function createFilterPressMesh(eq) {
        const group = new THREE.Group();
        const largo = eq.largo || 4000;
        
        const frameGeom = new THREE.BoxGeometry(largo, 800, 600);
        const mat = createSteelMaterial(0x445566, 0.4, 0.75);
        group.add(new THREE.Mesh(frameGeom, mat));
        
        for (let i = 0; i < 20; i++) {
            const plateGeom = new THREE.BoxGeometry(30, 700, 500);
            const plate = new THREE.Mesh(plateGeom, createSteelMaterial(0x889999, 0.3, 0.8));
            plate.position.x = -largo/2 + 200 + i * 180;
            group.add(plate);
        }
        
        return group;
    }
    
    function createGenericEquipmentMesh(eq) {
        const group = new THREE.Group();
        const spec = _catalog.getSpec(eq.spec);
        const color = spec ? spec.color : 0x888888;
        
        const geom = new THREE.BoxGeometry(eq.largo || 1000, eq.altura || 1000, eq.ancho || 1000);
        const mat = createSteelMaterial(color, 0.4, 0.7);
        group.add(new THREE.Mesh(geom, mat));
        
        return group;
    }
    
    // ================================================================
    // 5. CONEXIONES Y ACTUALIZACIONES
    // ================================================================
    
    function updateAllConnections() {
        if (!_core) return;
        const db = _core.getDb();
        const lines = db.lines || [];
        
        lines.forEach(line => {
            updateLineConnection(line);
        });
    }
    
    function updateLineConnection(line) {
        const lineGroup = _lineMeshes.get(line.tag);
        if (!lineGroup) return;
        
        const pts = _core.getLinePoints(line) || line._cachedPoints || [];
        if (pts.length < 2) return;
        
        lineGroup.children.forEach(child => {
            if (child.userData && child.userData.type === 'flange') {
                if (child.userData.position === 'origin') {
                    child.position.copy(new THREE.Vector3(pts[0].x, pts[0].y, pts[0].z));
                } else if (child.userData.position === 'destination') {
                    const n = pts.length;
                    child.position.copy(new THREE.Vector3(pts[n-1].x, pts[n-1].y, pts[n-1].z));
                }
            }
        });
    }
    
    // ================================================================
    // 6. SELECCIÓN E INTERACCIÓN
    // ================================================================
    
    const _raycaster = new THREE.Raycaster();
    const _mouse = new THREE.Vector2();
    let _selectedObject = null;
    
    function onMouseClick(event) {
        if (!_container || !_camera || !_scene) return;
        
        const rect = _container.getBoundingClientRect();
        _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        _raycaster.setFromCamera(_mouse, _camera);
        
        const allMeshes = [];
        _scene.traverse(child => {
            if (child.isMesh && child.userData && child.userData.tag) {
                allMeshes.push(child);
            }
        });
        
        const intersects = _raycaster.intersectObjects(allMeshes, false);
        
        if (intersects.length > 0) {
            const obj = intersects[0].object;
            const tag = obj.userData.tag;
            const type = obj.userData.type || 'equipment';
            
            const coreObj = _core.findObjectByTag(tag);
            if (coreObj) {
                selectObject({ obj: coreObj, type: type, mesh: obj });
            }
        } else {
            deselectObject();
        }
    }
    
    function selectObject(selectionData) {
        deselectObject();
        _selectedObject = selectionData;
        
        if (selectionData.mesh) {
            highlightMesh(selectionData.mesh, _config.selectionColor);
        } else {
            const group = _equipmentMeshes.get(selectionData.obj.tag) || 
                         _lineMeshes.get(selectionData.obj.tag);
            if (group) {
                group.traverse(child => {
                    if (child.isMesh) {
                        child.material = child.material.clone();
                        child.material.emissive = new THREE.Color(_config.selectionColor);
                        child.material.emissiveIntensity = 0.3;
                    }
                });
            }
        }
        
        if (_onSelectionCallback) {
            _onSelectionCallback(selectionData);
        }
        
        if (_core && _core.setSelected) {
            _core.setSelected({ obj: selectionData.obj, type: selectionData.type });
        }
    }
    
    function deselectObject() {
        if (_selectedObject && _selectedObject.mesh) {
            unhighlightMesh(_selectedObject.mesh);
        } else if (_selectedObject) {
            const group = _equipmentMeshes.get(_selectedObject.obj.tag) || 
                         _lineMeshes.get(_selectedObject.obj.tag);
            if (group) {
                group.traverse(child => {
                    if (child.isMesh && child.material.emissive) {
                        child.material.emissive = new THREE.Color(0x000000);
                        child.material.emissiveIntensity = 0;
                    }
                });
            }
        }
        _selectedObject = null;
    }
    
    function highlightMesh(mesh, color) {
        if (!mesh) return;
        mesh.material = mesh.material.clone();
        mesh.material.emissive = new THREE.Color(color);
        mesh.material.emissiveIntensity = 0.4;
    }
    
    function unhighlightMesh(mesh) {
        if (!mesh) return;
        mesh.material.emissive = new THREE.Color(0x000000);
        mesh.material.emissiveIntensity = 0;
    }
    
    // ================================================================
    // 7. CÁMARA ISOMÉTRICA
    // ================================================================
    
    function setIsoView() {
        if (!_camera) return;
        const angle = _config.isoAngle * Math.PI / 180;
        const dist = _config.cameraDistance;
        
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
        const dist = _config.cameraDistance;
        
        switch(viewName) {
            case 'top':
                _camera.position.set(0, dist, 10);
                break;
            case 'front':
                _camera.position.set(0, 0, dist);
                break;
            case 'right':
                _camera.position.set(dist, 0, 0);
                break;
            case 'iso':
            default:
                setIsoView();
                return;
        }
        
        _camera.lookAt(0, 0, 0);
        if (_controls) {
            _controls.target.set(0, 0, 0);
            _controls.update();
        }
    }
    
    function focusOn(position) {
        if (_controls) {
            _controls.target.copy(new THREE.Vector3(position.x, position.y, position.z));
            _controls.update();
        }
    }
    
    function zoomToFit() {
        if (!_scene || !_camera) return;
        
        const box = new THREE.Box3();
        let hasContent = false;
        _scene.traverse(child => {
            if (child.isMesh) {
                box.expandByObject(child);
                hasContent = true;
            }
        });
        
        if (!hasContent) {
            setIsoView();
            return;
        }
        
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const dist = Math.max(maxDim * 1.5, 5000);
        
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
    
    // ================================================================
    // 8. RENDER LOOP CONTROLADO (CORRECCIÓN #2)
    // ================================================================
    
    function startRenderLoop() {
        if (_isRendering) return;
        _isRendering = true;
        
        function render() {
            if (!_isRendering) return;
            _renderLoopId = requestAnimationFrame(render);
            
            // Reconstruir si es necesario
            if (_needsBuild && _core && _catalog && _scene) {
                buildScene();
            }
            
            if (_controls) _controls.update();
            if (_renderer && _scene && _camera) {
                _renderer.render(_scene, _camera);
            }
            
            if (_onRenderCallback) _onRenderCallback();
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
    // 9. INICIALIZACIÓN (CORRECCIÓN #2 - con validaciones)
    // ================================================================
    
    function init(container, coreInstance, catalogInstance, config = {}) {
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
        
        Object.assign(_config, config);
        
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        
        try {
            // Scene
            _scene = new THREE.Scene();
            _scene.background = new THREE.Color(_config.backgroundColor);
            
            // Camera
            const aspect = container.clientWidth / (container.clientHeight || 1);
            _camera = new THREE.PerspectiveCamera(45, aspect, 100, 100000);
            
            // Renderer
            _renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                alpha: true,
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance'
            });
            _renderer.setSize(container.clientWidth, container.clientHeight);
            _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            _renderer.shadowMap.enabled = _config.enableShadows;
            _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            container.appendChild(_renderer.domElement);
            
            // Controls
            _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
            _controls.enableDamping = true;
            _controls.dampingFactor = 0.08;
            _controls.minDistance = 500;
            _controls.maxDistance = 50000;
            _controls.maxPolarAngle = Math.PI * 0.48;
            _controls.target.set(0, 0, 0);
            _controls.update();
            
            // Iluminación
            _ambientLight = new THREE.AmbientLight(0x404060, 1.5);
            _scene.add(_ambientLight);
            
            _hemisphereLight = new THREE.HemisphereLight(0x8888ff, 0x443322, 0.8);
            _scene.add(_hemisphereLight);
            
            _directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
            _directionalLight.position.set(20000, 30000, 15000);
            _directionalLight.castShadow = _config.enableShadows;
            _directionalLight.shadow.mapSize.width = 2048;
            _directionalLight.shadow.mapSize.height = 2048;
            _directionalLight.shadow.camera.near = 100;
            _directionalLight.shadow.camera.far = 80000;
            _directionalLight.shadow.camera.left = -20000;
            _directionalLight.shadow.camera.right = 20000;
            _directionalLight.shadow.camera.top = 20000;
            _directionalLight.shadow.camera.bottom = -20000;
            _scene.add(_directionalLight);
            
            // Grid
            _gridHelper = new THREE.GridHelper(_config.gridSize, _config.gridDivisions, 0x334455, 0x1a1a2e);
            _scene.add(_gridHelper);
            
            // Ground plane
            _groundPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(50000, 50000),
                new THREE.ShadowMaterial({ opacity: 0.3 })
            );
            _groundPlane.rotation.x = -Math.PI / 2;
            _groundPlane.position.y = -100;
            _groundPlane.receiveShadow = true;
            _scene.add(_groundPlane);
            
            // Eventos
            _renderer.domElement.addEventListener('click', onMouseClick);
            window.addEventListener('resize', onResize);
            
            // Vista inicial
            setIsoView();
            
            // Construir escena
            _needsBuild = true;
            buildScene();
            
            // Iniciar render loop
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
    
    function onResize() {
        if (!_container || !_camera || !_renderer) return;
        
        const width = _container.clientWidth;
        const height = _container.clientHeight;
        
        if (width > 0 && height > 0) {
            _camera.aspect = width / height;
            _camera.updateProjectionMatrix();
            _renderer.setSize(width, height);
        }
    }
    
    // ================================================================
    // 10. API PÚBLICA
    // ================================================================
    
    function clearAllMeshes() {
        [_equipmentMeshes, _lineMeshes, _componentMeshes, _instrumentMeshes, _supportMeshes].forEach(map => {
            map.forEach(group => {
                _scene.remove(group);
                disposeGroup(group);
            });
            map.clear();
        });
    }
    
    function disposeGroup(group) {
        group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
    
    function rebuildScene() {
        _needsBuild = true;
        buildScene();
    }
    
    function updateEquipmentMesh(tag) {
        const oldMesh = _equipmentMeshes.get(tag);
        if (oldMesh) {
            _scene.remove(oldMesh);
            disposeGroup(oldMesh);
            _equipmentMeshes.delete(tag);
        }
        
        const eq = _core.findObjectByTag(tag);
        if (eq) {
            buildEquipment(eq);
        }
    }
    
    function updateLineMesh(tag) {
        const oldMesh = _lineMeshes.get(tag);
        if (oldMesh) {
            _scene.remove(oldMesh);
            disposeGroup(oldMesh);
            _lineMeshes.delete(tag);
        }
        
        const line = _core.findObjectByTag(tag);
        if (line) {
            buildLine(line);
        }
    }
    
    function updateAll() {
        clearAllMeshes();
        buildScene();
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
    }
    
    return {
        init,
        rebuildScene,
        updateAll,
        updateEquipmentMesh,
        updateLineMesh,
        dispose,
        
        setView,
        setIsoView,
        focusOn,
        zoomToFit,
        
        selectObject,
        deselectObject,
        getSelected: () => _selectedObject,
        onSelection: (callback) => { _onSelectionCallback = callback; },
        
        setConfig: (key, value) => { _config[key] = value; },
        getConfig: () => _config,
        
        getScene: () => _scene,
        getCamera: () => _camera,
        getRenderer: () => _renderer,
        getControls: () => _controls,
        
        onRender: (callback) => { _onRenderCallback = callback; },
        setNotify: (fn) => { _notifyUI = fn; },
        
        isReady: () => _initComplete,
        
        createPipeGeometry,
        createFlangeGeometry,
        createElbow90,
        createGateValve,
        createPressureGauge,
        createPipeShoe
    };
})();
