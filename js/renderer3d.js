
// ============================================================
// SMARTFLOW RENDER ENGINE v4.0 - Motor de Renderizado 3D Industrial
// Archivo: js/renderer3d.js
// Compatible: SmartFlowCore v5.5 + SmartFlowCatalog v4.0
// Características: Isométrico 3D, PBR, Sombras, Detalles industriales
// ============================================================

const SmartFlowRenderer3D = (function() {
    
    // ================================================================
    // 0. VERIFICACIÓN CRÍTICA DE THREE.js
    // ================================================================
    if (typeof THREE === 'undefined') {
        console.error('❌ SmartFlowRenderer3D: THREE.js no está cargado.');
        return {
            init: function() { return false; },
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
            createPipeShoe: function() { return null; },
            dispose: function() {}
        };
    }
    
    // ================================================================
    // 1. REFERENCIAS Y ESTADO INTERNO
    // ================================================================
    let _core = null;
    let _catalog = null;
    
    let _scene, _camera, _renderer, _controls;
    let _container = null;
    
    let _ambientLight, _directionalLight, _hemisphereLight;
    
    let _equipmentMeshes = new Map();
    let _lineMeshes = new Map();
    let _componentMeshes = new Map();
    let _instrumentMeshes = new Map();
    let _supportMeshes = new Map();
    let _gridHelper, _groundPlane;
    
    let _config = {
        isoAngle: 30,
        cameraDistance: 20000,
        backgroundColor: 0x0a0e17,
        gridSize: 20000,
        gridDivisions: 40,
        enableShadows: true,
        enablePostProcessing: false,
        enableBloom: false,
        enableAO: false,
        enableAA: false,
        enableLOD: true,
        pipeSegments: 24,
        flangeDetail: 20,
        valveDetail: 24,
        animationSpeed: 0.5,
        highlightColor: 0xffd700,
        selectionColor: 0xffd700
    };
    
    let _renderLoopId = null;
    let _isRendering = false;
    let _needsBuild = true;
    let _initComplete = false;
    
    let _onSelectionCallback = null;
    let _onRenderCallback = null;
    let _notifyUI = function(msg, isErr) { console.log(msg); };
    
    // ================================================================
    // 2. TEXTURAS PROCEDURALES Y MATERIALES PBR MEJORADOS
    // ================================================================
    
    function createMetalTexture(baseColor, roughness, metalness, pattern) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = baseColor;
        ctx.fillRect(0, 0, 256, 256);
        
        for (let i = 0; i < 2000; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            const alpha = Math.random() * 0.06;
            ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
            ctx.fillRect(x, y, Math.random() * 5 + 1, Math.random() * 5 + 1);
        }
        
        if (pattern === 'brushed') {
            ctx.strokeStyle = 'rgba(255,255,255,0.02)';
            ctx.lineWidth = 1;
            for (let y = 0; y < 256; y += 3) {
                ctx.beginPath();
                ctx.moveTo(0, y + Math.random() * 2);
                ctx.lineTo(256, y + Math.random() * 2);
                ctx.stroke();
            }
        }
        
        if (pattern === 'welded') {
            ctx.strokeStyle = 'rgba(180,180,180,0.12)';
            ctx.lineWidth = 2;
            for (let x = 0; x < 256; x += 10) {
                ctx.beginPath();
                let y = 128;
                for (let sx = x; sx < x + 10 && sx < 256; sx++) {
                    y += Math.sin(sx * 0.5) * 2.5;
                    ctx.lineTo(sx, y);
                }
                ctx.stroke();
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }
    
    const _materialCache = {};
    
    function getMaterial(color, roughness, metalness, pattern) {
        const key = color.toString(16) + '_' + roughness.toFixed(2) + '_' + metalness.toFixed(2) + '_' + (pattern || 'none');
        if (_materialCache[key]) return _materialCache[key].clone();
        
        const mat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: roughness,
            metalness: metalness
        });
        
        if (pattern && pattern !== 'none') {
            const hex = '#' + color.toString(16).padStart(6, '0');
            mat.map = createMetalTexture(hex, roughness, metalness, pattern);
        }
        
        _materialCache[key] = mat;
        return mat.clone();
    }
    
    function createSteelMaterial(color, roughness, metalness, pattern) {
        return getMaterial(color || 0x64748b, roughness !== undefined ? roughness : 0.35, metalness !== undefined ? metalness : 0.85, pattern || 'brushed');
    }
    
    function createPlasticMaterial(color, roughness, metalness) {
        return new THREE.MeshStandardMaterial({
            color: color || 0x7c3aed,
            roughness: roughness !== undefined ? roughness : 0.5,
            metalness: metalness !== undefined ? metalness : 0.1
        });
    }
    
    function createGlassMaterial(color) {
        return new THREE.MeshPhysicalMaterial({
            color: color || 0x88ccff,
            roughness: 0.05,
            metalness: 0.05,
            transparent: true,
            opacity: 0.4
        });
    }
    
    function createRubberMaterial(color) {
        return new THREE.MeshStandardMaterial({
            color: color || 0x333333,
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
    
    // ================================================================
    // 3. GENERADORES DE GEOMETRÍA - TUBERÍA Y BRIDAS
    // ================================================================
    
    function createPipeGeometry(start, end, diameter, specColor, materialType) {
        const dir = new THREE.Vector3().subVectors(
            new THREE.Vector3(end.x, end.y, end.z),
            new THREE.Vector3(start.x, start.y, start.z)
        );
        const length = dir.length();
        if (length < 0.1) return new THREE.Group();
        
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        materialType = materialType || 'CS';
        
        let pipeMaterial;
        switch(materialType.toUpperCase()) {
            case 'SS': case 'INOX': case '316L':
                pipeMaterial = createSteelMaterial(specColor || 0xc0c0c0, 0.2, 0.9, 'brushed');
                break;
            case 'PPR': case 'PP': case 'HDPE': case 'PE':
                pipeMaterial = createPlasticMaterial(specColor || 0x7c3aed, 0.45, 0.05);
                break;
            case 'PVC': case 'CPVC':
                pipeMaterial = createPlasticMaterial(specColor || 0xeab308, 0.4, 0.05);
                break;
            case 'FRP':
                pipeMaterial = createPlasticMaterial(specColor || 0x8b5cf6, 0.5, 0.05);
                break;
            default:
                pipeMaterial = createSteelMaterial(specColor || 0x64748b, 0.4, 0.8, 'brushed');
        }
        
        const pipeGeom = new THREE.CylinderGeometry(radius, radius, length, _config.pipeSegments);
        const pipeMesh = new THREE.Mesh(pipeGeom, pipeMaterial);
        pipeMesh.castShadow = true;
        pipeMesh.receiveShadow = true;
        group.add(pipeMesh);
        
        const mt = materialType.toUpperCase();
        if (mt === 'CS' || mt === 'SS' || mt === 'INOX' || mt === '316L') {
            const weldSpacing = 6000;
            const numWelds = Math.floor(length / weldSpacing);
            for (let w = 1; w <= numWelds; w++) {
                const weldGeom = new THREE.TorusGeometry(radius + 0.5, 1.5, 8, _config.pipeSegments);
                const weldMat = createSteelMaterial(0x888888, 0.3, 0.7);
                const weld = new THREE.Mesh(weldGeom, weldMat);
                weld.rotation.x = Math.PI / 2;
                weld.position.y = -length/2 + w * weldSpacing;
                group.add(weld);
            }
        }
        
        if (mt === 'CS') {
            const coatingGeom = new THREE.CylinderGeometry(radius + 0.8, radius + 0.8, length, _config.pipeSegments);
            const coatingMat = new THREE.MeshStandardMaterial({
                color: specColor || 0x556677,
                roughness: 0.6,
                metalness: 0.05,
                transparent: true,
                opacity: 0.12
            });
            const coating = new THREE.Mesh(coatingGeom, coatingMat);
            group.add(coating);
        }
        
        group.position.set(
            (start.x + end.x) / 2,
            (start.y + end.y) / 2,
            (start.z + end.z) / 2
        );
        
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            dir.normalize()
        );
        group.setRotationFromQuaternion(quaternion);
        
        return group;
    }
    
    function createFlangeGeometry(position, direction, diameter, specColor, flangeType, materialType) {
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        const flangeRadius = radius * 1.5;
        const flangeThickness = diameter <= 4 ? 15 : diameter <= 8 ? 22 : 28;
        const boltRadius = flangeRadius * 0.82;
        const numBolts = diameter <= 4 ? 8 : diameter <= 8 ? 12 : 16;
        materialType = materialType || 'CS';
        
        const flangeMat = createSteelMaterial(specColor || 0x64748b, 0.3, 0.9, 'brushed');
        const boltMat = createSteelMaterial(0x404040, 0.2, 0.95);
        const rfMat = createSteelMaterial(0xc0c0c0, 0.1, 0.95);
        
        const flangeGeom = new THREE.CylinderGeometry(flangeRadius, flangeRadius, flangeThickness, _config.flangeDetail);
        const flangeMesh = new THREE.Mesh(flangeGeom, flangeMat);
        flangeMesh.castShadow = true;
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
        const rfMesh = new THREE.Mesh(rfGeom, rfMat);
        rfMesh.position.y = flangeThickness/2 + rfHeight/2;
        group.add(rfMesh);
        
        for (let i = 0; i < 5; i++) {
            const ringGeom = new THREE.TorusGeometry(radius * (0.9 - i * 0.1), 0.2, 8, _config.flangeDetail);
            const ringMesh = new THREE.Mesh(ringGeom, rfMat);
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.y = flangeThickness/2 + rfHeight + 0.2;
            group.add(ringMesh);
        }
        
        const boltGeom = new THREE.CylinderGeometry(1.5, 1.5, flangeThickness + 10, 8);
        
        for (let i = 0; i < numBolts; i++) {
            const angle = (i / numBolts) * Math.PI * 2;
            const boltGroup = new THREE.Group();
            
            const boltMesh = new THREE.Mesh(boltGeom, boltMat);
            boltGroup.add(boltMesh);
            
            const headGeom = new THREE.CylinderGeometry(3.5, 3.5, 5, 6);
            const headMesh = new THREE.Mesh(headGeom, boltMat);
            headMesh.position.y = -flangeThickness/2 - 7;
            boltGroup.add(headMesh);
            
            const nutGeom = new THREE.CylinderGeometry(3, 3, 4, 6);
            const nutTop = new THREE.Mesh(nutGeom, boltMat);
            nutTop.position.y = flangeThickness/2 + 5;
            boltGroup.add(nutTop);
            
            boltGroup.position.set(
                Math.cos(angle) * boltRadius,
                0,
                Math.sin(angle) * boltRadius
            );
            group.add(boltGroup);
        }
        
        group.position.set(position.x, position.y, position.z);
        
        const dirVec = new THREE.Vector3(direction.dx, direction.dy, direction.dz).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVec);
        group.setRotationFromQuaternion(quat);
        
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    
    function createElbow90(position, directionIn, directionOut, diameter, specColor, materialType) {
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        const bendRadius = radius * 1.5;
        materialType = materialType || 'CS';
        
        let material;
        if (materialType.toUpperCase() === 'SS' || materialType.toUpperCase() === 'INOX') {
            material = createSteelMaterial(specColor || 0xc0c0c0, 0.2, 0.9, 'brushed');
        } else {
            material = createSteelMaterial(specColor || 0x64748b, 0.35, 0.85, 'brushed');
        }
        
        const torusGeom = new THREE.TorusGeometry(bendRadius, radius, _config.pipeSegments, _config.pipeSegments, Math.PI / 2);
        const torusMesh = new THREE.Mesh(torusGeom, material);
        torusMesh.castShadow = true;
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
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    // ================================================================
    // CONTINUACIÓN: VÁLVULAS, BOMBAS, TANQUES, INTERCAMBIADORES
    // ================================================================
    
    function createGateValve(position, direction, diameter, specColor, handwheelColor, materialType) {
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        const bodyLength = diameter * 25.4 * 1.5;
        const bodyWidth = radius * 2.2;
        const bonnetHeight = radius * 2;
        const stemHeight = radius * 3;
        materialType = materialType || 'CS';
        handwheelColor = handwheelColor || 0xff4444;
        
        const bodyMat = createSteelMaterial(specColor || 0x64748b, 0.3, 0.9, 'brushed');
        const flangeMat = createSteelMaterial(specColor || 0x64748b, 0.25, 0.9);
        const handwheelMat = new THREE.MeshStandardMaterial({
            color: handwheelColor,
            roughness: 0.4,
            metalness: 0.2
        });
        const stemMat = createSteelMaterial(0x888888, 0.2, 0.95);
        
        // Cuerpo principal
        const bodyGeom = new THREE.BoxGeometry(bodyLength, bodyWidth, bodyWidth, 2, _config.valveDetail, _config.valveDetail);
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        bodyMesh.castShadow = true;
        group.add(bodyMesh);
        
        // Bridas de conexión con detalle
        const flangeThickness = 10;
        const flangeGeom = new THREE.CylinderGeometry(radius * 1.4, radius * 1.4, flangeThickness, _config.flangeDetail);
        
        const flange1 = new THREE.Mesh(flangeGeom, flangeMat);
        flange1.rotation.x = Math.PI / 2;
        flange1.position.z = -bodyLength/2;
        group.add(flange1);
        
        const flange2 = new THREE.Mesh(flangeGeom.clone(), flangeMat);
        flange2.rotation.x = Math.PI / 2;
        flange2.position.z = bodyLength/2;
        group.add(flange2);
        
        // Bonete (cúpula)
        const bonnetGeom = new THREE.CylinderGeometry(radius * 0.6, radius, bonnetHeight, _config.valveDetail);
        const bonnetMesh = new THREE.Mesh(bonnetGeom, bodyMat);
        bonnetMesh.position.y = bodyWidth/2 + bonnetHeight/2;
        bonnetMesh.castShadow = true;
        group.add(bonnetMesh);
        
        // Pernos del bonete
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const boltGeom = new THREE.CylinderGeometry(2, 2, 12, 6);
            const bolt = new THREE.Mesh(boltGeom, createSteelMaterial(0x404040, 0.2, 0.95));
            bolt.position.set(
                Math.cos(angle) * radius * 0.7,
                bodyWidth/2 - 2,
                Math.sin(angle) * radius * 0.7
            );
            group.add(bolt);
        }
        
        // Prensaestopas
        const glandGeom = new THREE.CylinderGeometry(radius * 0.25, radius * 0.3, 8, _config.valveDetail);
        const glandMesh = new THREE.Mesh(glandGeom, stemMat);
        glandMesh.position.y = bodyWidth/2 + bonnetHeight;
        group.add(glandMesh);
        
        // Vástago (roscado)
        const stemGeom = new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, stemHeight, _config.valveDetail);
        const stemMesh = new THREE.Mesh(stemGeom, stemMat);
        stemMesh.position.y = bodyWidth/2 + bonnetHeight + stemHeight/2;
        stemMesh.castShadow = true;
        group.add(stemMesh);
        
        // Volante (handwheel)
        const handwheelGeom = new THREE.TorusGeometry(radius * 0.8, radius * 0.12, 8, _config.valveDetail);
        const handwheelMesh = new THREE.Mesh(handwheelGeom, handwheelMat);
        handwheelMesh.position.y = bodyWidth/2 + bonnetHeight + stemHeight;
        group.add(handwheelMesh);
        
        // Radios del volante
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const spokeGeom = new THREE.CylinderGeometry(1.5, 1.5, radius * 0.7, 6);
            const spoke = new THREE.Mesh(spokeGeom, handwheelMat);
            spoke.position.set(
                Math.cos(angle) * radius * 0.35,
                bodyWidth/2 + bonnetHeight + stemHeight,
                Math.sin(angle) * radius * 0.35
            );
            group.add(spoke);
        }
        
        // Indicador de posición (placa)
        const indicatorGeom = new THREE.BoxGeometry(6, 15, 3);
        const indicatorMesh = new THREE.Mesh(indicatorGeom, createSteelMaterial(0xff4444, 0.3, 0.5));
        indicatorMesh.position.y = bodyWidth/2 + bonnetHeight + stemHeight/2;
        indicatorMesh.position.z = radius * 0.3;
        group.add(indicatorMesh);
        
        group.position.set(position.x, position.y, position.z);
        const dirVec = new THREE.Vector3(direction.dx, direction.dy, direction.dz).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirVec);
        group.setRotationFromQuaternion(quat);
        
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    
    function createBallValve(position, direction, diameter, specColor, materialType) {
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        const bodyLength = diameter * 25.4 * 1.2;
        materialType = materialType || 'CS';
        
        const bodyMat = createSteelMaterial(specColor || 0x64748b, 0.3, 0.9, 'brushed');
        const handleMat = createSteelMaterial(0x334455, 0.4, 0.85);
        const ballMat = createSteelMaterial(0xcccccc, 0.1, 0.95);
        
        // Cuerpo esférico
        const bodyGeom = new THREE.SphereGeometry(radius * 1.1, _config.valveDetail, _config.valveDetail);
        bodyGeom.scale(1, 0.8, 0.8);
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        bodyMesh.castShadow = true;
        group.add(bodyMesh);
        
        // Extremos de conexión
        for (let z = -1; z <= 1; z += 2) {
            const endGeom = new THREE.CylinderGeometry(radius * 0.8, radius * 0.8, radius * 0.6, _config.flangeDetail);
            const endMesh = new THREE.Mesh(endGeom, bodyMat);
            endMesh.rotation.x = Math.PI / 2;
            endMesh.position.z = z * (bodyLength/2 - radius * 0.3);
            group.add(endMesh);
            
            const faceGeom = new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 3, _config.flangeDetail);
            const faceMesh = new THREE.Mesh(faceGeom, ballMat);
            faceMesh.rotation.x = Math.PI / 2;
            faceMesh.position.z = z * bodyLength/2;
            group.add(faceMesh);
        }
        
        // Cuello del actuador
        const neckGeom = new THREE.CylinderGeometry(radius * 0.3, radius * 0.35, radius * 0.8, _config.valveDetail);
        const neckMesh = new THREE.Mesh(neckGeom, bodyMat);
        neckMesh.position.y = radius * 0.9;
        group.add(neckMesh);
        
        // Manija/palanca
        const handleGeom = new THREE.BoxGeometry(radius * 0.15, radius * 1.2, radius * 0.15);
        const handleMesh = new THREE.Mesh(handleGeom, handleMat);
        handleMesh.position.y = radius * 1.5;
        group.add(handleMesh);
        
        // Bola de la manija
        const gripGeom = new THREE.SphereGeometry(radius * 0.18, 8, 8);
        const gripMesh = new THREE.Mesh(gripGeom, createPlasticMaterial(0xff4444, 0.3, 0.1));
        gripMesh.position.y = radius * 2.1;
        group.add(gripMesh);
        
        group.position.set(position.x, position.y, position.z);
        const dirVec = new THREE.Vector3(direction.dx, direction.dy, direction.dz).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirVec);
        group.setRotationFromQuaternion(quat);
        
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    
    function createButterflyValve(position, direction, diameter, specColor, materialType) {
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        const bodyWidth = radius * 0.5;
        materialType = materialType || 'CS';
        
        const bodyMat = createSteelMaterial(specColor || 0x64748b, 0.3, 0.9);
        const discMat = createSteelMaterial(0x889999, 0.25, 0.9);
        const handleMat = createSteelMaterial(0x334455, 0.4, 0.85);
        
        // Cuerpo (anillo)
        const bodyGeom = new THREE.TorusGeometry(radius, bodyWidth, 8, _config.valveDetail);
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        bodyMesh.castShadow = true;
        group.add(bodyMesh);
        
        // Disco (mariposa)
        const discGeom = new THREE.CylinderGeometry(radius * 0.95, radius * 0.95, bodyWidth * 0.4, _config.valveDetail);
        const discMesh = new THREE.Mesh(discGeom, discMat);
        discMesh.rotation.z = Math.PI / 6;
        group.add(discMesh);
        
        // Eje
        const shaftGeom = new THREE.CylinderGeometry(radius * 0.12, radius * 0.12, radius * 2.5, 8);
        const shaftMesh = new THREE.Mesh(shaftGeom, createSteelMaterial(0x888888, 0.2, 0.95));
        shaftMesh.position.y = radius * 0.8;
        group.add(shaftMesh);
        
        // Manija
        const handleGeom = new THREE.BoxGeometry(radius * 0.12, radius * 1.5, radius * 0.12);
        const handleMesh = new THREE.Mesh(handleGeom, handleMat);
        handleMesh.position.y = radius * 1.8;
        group.add(handleMesh);
        
        // Selector de posición (muescas)
        const notchGeom = new THREE.CylinderGeometry(radius * 0.3, radius * 0.35, bodyWidth, 12);
        const notchMesh = new THREE.Mesh(notchGeom, bodyMat);
        notchMesh.position.y = radius * 0.1;
        group.add(notchMesh);
        
        group.position.set(position.x, position.y, position.z);
        
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    
    function createPumpMesh(equipmentData) {
        const group = new THREE.Group();
        const spec = _catalog.getSpec(equipmentData.spec);
        const color = spec ? spec.color : 0x64748b;
        
        const largo = equipmentData.largo || 1200;
        const ancho = equipmentData.ancho || 600;
        const altura = equipmentData.altura || 800;
        
        const baseMat = createSteelMaterial(0x404040, 0.5, 0.7);
        const carcasaMat = createSteelMaterial(color, 0.3, 0.9, 'brushed');
        const motorMat = createSteelMaterial(0x334455, 0.4, 0.85, 'brushed');
        const acopleMat = createSteelMaterial(0x888888, 0.25, 0.9);
        
        // Base de montaje
        const baseGeom = new THREE.BoxGeometry(largo, 35, ancho);
        const baseMesh = new THREE.Mesh(baseGeom, baseMat);
        baseMesh.position.y = -altura/2;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        group.add(baseMesh);
        
        // Pernos de anclaje (4 esquinas)
        for (let bx = -1; bx <= 1; bx += 2) {
            for (let bz = -1; bz <= 1; bz += 2) {
                const boltGeom = new THREE.CylinderGeometry(6, 6, 20, 8);
                const bolt = new THREE.Mesh(boltGeom, createSteelMaterial(0x505050, 0.2, 0.9));
                bolt.position.set(bx * (largo/2 - 50), -altura/2 - 25, bz * (ancho/2 - 50));
                group.add(bolt);
            }
        }
        
        // Carcasa (voluta) - esfera achatada
        const voluteGeom = new THREE.SphereGeometry(ancho * 0.35, _config.valveDetail, _config.valveDetail);
        voluteGeom.scale(1, 0.55, 1.2);
        const voluteMesh = new THREE.Mesh(voluteGeom, carcasaMat);
        voluteMesh.position.y = -altura/4;
        voluteMesh.castShadow = true;
        group.add(voluteMesh);
        
        // Brida de succión
        const suctionGeom = new THREE.CylinderGeometry(ancho * 0.15, ancho * 0.15, 30, _config.flangeDetail);
        const suctionMesh = new THREE.Mesh(suctionGeom, carcasaMat);
        suctionMesh.rotation.x = Math.PI / 2;
        suctionMesh.position.set(-ancho * 0.35, -altura/4, 0);
        group.add(suctionMesh);
        
        // Brida de descarga
        const dischargeGeom = new THREE.CylinderGeometry(ancho * 0.12, ancho * 0.12, 25, _config.flangeDetail);
        const dischargeMesh = new THREE.Mesh(dischargeGeom, carcasaMat);
        dischargeMesh.position.set(ancho * 0.35, -altura/6, 0);
        group.add(dischargeMesh);
        
        // Acople motor-bomba
        const couplingGeom = new THREE.CylinderGeometry(ancho * 0.15, ancho * 0.2, largo * 0.1, _config.valveDetail);
        const couplingMesh = new THREE.Mesh(couplingGeom, acopleMat);
        couplingMesh.rotation.z = Math.PI / 2;
        couplingMesh.position.set(largo * 0.05, -altura/5, 0);
        group.add(couplingMesh);
        
        // Guarda del acople (reja de seguridad)
        const guardGeom = new THREE.TorusGeometry(ancho * 0.2, 3, 6, 12);
        const guardMesh = new THREE.Mesh(guardGeom, createSteelMaterial(0xffcc00, 0.4, 0.5));
        guardMesh.position.set(largo * 0.05, -altura/5, 0);
        group.add(guardMesh);
        
        // Motor eléctrico
        const motorGeom = new THREE.CylinderGeometry(ancho * 0.25, ancho * 0.25, largo * 0.45, _config.valveDetail);
        const motorMesh = new THREE.Mesh(motorGeom, motorMat);
        motorMesh.rotation.z = Math.PI / 2;
        motorMesh.position.set(largo * 0.25, -altura/5, 0);
        motorMesh.castShadow = true;
        group.add(motorMesh);
        
        // Aletas de refrigeración del motor
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const finGeom = new THREE.BoxGeometry(6, 18, ancho * 0.28);
            const fin = new THREE.Mesh(finGeom, motorMat);
            fin.position.set(largo * 0.25, -altura/5, 0);
            fin.rotation.z = angle;
            group.add(fin);
        }
        
        // Caja de conexiones
        const jboxGeom = new THREE.BoxGeometry(largo * 0.08, altura * 0.2, ancho * 0.2);
        const jboxMesh = new THREE.Mesh(jboxGeom, createSteelMaterial(0x445566, 0.5, 0.7));
        jboxMesh.position.set(largo * 0.15, altura * 0.05, ancho * 0.2);
        group.add(jboxMesh);
        
        // Placa de datos
        const plateGeom = new THREE.BoxGeometry(largo * 0.06, altura * 0.12, 2);
        const plateMesh = new THREE.Mesh(plateGeom, createSteelMaterial(0xc0c0c0, 0.2, 0.9));
        plateMesh.position.set(largo * 0.15, -altura/5 + ancho * 0.3, ancho * 0.2);
        group.add(plateMesh);
        
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    
    function createVerticalTank(equipmentData) {
        const group = new THREE.Group();
        const spec = _catalog.getSpec(equipmentData.spec);
        const color = spec ? spec.color : 0x64748b;
        
        const diametro = equipmentData.diametro || 2000;
        const altura = equipmentData.altura || 5000;
        const radius = diametro / 2;
        
        const bodyMat = createSteelMaterial(color, 0.3, 0.85, 'brushed');
        const ringMat = createSteelMaterial(0x505050, 0.3, 0.9);
        const roofMat = createSteelMaterial(0x556677, 0.35, 0.8);
        const nozzleMat = createSteelMaterial(0x8899aa, 0.25, 0.9);
        
        // Cuerpo principal
        const bodyGeom = new THREE.CylinderGeometry(radius, radius, altura, _config.pipeSegments, 1);
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        group.add(bodyMesh);
        
        // Anillos de refuerzo (cada 1000mm)
        const numRings = Math.floor(altura / 1000);
        for (let i = 1; i < numRings; i++) {
            const ringGeom = new THREE.TorusGeometry(radius + 8, 10, 8, _config.pipeSegments);
            const ringMesh = new THREE.Mesh(ringGeom, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.y = -altura/2 + i * 1000;
            group.add(ringMesh);
        }
        
        // Fondo toriesférico
        const bottomGeom = new THREE.SphereGeometry(radius * 1.1, _config.pipeSegments, _config.pipeSegments/2, 0, Math.PI * 2, 0, Math.PI/4);
        const bottomMesh = new THREE.Mesh(bottomGeom, bodyMat);
        bottomMesh.position.y = -altura/2;
        bottomMesh.castShadow = true;
        group.add(bottomMesh);
        
        // Techo cónico
        const roofGeom = new THREE.CylinderGeometry(radius * 0.15, radius, radius * 0.3, _config.pipeSegments);
        const roofMesh = new THREE.Mesh(roofGeom, roofMat);
        roofMesh.position.y = altura/2 + radius * 0.15;
        roofMesh.castShadow = true;
        group.add(roofMesh);
        
        // Ventilación en techo
        const ventGeom = new THREE.CylinderGeometry(20, 20, 60, 8);
        const ventMesh = new THREE.Mesh(ventGeom, roofMat);
        ventMesh.position.y = altura/2 + radius * 0.3 + 30;
        group.add(ventMesh);
        
        // Sombrerete del venteo
        const capGeom = new THREE.CylinderGeometry(35, 35, 10, 8);
        const capMesh = new THREE.Mesh(capGeom, roofMat);
        capMesh.position.y = altura/2 + radius * 0.3 + 60;
        group.add(capMesh);
        
        // Conexiones (boquillas) con bridas
        if (equipmentData.puertos) {
            equipmentData.puertos.forEach(function(puerto) {
                const nozzleGroup = new THREE.Group();
                
                const nozzleGeom = new THREE.CylinderGeometry(15, 15, radius * 0.4, _config.flangeDetail);
                const nozzleMesh = new THREE.Mesh(nozzleGeom, nozzleMat);
                nozzleGroup.add(nozzleMesh);
                
                const flangeGeom = new THREE.CylinderGeometry(28, 28, 8, _config.flangeDetail);
                const flangeMesh = new THREE.Mesh(flangeGeom, nozzleMat);
                flangeMesh.position.y = radius * 0.2;
                nozzleGroup.add(flangeMesh);
                
                nozzleGroup.position.set(puerto.relX || 0, puerto.relY || 0, puerto.relZ || 0);
                
                if (puerto.orientacion) {
                    const dir = new THREE.Vector3(puerto.orientacion.dx, puerto.orientacion.dy, puerto.orientacion.dz);
                    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
                    nozzleGroup.setRotationFromQuaternion(quat);
                }
                
                group.add(nozzleGroup);
            });
        }
        
        // Escalera vertical (en un lado)
        const ladderWidth = 300;
        for (let i = 0; i < 8; i++) {
            const rungGeom = new THREE.CylinderGeometry(6, 6, ladderWidth, 8);
            const rung = new THREE.Mesh(rungGeom, ringMat);
            rung.position.set(radius + 50, -altura/2 + 500 + i * 600, 0);
            rung.rotation.z = Math.PI / 2;
            group.add(rung);
        }
        
        // Soportes/piernas (3 o 4 patas)
        const numLegs = 3;
        for (let i = 0; i < numLegs; i++) {
            const angle = (i / numLegs) * Math.PI * 2;
            const legGeom = new THREE.CylinderGeometry(25, 30, 400, 8);
            const leg = new THREE.Mesh(legGeom, bodyMat);
            leg.position.set(
                Math.cos(angle) * radius * 0.8,
                -altura/2 - 200,
                Math.sin(angle) * radius * 0.8
            );
            leg.castShadow = true;
            group.add(leg);
            
            const baseGeom = new THREE.BoxGeometry(100, 15, 100);
            const baseMesh = new THREE.Mesh(baseGeom, ringMat);
            baseMesh.position.set(
                Math.cos(angle) * radius * 0.8,
                -altura/2 - 400,
                Math.sin(angle) * radius * 0.8
            );
            group.add(baseMesh);
        }
        
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    
    function createHeatExchanger(equipmentData) {
        const group = new THREE.Group();
        const spec = _catalog.getSpec(equipmentData.spec);
        const color = spec ? spec.color : 0x64748b;
        
        const largo = equipmentData.largo || 3000;
        const diametro = equipmentData.diametro || 600;
        const radius = diametro / 2;
        
        const shellMat = createSteelMaterial(color, 0.3, 0.85, 'brushed');
        const headMat = createSteelMaterial(0x556677, 0.35, 0.8, 'brushed');
        const saddleMat = createSteelMaterial(0x404040, 0.5, 0.7);
        const nozzleMat = createSteelMaterial(0x8899aa, 0.25, 0.9);
        
        // Carcasa
        const shellGeom = new THREE.CylinderGeometry(radius, radius, largo, _config.pipeSegments);
        const shellMesh = new THREE.Mesh(shellGeom, shellMat);
        shellMesh.rotation.z = Math.PI / 2;
        shellMesh.castShadow = true;
        shellMesh.receiveShadow = true;
        group.add(shellMesh);
        
        // Cabezales semiesféricos
        const headGeom = new THREE.SphereGeometry(radius, _config.pipeSegments, _config.pipeSegments/2);
        
        const headLeft = new THREE.Mesh(headGeom, headMat);
        headLeft.position.x = -largo/2;
        headLeft.castShadow = true;
        group.add(headLeft);
        
        const headRight = new THREE.Mesh(headGeom.clone(), headMat);
        headRight.position.x = largo/2;
        headRight.castShadow = true;
        group.add(headRight);
        
        // Soportes tipo montura
        for (let x = -1; x <= 1; x += 2) {
            const saddleGeom = new THREE.BoxGeometry(180, radius * 0.6, diametro * 0.35);
            const saddleMesh = new THREE.Mesh(saddleGeom, saddleMat);
            saddleMesh.position.set(x * largo * 0.3, -radius - radius * 0.3, 0);
            saddleMesh.castShadow = true;
            saddleMesh.receiveShadow = true;
            group.add(saddleMesh);
            
            // Placa base de la montura
            const basePlateGeom = new THREE.BoxGeometry(250, 15, diametro * 0.5);
            const basePlate = new THREE.Mesh(basePlateGeom, saddleMat);
            basePlate.position.set(x * largo * 0.3, -radius - radius * 0.6, 0);
            group.add(basePlate);
        }
        
        // Conexiones con bridas
        if (equipmentData.puertos) {
            equipmentData.puertos.forEach(function(puerto) {
                const nozzleGroup = new THREE.Group();
                
                const nozzleGeom = new THREE.CylinderGeometry(12, 12, radius * 0.5, _config.flangeDetail);
                const nozzleMesh = new THREE.Mesh(nozzleGeom, nozzleMat);
                nozzleGroup.add(nozzleMesh);
                
                const flangeGeom = new THREE.CylinderGeometry(22, 22, 6, _config.flangeDetail);
                const flangeMesh = new THREE.Mesh(flangeGeom, nozzleMat);
                flangeMesh.position.y = radius * 0.25;
                nozzleGroup.add(flangeMesh);
                
                nozzleGroup.position.set(puerto.relX || 0, puerto.relY || 0, puerto.relZ || 0);
                group.add(nozzleGroup);
            });
        }
        
        // Placa de identificación
        const nameplateGeom = new THREE.BoxGeometry(120, 80, 2);
        const nameplate = new THREE.Mesh(nameplateGeom, createSteelMaterial(0xc0c0c0, 0.2, 0.9));
        nameplate.position.set(0, radius + 40, 0);
        group.add(nameplate);
        
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    
 
    // ================================================================
    // CONTINUACIÓN: INSTRUMENTOS, SOPORTES, PLATAFORMA, ESCENA, CÁMARA, INIT
    // ================================================================
    
    function createPressureGauge(position, direction) {
        const group = new THREE.Group();
        
        const caseMat = createSteelMaterial(0x334155, 0.3, 0.85);
        const dialMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.05 });
        const needleMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.2, metalness: 0.3 });
        const brassMat = createBrassMaterial();
        
        // Caja
        const caseGeom = new THREE.CylinderGeometry(28, 28, 16, _config.valveDetail);
        const caseMesh = new THREE.Mesh(caseGeom, caseMat);
        caseMesh.castShadow = true;
        group.add(caseMesh);
        
        // Bisel
        const bezelGeom = new THREE.TorusGeometry(27, 3, 8, _config.valveDetail);
        const bezelMesh = new THREE.Mesh(bezelGeom, caseMat);
        bezelMesh.position.y = 9;
        group.add(bezelMesh);
        
        // Dial (esfera)
        const dialGeom = new THREE.CylinderGeometry(25, 25, 1.5, _config.valveDetail);
        const dialMesh = new THREE.Mesh(dialGeom, dialMat);
        dialMesh.position.y = 9;
        group.add(dialMesh);
        
        // Marcas de escala (líneas radiales)
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const tickGeom = new THREE.BoxGeometry(1, 8, 1);
            const tick = new THREE.Mesh(tickGeom, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
            tick.position.set(Math.cos(angle) * 14, 10, Math.sin(angle) * 14);
            tick.rotation.y = -angle;
            group.add(tick);
        }
        
        // Vidrio
        const glassGeom = new THREE.CylinderGeometry(24, 24, 1, _config.valveDetail);
        const glassMesh = new THREE.Mesh(glassGeom, createGlassMaterial(0xaaddff));
        glassMesh.position.y = 11;
        group.add(glassMesh);
        
        // Aguja
        const needleGeom = new THREE.BoxGeometry(1.5, 20, 0.5);
        const needleMesh = new THREE.Mesh(needleGeom, needleMat);
        needleMesh.position.y = 12;
        needleMesh.rotation.z = Math.PI / 6;
        group.add(needleMesh);
        
        // Eje central
        const hubGeom = new THREE.CylinderGeometry(3, 3, 3, 8);
        const hubMesh = new THREE.Mesh(hubGeom, brassMat);
        hubMesh.position.y = 12;
        group.add(hubMesh);
        
        // Conexión a proceso
        const connGeom = new THREE.CylinderGeometry(5, 8, 35, _config.flangeDetail);
        const connMesh = new THREE.Mesh(connGeom, caseMat);
        connMesh.position.y = -25;
        group.add(connMesh);
        
        // Rosca
        for (let i = 0; i < 4; i++) {
            const threadGeom = new THREE.TorusGeometry(8, 1, 4, _config.flangeDetail);
            const thread = new THREE.Mesh(threadGeom, caseMat);
            thread.position.y = -18 + i * 4;
            thread.rotation.x = Math.PI / 2;
            group.add(thread);
        }
        
        group.position.set(position.x, position.y, position.z);
        group.castShadow = true;
        
        return group;
    }
    
    function createTemperatureGauge(position) {
        const group = new THREE.Group();
        
        const caseMat = createSteelMaterial(0x334455, 0.3, 0.85);
        const dialMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.05 });
        const mercuryMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.8 });
        
        // Cuerpo alargado
        const bodyGeom = new THREE.CylinderGeometry(18, 18, 100, _config.valveDetail);
        const bodyMesh = new THREE.Mesh(bodyGeom, caseMat);
        bodyMesh.castShadow = true;
        group.add(bodyMesh);
        
        // Columna de mercurio
        const columnGeom = new THREE.CylinderGeometry(3, 3, 80, 8);
        const columnMesh = new THREE.Mesh(columnGeom, mercuryMat);
        columnMesh.position.y = -5;
        group.add(columnMesh);
        
        // Bulbo sensor
        const bulbGeom = new THREE.SphereGeometry(12, _config.valveDetail, _config.valveDetail);
        const bulbMesh = new THREE.Mesh(bulbGeom, caseMat);
        bulbMesh.position.y = -55;
        group.add(bulbMesh);
        
        // Dial superior
        const dialGeom = new THREE.CylinderGeometry(22, 22, 3, _config.valveDetail);
        const dialMesh = new THREE.Mesh(dialGeom, dialMat);
        dialMesh.position.y = 52;
        group.add(dialMesh);
        
        // Aguja
        const needleGeom = new THREE.BoxGeometry(1.5, 16, 0.5);
        const needle = new THREE.Mesh(needleGeom, new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.2 }));
        needle.position.y = 54;
        group.add(needle);
        
        group.position.set(position.x, position.y, position.z);
        group.castShadow = true;
        
        return group;
    }
    
    function createFlowMeter(position, direction) {
        const group = new THREE.Group();
        
        const bodyMat = createSteelMaterial(0x556677, 0.3, 0.9, 'brushed');
        const displayMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.1, metalness: 0.3 });
        const glassMat = createGlassMaterial(0x88ccff);
        
        // Cuerpo
        const bodyGeom = new THREE.CylinderGeometry(40, 40, 120, _config.valveDetail);
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        bodyMesh.castShadow = true;
        group.add(bodyMesh);
        
        // Bridas de conexión
        for (let z = -1; z <= 1; z += 2) {
            const flangeGeom = new THREE.CylinderGeometry(55, 55, 12, _config.flangeDetail);
            const flange = new THREE.Mesh(flangeGeom, bodyMat);
            flange.position.y = z * 66;
            group.add(flange);
        }
        
        // Display digital
        const displayGeom = new THREE.BoxGeometry(50, 40, 30);
        const displayMesh = new THREE.Mesh(displayGeom, displayMat);
        displayMesh.position.set(50, 0, 0);
        group.add(displayMesh);
        
        // Pantalla
        const screenGeom = new THREE.BoxGeometry(40, 25, 2);
        const screenMesh = new THREE.Mesh(screenGeom, glassMat);
        screenMesh.position.set(50, 0, 17);
        group.add(screenMesh);
        
        // Conector eléctrico
        const connGeom = new THREE.CylinderGeometry(8, 8, 20, 8);
        const connMesh = new THREE.Mesh(connGeom, createPlasticMaterial(0x334455));
        connMesh.position.set(50, -30, 0);
        group.add(connMesh);
        
        group.position.set(position.x, position.y, position.z);
        group.castShadow = true;
        
        return group;
    }
    
    function createPipeShoe(position, diameter) {
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        
        const baseMat = createSteelMaterial(0x555555, 0.5, 0.7);
        const clampMat = createSteelMaterial(0x666666, 0.4, 0.75);
        const boltMat = createSteelMaterial(0x404040, 0.2, 0.9);
        
        // Base
        const baseGeom = new THREE.BoxGeometry(radius * 2.2, 15, radius * 1.8);
        const baseMesh = new THREE.Mesh(baseGeom, baseMat);
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        group.add(baseMesh);
        
        // Abrazadera superior
        const clampGeom = new THREE.TorusGeometry(radius + 5, 8, 8, _config.pipeSegments, Math.PI);
        const clampMesh = new THREE.Mesh(clampGeom, clampMat);
        clampMesh.position.y = radius + 15;
        group.add(clampMesh);
        
        // Refuerzo
        for (let x = -1; x <= 1; x += 2) {
            const ribGeom = new THREE.BoxGeometry(10, radius + 10, radius * 1.5);
            const rib = new THREE.Mesh(ribGeom, baseMat);
            rib.position.set(x * radius * 0.7, radius/2 + 7, 0);
            group.add(rib);
        }
        
        // Pernos de anclaje con tuercas
        for (let x = -1; x <= 1; x += 2) {
            const boltGeom = new THREE.CylinderGeometry(4, 4, radius * 2 + 30, 8);
            const boltMesh = new THREE.Mesh(boltGeom, boltMat);
            boltMesh.position.set(x * radius * 0.6, radius/2 + 7, 0);
            group.add(boltMesh);
            
            const nutGeom = new THREE.CylinderGeometry(7, 7, 6, 6);
            const nutTop = new THREE.Mesh(nutGeom, boltMat);
            nutTop.position.set(x * radius * 0.6, radius + 22, 0);
            group.add(nutTop);
            
            const nutBottom = new THREE.Mesh(nutGeom.clone(), boltMat);
            nutBottom.position.set(x * radius * 0.6, -8, 0);
            group.add(nutBottom);
        }
        
        group.position.set(position.x, position.y - radius - 7, position.z);
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    
    function createPlatformMesh(eq) {
        const group = new THREE.Group();
        const largo = eq.largo || 6000;
        const ancho = eq.ancho || 3000;
        const alturaTotal = eq.altura || 400;
        const alturaColumnas = eq.altura_columnas || 3000;
        const tieneBaranda = eq.baranda !== undefined ? eq.baranda : true;
        const tieneEscalera = eq.escalera !== undefined ? eq.escalera : true;
        
        const aceroEstructural = createSteelMaterial(0x556677, 0.5, 0.65);
        const aceroGalvanizado = createSteelMaterial(0x889999, 0.4, 0.75);
        const rejillaColor = createSteelMaterial(0x445566, 0.6, 0.5);
        const barandaColor = createSteelMaterial(0xffcc00, 0.45, 0.7);
        const anclajeColor = createSteelMaterial(0x505050, 0.3, 0.9);
        
        // Plancha / rejilla
        const plateGeom = new THREE.BoxGeometry(largo, 18, ancho);
        const plateMesh = new THREE.Mesh(plateGeom, rejillaColor);
        plateMesh.position.y = 0;
        plateMesh.castShadow = true;
        plateMesh.receiveShadow = true;
        group.add(plateMesh);
        
        // Líneas de rejilla
        for (let i = -largo/2 + 200; i < largo/2; i += 400) {
            const lineGeom = new THREE.BoxGeometry(3, 2, ancho - 100);
            const line = new THREE.Mesh(lineGeom, aceroGalvanizado);
            line.position.set(i, 10, 0);
            group.add(line);
        }
        for (let j = -ancho/2 + 200; j < ancho/2; j += 400) {
            const lineGeom = new THREE.BoxGeometry(largo - 100, 2, 3);
            const line = new THREE.Mesh(lineGeom, aceroGalvanizado);
            line.position.set(0, 10, j);
            group.add(line);
        }
        
        // Vigas longitudinales
        for (let z = -1; z <= 1; z += 2) {
            const beamGeom = new THREE.BoxGeometry(largo, alturaTotal, 80);
            const beam = new THREE.Mesh(beamGeom, aceroEstructural);
            beam.position.set(0, -alturaTotal/2 - 9, z * (ancho/2 - 100));
            beam.castShadow = true;
            group.add(beam);
        }
        
        // Vigas transversales
        const numCrossBeams = Math.floor(largo / 1500);
        for (let i = 0; i <= numCrossBeams; i++) {
            const x = -largo/2 + i * (largo / numCrossBeams);
            const crossGeom = new THREE.BoxGeometry(60, alturaTotal * 0.7, ancho - 200);
            const cross = new THREE.Mesh(crossGeom, aceroEstructural);
            cross.position.set(x, -alturaTotal * 0.35 - 9, 0);
            cross.castShadow = true;
            group.add(cross);
        }
        
        // Columnas con placas de anclaje
        const columnasPos = [
            { x: -largo/2 + 200, z: -ancho/2 + 200 },
            { x: largo/2 - 200, z: -ancho/2 + 200 },
            { x: -largo/2 + 200, z: ancho/2 - 200 },
            { x: largo/2 - 200, z: ancho/2 - 200 }
        ];
        
        columnasPos.forEach(function(pos) {
            const colGeom = new THREE.BoxGeometry(120, alturaColumnas, 120);
            const col = new THREE.Mesh(colGeom, aceroEstructural);
            col.position.set(pos.x, -alturaColumnas/2 - alturaTotal/2, pos.z);
            col.castShadow = true;
            group.add(col);
            
            const basePlateGeom = new THREE.BoxGeometry(250, 20, 250);
            const basePlate = new THREE.Mesh(basePlateGeom, anclajeColor);
            basePlate.position.set(pos.x, -alturaColumnas - alturaTotal/2 - 10, pos.z);
            group.add(basePlate);
            
            for (let bx = -1; bx <= 1; bx += 2) {
                for (let bz = -1; bz <= 1; bz += 2) {
                    const boltGeom = new THREE.CylinderGeometry(8, 8, 30, 8);
                    const bolt = new THREE.Mesh(boltGeom, anclajeColor);
                    bolt.position.set(pos.x + bx * 80, -alturaColumnas - alturaTotal/2 - 25, pos.z + bz * 80);
                    group.add(bolt);
                }
            }
        });
        
        // Barandas
        if (tieneBaranda) {
            const barandaAltura = 1100;
            const halfL = largo/2 - 50;
            const halfA = ancho/2 - 50;
            const postSpacing = 1200;
            
            for (let x = -halfL; x <= halfL; x += postSpacing) {
                for (let zSide = -1; zSide <= 1; zSide += 2) {
                    const z = zSide * halfA;
                    const postGeom = new THREE.CylinderGeometry(15, 18, barandaAltura, 8);
                    const post = new THREE.Mesh(postGeom, barandaColor);
                    post.position.set(x, barandaAltura/2, z);
                    post.castShadow = true;
                    group.add(post);
                }
            }
            
            // Pasamanos
            const lados = [
                { x1: -halfL, x2: halfL, z1: -halfA, z2: -halfA },
                { x1: -halfL, x2: halfL, z1: halfA, z2: halfA },
                { x1: -halfL, x2: -halfL, z1: -halfA, z2: halfA },
                { x1: halfL, x2: halfL, z1: -halfA, z2: halfA }
            ];
            
            lados.forEach(function(lado) {
                const dx = lado.x2 - lado.x1;
                const dz = lado.z2 - lado.z1;
                const len = Math.sqrt(dx*dx + dz*dz);
                if (len < 10) return;
                
                const railGeom = new THREE.CylinderGeometry(20, 20, len, 8);
                const rail = new THREE.Mesh(railGeom, barandaColor);
                rail.position.set((lado.x1 + lado.x2) / 2, barandaAltura, (lado.z1 + lado.z2) / 2);
                rail.rotation.x = Math.PI / 2;
                rail.rotation.y = Math.atan2(dz, dx);
                rail.castShadow = true;
                group.add(rail);
            });
        }
        
        // Escalera
        if (tieneEscalera) {
            const escAncho = 800;
            const escLargo = alturaColumnas * 1.2;
            const numEscalones = Math.floor(alturaColumnas / 200);
            const escGroup = new THREE.Group();
            escGroup.position.set(largo/2 + 600, -alturaColumnas/2 - alturaTotal/2, 0);
            escGroup.rotation.z = Math.atan2(alturaColumnas, escLargo);
            
            for (let s = -1; s <= 1; s += 2) {
                const largueroGeom = new THREE.BoxGeometry(escLargo, 50, 20);
                const larguero = new THREE.Mesh(largueroGeom, aceroEstructural);
                larguero.position.set(escLargo/2, alturaColumnas/2, s * escAncho/2);
                larguero.castShadow = true;
                escGroup.add(larguero);
            }
            
            const escalonProfundidad = escLargo / numEscalones;
            for (let i = 0; i < numEscalones; i++) {
                const escalonGeom = new THREE.BoxGeometry(escalonProfundidad * 0.85, 6, escAncho - 50);
                const escalon = new THREE.Mesh(escalonGeom, rejillaColor);
                escalon.position.set(i * escalonProfundidad + escalonProfundidad/2, i * (alturaColumnas / numEscalones) + 25, 0);
                escalon.castShadow = true;
                escGroup.add(escalon);
            }
            
            group.add(escGroup);
        }
        
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    
    function createFlareMesh(eq) {
        const group = new THREE.Group();
        const altura = eq.altura || 15000;
        
        const towerMat = createSteelMaterial(0x666666, 0.4, 0.8, 'brushed');
        const tipMat = createSteelMaterial(0x884400, 0.3, 0.9);
        
        // Torre principal
        const towerGeom = new THREE.CylinderGeometry(200, 400, altura, _config.pipeSegments);
        const towerMesh = new THREE.Mesh(towerGeom, towerMat);
        towerMesh.castShadow = true;
        group.add(towerMesh);
        
        // Anillos de refuerzo
        for (let i = 0; i < 5; i++) {
            const ringGeom = new THREE.TorusGeometry(220 + i * 30, 8, 8, _config.pipeSegments);
            const ring = new THREE.Mesh(ringGeom, towerMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = -altura/2 + 1000 + i * 3000;
            group.add(ring);
        }
        
        // Punta
        const tipGeom = new THREE.CylinderGeometry(100, 200, 2000, _config.pipeSegments);
        const tipMesh = new THREE.Mesh(tipGeom, tipMat);
        tipMesh.position.y = altura/2 + 1000;
        tipMesh.castShadow = true;
        group.add(tipMesh);
        
        // Pilotos de ignición
        for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2;
            const pilotGeom = new THREE.CylinderGeometry(8, 8, 300, 8);
            const pilot = new THREE.Mesh(pilotGeom, createSteelMaterial(0xff8800, 0.3, 0.5));
            pilot.position.set(Math.cos(angle) * 160, altura/2 + 2000, Math.sin(angle) * 160);
            group.add(pilot);
        }
        
        // Llama (semi-transparente)
        const flameGeom = new THREE.ConeGeometry(150, 3500, _config.pipeSegments);
        const flameMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.6 });
        const flameMesh = new THREE.Mesh(flameGeom, flameMat);
        flameMesh.position.y = altura/2 + 3500;
        group.add(flameMesh);
        
        // Llama interna (más brillante)
        const innerFlameGeom = new THREE.ConeGeometry(80, 2500, _config.pipeSegments);
        const innerFlameMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.7 });
        const innerFlame = new THREE.Mesh(innerFlameGeom, innerFlameMat);
        innerFlame.position.y = altura/2 + 3000;
        group.add(innerFlame);
        
        return group;
    }
    
    function createGenericEquipmentMesh(eq) {
        const group = new THREE.Group();
        const spec = _catalog.getSpec(eq.spec);
        const color = spec ? spec.color : 0x888888;
        
        const w = eq.largo || 1000;
        const h = eq.altura || 1000;
        const d = eq.ancho || 1000;
        
        const geom = new THREE.BoxGeometry(w, h, d);
        const mat = createSteelMaterial(color, 0.4, 0.7, 'brushed');
        const mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        
        return group;
    }
    
    // ================================================================
    // 4. CONSTRUCCIÓN DE ESCENA COMPLETA
    // ================================================================
    
    function buildScene() {
        if (!_core || !_catalog || !_scene) return;
        
        clearAllMeshes();
        
        const db = _core.getDb();
        const equipos = db.equipos || [];
        const lines = db.lines || [];
        
        equipos.forEach(function(eq) {
            try { buildEquipment(eq); } catch (e) { console.warn('Error equipo ' + (eq.tag || '?') + ':', e.message); }
        });
        
        lines.forEach(function(line) {
            try { buildLine(line); } catch (e) { console.warn('Error línea ' + (line.tag || '?') + ':', e.message); }
        });
        
        updateAllConnections();
        _needsBuild = false;
    }
    
    function buildEquipment(eq) {
        let mesh;
        const tipo = eq.tipo || '';
        
        if (tipo === 'bomba' || tipo === 'bomba_centrifuga') {
            mesh = createPumpMesh(eq);
        } else if (tipo === 'bomba_dosificacion') {
            mesh = createPumpMesh(eq);
            if (mesh) mesh.scale.set(0.6, 0.6, 0.6);
        } else if (tipo === 'tanque_v' || tipo === 'torre' || tipo === 'reactor' || tipo === 'desgasificador' || 
                   tipo === 'desmineralizador' || tipo === 'suavizador' || tipo === 'filtro_carbon' || 
                   tipo === 'filtro_arena' || tipo === 'clarificador' || tipo === 'columna_fraccionadora' || 
                   tipo === 'evaporador' || tipo === 'cristalizador' || tipo === 'absorbedor' || 
                   tipo === 'stripper' || tipo === 'reactor_encamisado' || tipo === 'autoclave' || 
                   tipo === 'agitador' || tipo === 'tanque_aseptico') {
            mesh = createVerticalTank(eq);
        } else if (tipo === 'intercambiador' || tipo === 'condensador') {
            mesh = createHeatExchanger(eq);
        } else if (tipo === 'tanque_h' || tipo === 'separador' || tipo === 'separador_trifasico' || 
                   tipo === 'slug_catcher' || tipo === 'calentador_fuego_directo' || tipo === 'secador_rotativo') {
            mesh = createHeatExchanger(eq);
            if (mesh) mesh.rotation.z = Math.PI / 2;
        } else if (tipo === 'compresor') {
            mesh = createPumpMesh(eq);
            if (mesh) mesh.scale.set(1.5, 1.2, 1.2);
        } else if (tipo === 'caldera') {
            mesh = createHeatExchanger(eq);
            if (mesh) mesh.scale.set(2, 1.5, 1.5);
        } else if (tipo === 'centrifuga' || tipo === 'centrifuga_discos') {
            mesh = createPumpMesh(eq);
            if (mesh) mesh.scale.set(1.3, 0.8, 1.3);
        } else if (tipo === 'plataforma') {
            mesh = createPlatformMesh(eq);
        } else if (tipo === 'antorcha') {
            mesh = createFlareMesh(eq);
        } else if (tipo === 'espesador') {
            mesh = createVerticalTank(eq);
            if (mesh) mesh.scale.set(2, 0.8, 2);
        } else if (tipo === 'filtro_prensa') {
            mesh = createGenericEquipmentMesh(eq);
        } else {
            mesh = createGenericEquipmentMesh(eq);
        }
        
        if (mesh) {
            mesh.position.set(eq.posX || 0, eq.posY || 0, eq.posZ || 0);
            mesh.userData = { tag: eq.tag, type: 'equipment', data: eq };
            mesh.traverse(function(child) {
                if (child.isMesh) child.userData = { tag: eq.tag, type: 'equipment' };
            });
            _scene.add(mesh);
            _equipmentMeshes.set(eq.tag, mesh);
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
        const materialType = line.material || 'CS';
        
        for (let i = 0; i < pts.length - 1; i++) {
            const pipeMesh = createPipeGeometry(pts[i], pts[i+1], diameter, color, materialType);
            pipeMesh.userData = { tag: line.tag, type: 'pipe', segmentIndex: i };
            group.add(pipeMesh);
            
            if (i < pts.length - 2) {
                const d1 = { dx: pts[i+1].x - pts[i].x, dy: pts[i+1].y - pts[i].y, dz: pts[i+1].z - pts[i].z };
                const d2 = { dx: pts[i+2].x - pts[i+1].x, dy: pts[i+2].y - pts[i+1].y, dz: pts[i+2].z - pts[i+1].z };
                const len1 = Math.sqrt(d1.dx*d1.dx + d1.dy*d1.dy + d1.dz*d1.dz) || 1;
                const len2 = Math.sqrt(d2.dx*d2.dx + d2.dy*d2.dy + d2.dz*d2.dz) || 1;
                const dot = (d1.dx*d2.dx + d1.dy*d2.dy + d1.dz*d2.dz) / (len1 * len2);
                const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
                
                if (angle > 5) {
                    const elbow = createElbow90(pts[i+1], 
                        { dx: d1.dx/len1, dy: d1.dy/len1, dz: d1.dz/len1 },
                        { dx: d2.dx/len2, dy: d2.dy/len2, dz: d2.dz/len2 },
                        diameter, color, materialType);
                    elbow.userData = { tag: line.tag, type: 'elbow', segmentIndex: i };
                    group.add(elbow);
                }
            }
        }
        
        if (line.origin && line.origin.objTag && pts.length >= 2) {
            const originObj = _core.findObjectByTag(line.origin.objTag);
            if (originObj && originObj.posX !== undefined) {
                const flange = createFlangeGeometry(pts[0],
                    { dx: pts[1].x - pts[0].x, dy: pts[1].y - pts[0].y, dz: pts[1].z - pts[0].z },
                    diameter, color, 'WN', materialType);
                flange.userData = { tag: line.tag, type: 'flange', position: 'origin' };
                group.add(flange);
            }
        }
        if (line.destination && line.destination.objTag && pts.length >= 2) {
            const destObj = _core.findObjectByTag(line.destination.objTag);
            if (destObj && destObj.posX !== undefined) {
                const n = pts.length;
                const flange = createFlangeGeometry(pts[n-1],
                    { dx: pts[n-1].x - pts[n-2].x, dy: pts[n-1].y - pts[n-2].y, dz: pts[n-1].z - pts[n-2].z },
                    diameter, color, 'WN', materialType);
                flange.userData = { tag: line.tag, type: 'flange', position: 'destination' };
                group.add(flange);
            }
        }
        
        if (line.components) {
            line.components.forEach(function(comp, idx) {
                const compMesh = buildComponentOnLine(comp, line, pts, diameter, color, materialType);
                if (compMesh) {
                    compMesh.userData = { tag: comp.tag || 'COMP-' + idx, type: 'component', data: comp };
                    group.add(compMesh);
                }
            });
        }
        
        _scene.add(group);
        _lineMeshes.set(line.tag, group);
    }
    
    function buildComponentOnLine(comp, line, pts, diameter, color, materialType) {
        if (!comp.param && comp.param !== 0) return null;
        
        const point = _core.calcularPuntoParametrico ? _core.calcularPuntoParametrico(line.tag, comp.param) : null;
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
                const len = Math.sqrt(direction.dx*direction.dx + direction.dy*direction.dy + direction.dz*direction.dz) || 1;
                direction.dx /= len; direction.dy /= len; direction.dz /= len;
            }
        }
        
        const compType = (comp.type || '').toUpperCase();
        
        if (compType.includes('GATE_VALVE') || compType.includes('COMPUERTA')) {
            return createGateValve(point, direction, diameter, color, 0xff4444, materialType);
        } else if (compType.includes('GLOBE_VALVE') || compType.includes('GLOBO')) {
            return createGateValve(point, direction, diameter, color, 0x4488ff, materialType);
        } else if (compType.includes('BALL_VALVE') || compType.includes('BOLA')) {
            return createBallValve(point, direction, diameter, color, materialType);
        } else if (compType.includes('BUTTERFLY_VALVE') || compType.includes('MARIPOSA')) {
            return createButterflyValve(point, direction, diameter, color, materialType);
        } else if (compType.includes('CHECK_VALVE') || compType.includes('CHECK')) {
            const valve = createGateValve(point, direction, diameter, color, 0xff8800, materialType);
            valve.scale.set(0.8, 0.8, 0.8);
            return valve;
        } else if (compType.includes('STRAINER') || compType.includes('FILTRO')) {
            const strainer = createGateValve(point, direction, diameter, color, 0xffff00, materialType);
            strainer.scale.set(1.2, 1.2, 1.2);
            return strainer;
        } else if (compType.includes('PRESSURE_GAUGE') || compType.includes('MANOMETRO') || compType.includes('MANÓMETRO')) {
            return createPressureGauge(point, direction);
        } else if (compType.includes('TEMPERATURE_GAUGE') || compType.includes('TERMOMETRO') || compType.includes('TERMÓMETRO')) {
            return createTemperatureGauge(point);
        } else if (compType.includes('FLOW_METER') || compType.includes('CAUDALIMETRO')) {
            return createFlowMeter(point, direction);
        }
        
        return null;
    }
    
    // ================================================================
    // 5. CONEXIONES, SELECCIÓN, CÁMARA, RENDER LOOP, INIT, API
    // ================================================================
    
    function updateAllConnections() {
        if (!_core) return;
        const db = _core.getDb();
        (db.lines || []).forEach(function(line) { updateLineConnection(line); });
    }
    
    function updateLineConnection(line) {
        const lineGroup = _lineMeshes.get(line.tag);
        if (!lineGroup) return;
        const pts = _core.getLinePoints(line) || line._cachedPoints || [];
        if (pts.length < 2) return;
        lineGroup.children.forEach(function(child) {
            if (child.userData && child.userData.type === 'flange') {
                if (child.userData.position === 'origin') {
                    child.position.copy(new THREE.Vector3(pts[0].x, pts[0].y, pts[0].z));
                } else if (child.userData.position === 'destination') {
                    child.position.copy(new THREE.Vector3(pts[pts.length-1].x, pts[pts.length-1].y, pts[pts.length-1].z));
                }
            }
        });
    }
    
    const _raycaster = new THREE.Raycaster();
    const _mouse = new THREE.Vector2();
    let _selectedObject = null;
    let _highlightedMeshes = [];
    
    function onMouseClick(event) {
        if (!_container || !_camera || !_scene) return;
        const rect = _container.getBoundingClientRect();
        _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        _raycaster.setFromCamera(_mouse, _camera);
        
        const allMeshes = [];
        _scene.traverse(function(child) {
            if (child.isMesh && child.userData && child.userData.tag) allMeshes.push(child);
        });
        
        const intersects = _raycaster.intersectObjects(allMeshes, false);
        if (intersects.length > 0) {
            const obj = intersects[0].object;
            const tag = obj.userData.tag;
            const type = obj.userData.type || 'equipment';
            const coreObj = _core.findObjectByTag(tag);
            if (coreObj) selectObject({ obj: coreObj, type: type, mesh: obj });
        } else {
            deselectObject();
        }
    }
    
    function selectObject(selectionData) {
        deselectObject();
        _selectedObject = selectionData;
        if (selectionData.mesh) highlightMeshAndParents(selectionData.mesh);
        if (_onSelectionCallback) _onSelectionCallback(selectionData);
        if (_core && _core.setSelected) _core.setSelected({ obj: selectionData.obj, type: selectionData.type });
    }
    
    function highlightMeshAndParents(mesh) {
        if (!mesh) return;
        let current = mesh;
        while (current && current !== _scene) {
            if (current.isMesh && current.material) {
                const clonedMat = current.material.clone();
                clonedMat.emissive = new THREE.Color(_config.selectionColor);
                clonedMat.emissiveIntensity = 0.3;
                current.material = clonedMat;
                _highlightedMeshes.push(current);
            }
            current = current.parent;
        }
    }
    
    function deselectObject() {
        _highlightedMeshes.forEach(function(m) {
            if (m && m.material && m.material.emissive) {
                m.material.emissive = new THREE.Color(0x000000);
                m.material.emissiveIntensity = 0;
            }
        });
        _highlightedMeshes = [];
        _selectedObject = null;
        if (_onSelectionCallback) _onSelectionCallback(null);
        if (_core && _core.setSelected) _core.setSelected(null);
    }
    
    function setIsoView() {
        if (!_camera) return;
        const angle = _config.isoAngle * Math.PI / 180;
        const dist = _config.cameraDistance;
        _camera.position.set(dist * Math.cos(angle), dist * Math.sin(angle), dist * Math.cos(angle));
        _camera.lookAt(0, 0, 0);
        if (_controls) { _controls.target.set(0, 0, 0); _controls.update(); }
    }
    
    function setView(viewName) {
        if (!_camera) return;
        const dist = _config.cameraDistance;
        switch(viewName) {
            case 'top': _camera.position.set(0, dist, 10); break;
            case 'front': _camera.position.set(0, 0, dist); break;
            case 'right': _camera.position.set(dist, 0, 0); break;
            default: setIsoView(); return;
        }
        _camera.lookAt(0, 0, 0);
        if (_controls) { _controls.target.set(0, 0, 0); _controls.update(); }
    }
    
    function focusOn(position) {
        if (_controls) { _controls.target.set(position.x, position.y, position.z); _controls.update(); }
    }
    
    function zoomToFit() {
        if (!_scene || !_camera) return;
        const box = new THREE.Box3();
        let hasContent = false;
        _scene.traverse(function(child) { if (child.isMesh) { box.expandByObject(child); hasContent = true; } });
        if (!hasContent) { setIsoView(); return; }
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        const dist = Math.max(Math.max(size.x, size.y, size.z) * 1.5, 5000);
        _camera.position.set(center.x + dist * 0.6, center.y + dist * 0.6, center.z + dist * 0.6);
        _camera.lookAt(center);
        if (_controls) { _controls.target.copy(center); _controls.update(); }
    }
    
    function startRenderLoop() {
        if (_isRendering) return;
        _isRendering = true;
        function render() {
            if (!_isRendering) return;
            _renderLoopId = requestAnimationFrame(render);
            if (_needsBuild && _core && _catalog && _scene) buildScene();
            if (_controls) _controls.update();
            if (_renderer && _scene && _camera) _renderer.render(_scene, _camera);
            if (_onRenderCallback) _onRenderCallback();
        }
        render();
    }
    
    function stopRenderLoop() {
        _isRendering = false;
        if (_renderLoopId) { cancelAnimationFrame(_renderLoopId); _renderLoopId = null; }
    }
    
    function onResize() {
        if (!_container || !_camera || !_renderer) return;
        const w = _container.clientWidth;
        const h = _container.clientHeight;
        if (w > 0 && h > 0) { _camera.aspect = w / h; _camera.updateProjectionMatrix(); _renderer.setSize(w, h); }
    }
    
    function init(container, coreInstance, catalogInstance, config) {
        if (!container || !coreInstance || !catalogInstance) { console.error('❌ Renderer3D.init: parámetros inválidos'); return false; }
        
        _container = container;
        _core = coreInstance;
        _catalog = catalogInstance;
        if (config && typeof config === 'object') {
            for (var key in config) { if (config.hasOwnProperty(key) && _config.hasOwnProperty(key)) _config[key] = config[key]; }
        }
        
        while (container.firstChild) container.removeChild(container.firstChild);
        
        try {
            _scene = new THREE.Scene();
            _scene.background = new THREE.Color(_config.backgroundColor);
            
            _camera = new THREE.PerspectiveCamera(45, container.clientWidth / (container.clientHeight || 1), 100, 100000);
            
            _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
            _renderer.setSize(container.clientWidth, container.clientHeight);
            _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            _renderer.shadowMap.enabled = _config.enableShadows;
            _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            container.appendChild(_renderer.domElement);
            
            _controls = new THREE.OrbitControls(_camera, _renderer.domElement);
            _controls.enableDamping = true;
            _controls.dampingFactor = 0.08;
            _controls.minDistance = 500;
            _controls.maxDistance = 50000;
            _controls.maxPolarAngle = Math.PI * 0.48;
            _controls.target.set(0, 0, 0);
            _controls.update();
            
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
            
            _gridHelper = new THREE.GridHelper(_config.gridSize, _config.gridDivisions, 0x334455, 0x1a1a2e);
            _scene.add(_gridHelper);
            _groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(50000, 50000), new THREE.ShadowMaterial({ opacity: 0.3 }));
            _groundPlane.rotation.x = -Math.PI / 2;
            _groundPlane.position.y = -100;
            _groundPlane.receiveShadow = true;
            _scene.add(_groundPlane);
            
            _renderer.domElement.addEventListener('click', onMouseClick);
            window.addEventListener('resize', onResize);
            
            setIsoView();
            _needsBuild = true;
            buildScene();
            startRenderLoop();
            
            _initComplete = true;
            console.log('✅ SmartFlowRenderer3D v4.0 inicializado');
            return true;
        } catch (e) {
            console.error('❌ Error fatal:', e.message);
            return false;
        }
    }
    
    function clearAllMeshes() {
        [_equipmentMeshes, _lineMeshes, _componentMeshes, _instrumentMeshes, _supportMeshes].forEach(function(map) {
            map.forEach(function(group) { _scene.remove(group); disposeGroup(group); });
            map.clear();
        });
    }
    
    function disposeGroup(group) {
        group.traverse(function(child) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) { child.material.forEach(function(m) { m.dispose(); }); }
                else { child.material.dispose(); }
            }
        });
    }
    
    function rebuildScene() { _needsBuild = true; buildScene(); }
    
    function updateAll() { clearAllMeshes(); buildScene(); }
    
    function dispose() {
        stopRenderLoop();
        clearAllMeshes();
        if (_renderer) { _renderer.dispose(); if (_renderer.domElement && _renderer.domElement.parentNode) _renderer.domElement.parentNode.removeChild(_renderer.domElement); }
        _scene = null; _camera = null; _renderer = null; _controls = null; _initComplete = false;
    }
    
    // ================================================================
    // API PÚBLICA
    // ================================================================
    return {
        init: init,
        rebuildScene: rebuildScene,
        updateAll: updateAll,
        updateEquipmentMesh: function(tag) {
            const old = _equipmentMeshes.get(tag);
            if (old) { _scene.remove(old); disposeGroup(old); _equipmentMeshes.delete(tag); }
            const eq = _core.findObjectByTag(tag);
            if (eq) buildEquipment(eq);
        },
        updateLineMesh: function(tag) {
            const old = _lineMeshes.get(tag);
            if (old) { _scene.remove(old); disposeGroup(old); _lineMeshes.delete(tag); }
            const line = _core.findObjectByTag(tag);
            if (line) buildLine(line);
        },
        dispose: dispose,
        setView: setView,
        setIsoView: setIsoView,
        focusOn: focusOn,
        zoomToFit: zoomToFit,
        selectObject: selectObject,
        deselectObject: deselectObject,
        getSelected: function() { return _selectedObject; },
        onSelection: function(callback) { _onSelectionCallback = callback; },
        setConfig: function(key, value) { if (_config.hasOwnProperty(key)) _config[key] = value; },
        getConfig: function() { return _config; },
        getScene: function() { return _scene; },
        getCamera: function() { return _camera; },
        getRenderer: function() { return _renderer; },
        getControls: function() { return _controls; },
        onRender: function(callback) { _onRenderCallback = callback; },
        setNotify: function(fn) { _notifyUI = fn; },
        isReady: function() { return _initComplete; },
        createPipeGeometry: createPipeGeometry,
        createFlangeGeometry: createFlangeGeometry,
        createElbow90: createElbow90,
        createGateValve: createGateValve,
        createBallValve: createBallValve,
        createButterflyValve: createButterflyValve,
        createPressureGauge: createPressureGauge,
        createTemperatureGauge: createTemperatureGauge,
        createFlowMeter: createFlowMeter,
        createPipeShoe: createPipeShoe,
        createPlatformMesh: createPlatformMesh,
        createFlareMesh: createFlareMesh
    };
})();
Ñc
