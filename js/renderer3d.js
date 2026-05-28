
// ============================================================
// SMARTFLOW RENDER ENGINE v5.0 - NIVEL 2 (Industrial Realism)
// Archivo: js/renderer3d.js
// Compatible: Three.js r160+
// Características Nivel 2: Texturas PBR avanzadas, HDRI, Desgaste, Detalles
// ============================================================

const SmartFlowRenderer3D = (function() {
    
    // ================================================================
    // 0. VERIFICACIÓN CRÍTICA DE THREE.js
    // ================================================================
    if (typeof THREE === 'undefined') {
        console.error('❌ SmartFlowRenderer3D: THREE.js no está cargado.');
        return { init: function() { return false; }, isReady: function() { return false; } };
    }
    
    // ================================================================
    // 1. CATÁLOGO DE MATERIALES INDUSTRIALES NIVEL 2
    // ================================================================
    const IndustrialMaterials = {
        // Aceros industriales
        'CS': {  // Carbon Steel (con óxido sutil)
            name: 'Carbon Steel',
            color: 0x8a9aaa,
            roughness: 0.55,
            metalness: 0.85,
            pattern: 'brushed',
            envMapIntensity: 0.8,
            rust: true,
            weldMarks: true,
            clearcoat: 0.1,
            clearcoatRoughness: 0.3
        },
        'CS_PAINTED': {  // Carbon Steel pintado (verde industrial)
            name: 'Painted Carbon Steel',
            color: 0x5c8a6a,
            roughness: 0.65,
            metalness: 0.12,
            pattern: 'none',
            envMapIntensity: 0.4,
            rust: false,
            weldMarks: false,
            clearcoat: 0.25
        },
        'SS304': {  // Stainless Steel 304
            name: 'Stainless Steel 304',
            color: 0xc8d0d8,
            roughness: 0.32,
            metalness: 0.92,
            pattern: 'brushed',
            envMapIntensity: 1.2,
            rust: false,
            weldMarks: true,
            clearcoat: 0.4,
            clearcoatRoughness: 0.2
        },
        'SS316': {  // Stainless Steel 316 (más brillante)
            name: 'Stainless Steel 316',
            color: 0xd8e0e8,
            roughness: 0.25,
            metalness: 0.95,
            pattern: 'brushed',
            envMapIntensity: 1.4,
            rust: false,
            weldMarks: false,
            clearcoat: 0.5
        },
        'CS_GALVANIZED': {  // Galvanizado
            name: 'Galvanized Steel',
            color: 0x9aaaba,
            roughness: 0.48,
            metalness: 0.88,
            pattern: 'spangled',
            envMapIntensity: 0.9,
            rust: false,
            weldMarks: true
        },
        
        // Plásticos industriales
        'PPR': {  // Polipropileno (morado industrial)
            name: 'PPR (Polypropylene)',
            color: 0x8b5cf6,
            roughness: 0.55,
            metalness: 0.05,
            pattern: 'plastic',
            envMapIntensity: 0.25,
            plasticGloss: 0.4,
            clearcoat: 0.15
        },
        'PVC': {  // PVC (amarillo/crema)
            name: 'PVC',
            color: 0xeab308,
            roughness: 0.6,
            metalness: 0.03,
            pattern: 'plastic',
            envMapIntensity: 0.2,
            plasticGloss: 0.35
        },
        'CPVC': {  // CPVC (gris claro)
            name: 'CPVC',
            color: 0xcbd5e1,
            roughness: 0.58,
            metalness: 0.04,
            pattern: 'plastic',
            envMapIntensity: 0.25
        },
        'HDPE': {  // Polietileno de alta densidad
            name: 'HDPE',
            color: 0x3b82f6,
            roughness: 0.58,
            metalness: 0.02,
            pattern: 'plastic',
            envMapIntensity: 0.25
        },
        'FRP': {  // Fibra de vidrio
            name: 'FRP (Fiberglass)',
            color: 0x8b5cf6,
            roughness: 0.52,
            metalness: 0.08,
            pattern: 'woven',
            envMapIntensity: 0.35
        },
        
        // Materiales especiales
        'BRASS': {  // Latón
            name: 'Brass',
            color: 0xd4a574,
            roughness: 0.32,
            metalness: 0.88,
            pattern: 'brushed',
            envMapIntensity: 1.0
        },
        'BRONZE': {  // Bronce
            name: 'Bronze',
            color: 0xcd7f32,
            roughness: 0.38,
            metalness: 0.85,
            pattern: 'brushed',
            envMapIntensity: 0.9
        },
        'RUBBER': {  // Caucho/Neopreno
            name: 'Rubber',
            color: 0x333333,
            roughness: 0.85,
            metalness: 0.02,
            pattern: 'matte',
            envMapIntensity: 0.15
        },
        'GLASS': {  // Vidrio
            name: 'Glass',
            color: 0xaaddff,
            roughness: 0.08,
            metalness: 0.05,
            transparent: true,
            opacity: 0.65,
            envMapIntensity: 1.5
        },
        'CERAMIC': {  // Cerámica
            name: 'Ceramic',
            color: 0xf0f0f0,
            roughness: 0.15,
            metalness: 0.02,
            pattern: 'glazed',
            envMapIntensity: 0.7
        }
    };
    
    // Mapeo de especificaciones a materiales
    const SpecMaterialMap = {
        'A1A': 'CS',
        'A3B': 'SS304',
        'A5C': 'SS316',
        'ACERO_SCH80': 'CS',
        'PPR_PN12_5': 'PPR',
        'PVC_SCH40': 'PVC',
        'HDPE_PN10': 'HDPE',
        'FRP_PN16': 'FRP'
    };
    
    // ================================================================
    // 2. TEXTURAS PROCEDURALES NIVEL 2
    // ================================================================
    
    function createMetalTexture(baseColor, roughness, metalness, pattern, options = {}) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Convertir color hex a RGB
        const r = ((baseColor >> 16) & 255) / 255;
        const g = ((baseColor >> 8) & 255) / 255;
        const b = (baseColor & 255) / 255;
        
        // Base color con variación sutil
        ctx.fillStyle = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
        ctx.fillRect(0, 0, 1024, 1024);
        
        // === Capa 1: Ruido de grano metálico ===
        for (let i = 0; i < 12000; i++) {
            const x = Math.random() * 1024;
            const y = Math.random() * 1024;
            const intensity = (Math.random() - 0.5) * 0.12;
            const val = Math.max(0, Math.min(255, (r + intensity) * 255));
            ctx.fillStyle = `rgb(${val}, ${val * 0.95}, ${val * 0.9})`;
            ctx.fillRect(x, y, Math.random() * 2 + 1, Math.random() * 2 + 1);
        }
        
        // === Capa 2: Patrón de cepillado (brushed) ===
        if (pattern === 'brushed' || options.brushed) {
            ctx.strokeStyle = `rgba(220,220,240,0.05)`;
            ctx.lineWidth = 1.2;
            for (let y = 0; y < 1024; y += 3) {
                ctx.beginPath();
                const offset = (Math.random() - 0.5) * 2;
                ctx.moveTo(0, y + offset);
                ctx.lineTo(1024, y + offset + (Math.random() - 0.5) * 1.5);
                ctx.stroke();
            }
        }
        
        // === Capa 3: Patrón de laminación (rolled) ===
        if (pattern === 'rolled') {
            ctx.strokeStyle = 'rgba(120,120,140,0.08)';
            ctx.lineWidth = 2.5;
            for (let y = 80; y < 1024; y += 70) {
                ctx.beginPath();
                for (let x = 0; x < 1024; x += 15) {
                    const wave = Math.sin(x * 0.025) * 4 + Math.cos(x * 0.05) * 2;
                    if (x === 0) ctx.moveTo(x, y + wave);
                    else ctx.lineTo(x, y + wave);
                }
                ctx.stroke();
            }
        }
        
        // === Capa 4: Patrón de soldadura ===
        if (pattern === 'welded' || options.weldMarks) {
            ctx.strokeStyle = 'rgba(140,140,160,0.12)';
            ctx.lineWidth = 3;
            for (let x = 0; x < 1024; x += 35) {
                ctx.beginPath();
                let y = 512;
                for (let sx = x; sx < x + 35 && sx < 1024; sx++) {
                    y += (Math.random() - 0.5) * 5;
                    ctx.lineTo(sx, y);
                }
                ctx.stroke();
            }
        }
        
        // === Capa 5: Marcas de desgaste/rayones ===
        if (options.wear) {
            ctx.strokeStyle = 'rgba(80,80,100,0.06)';
            ctx.lineWidth = 0.8;
            for (let i = 0; i < 800; i++) {
                ctx.beginPath();
                const startX = Math.random() * 1024;
                const startY = Math.random() * 1024;
                ctx.moveTo(startX, startY);
                ctx.lineTo(startX + (Math.random() - 0.5) * 15, startY + (Math.random() - 0.5) * 15);
                ctx.stroke();
            }
        }
        
        // === Capa 6: Óxido superficial ===
        if (options.rust) {
            for (let i = 0; i < 400; i++) {
                const x = Math.random() * 1024;
                const y = Math.random() * 1024;
                const radius = Math.random() * 18 + 4;
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                gradient.addColorStop(0, `rgba(180,100,50,${0.2 + Math.random() * 0.15})`);
                gradient.addColorStop(0.6, `rgba(140,70,30,${0.05 + Math.random() * 0.1})`);
                gradient.addColorStop(1, 'rgba(180,100,50,0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // === Capa 7: Patrón de plástico (grano fino) ===
        if (pattern === 'plastic') {
            for (let i = 0; i < 8000; i++) {
                const x = Math.random() * 1024;
                const y = Math.random() * 1024;
                const brightness = 20 + Math.random() * 30;
                ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, 0.04)`;
                ctx.fillRect(x, y, 1, 1);
            }
        }
        
        // === Capa 8: Patrón tejido (FRP) ===
        if (pattern === 'woven') {
            ctx.strokeStyle = 'rgba(100,100,120,0.1)';
            ctx.lineWidth = 1.5;
            const cellSize = 24;
            for (let x = 0; x < 1024; x += cellSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, 1024);
                ctx.stroke();
            }
            for (let y = 0; y < 1024; y += cellSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(1024, y);
                ctx.stroke();
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(options.repeatX || 2, options.repeatY || 2);
        texture.needsUpdate = true;
        
        return texture;
    }
    
    // ================================================================
    // 3. SISTEMA DE MATERIALES PBR AVANZADO
    // ================================================================
    
    const _materialCache = new Map();
    
    function getMaterialBySpec(specCode, componentType = 'body') {
        const materialKey = SpecMaterialMap[specCode] || 'CS';
        const materialDef = IndustrialMaterials[materialKey] || IndustrialMaterials.CS;
        
        // Ajustes por tipo de componente
        let finalDef = { ...materialDef };
        
        switch(componentType) {
            case 'pipe':
                finalDef.roughness = Math.min(finalDef.roughness + 0.12, 0.92);
                break;
            case 'flange':
                finalDef.metalness = Math.min(finalDef.metalness + 0.03, 0.98);
                finalDef.roughness = Math.max(finalDef.roughness - 0.05, 0.2);
                break;
            case 'valve':
                finalDef.clearcoat = 0.35;
                finalDef.roughness = Math.max(finalDef.roughness - 0.05, 0.25);
                break;
            case 'instrument':
                finalDef.roughness = Math.max(finalDef.roughness - 0.12, 0.15);
                finalDef.metalness = Math.min(finalDef.metalness + 0.05, 0.96);
                break;
            case 'tank':
                finalDef.roughness = Math.min(finalDef.roughness + 0.08, 0.85);
                break;
        }
        
        const cacheKey = `${materialKey}_${componentType}_${finalDef.roughness}_${finalDef.metalness}`;
        
        if (_materialCache.has(cacheKey)) {
            return _materialCache.get(cacheKey).clone();
        }
        
        const material = new THREE.MeshStandardMaterial({
            color: finalDef.color,
            roughness: finalDef.roughness,
            metalness: finalDef.metalness,
            envMapIntensity: finalDef.envMapIntensity || 0.8,
            emissive: finalDef.emissive || 0x000000,
            emissiveIntensity: finalDef.emissiveIntensity || 0,
            flatShading: false,
            side: THREE.DoubleSide
        });
        
        // Añadir textura si está definida
        if (finalDef.pattern && finalDef.pattern !== 'none') {
            const textureOptions = {
                brushed: finalDef.pattern === 'brushed',
                rust: finalDef.rust || false,
                weldMarks: finalDef.weldMarks || false,
                wear: finalDef.wear || true,
                repeatX: componentType === 'pipe' ? 4 : 2,
                repeatY: componentType === 'pipe' ? 2 : 2
            };
            
            material.map = createMetalTexture(
                finalDef.color, 
                finalDef.roughness, 
                finalDef.metalness,
                finalDef.pattern,
                textureOptions
            );
        }
        
        // Propiedades de clearcoat (para materiales más realistas)
        if (finalDef.clearcoat !== undefined) {
            material.clearcoat = finalDef.clearcoat;
            material.clearcoatRoughness = finalDef.clearcoatRoughness || 0.25;
        }
        
        // Transparencia para vidrio
        if (finalDef.transparent) {
            material.transparent = true;
            material.opacity = finalDef.opacity || 0.65;
        }
        
        _materialCache.set(cacheKey, material);
        return material.clone();
    }
    
    function createSteelMaterial(color, roughness, metalness, pattern, options = {}) {
        const finalColor = color || 0x64748b;
        const finalRoughness = roughness !== undefined ? roughness : 0.35;
        const finalMetalness = metalness !== undefined ? metalness : 0.85;
        
        const material = new THREE.MeshStandardMaterial({
            color: finalColor,
            roughness: finalRoughness,
            metalness: finalMetalness,
            envMapIntensity: options.envMapIntensity || 0.8,
            clearcoat: options.clearcoat || 0.2,
            clearcoatRoughness: options.clearcoatRoughness || 0.3
        });
        
        if (pattern && pattern !== 'none') {
            material.map = createMetalTexture(finalColor, finalRoughness, finalMetalness, pattern, options);
        }
        
        return material;
    }
    
    function createPlasticMaterial(color, roughness, metalness, gloss = 0.3) {
        return new THREE.MeshStandardMaterial({
            color: color || 0x7c3aed,
            roughness: roughness !== undefined ? roughness : 0.5,
            metalness: metalness !== undefined ? metalness : 0.05,
            clearcoat: gloss,
            clearcoatRoughness: 0.4
        });
    }
    
    function createGlassMaterial(color, opacity = 0.6) {
        return new THREE.MeshPhysicalMaterial({
            color: color || 0x88ccff,
            roughness: 0.05,
            metalness: 0.05,
            transparent: true,
            opacity: opacity,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            reflectivity: 0.5
        });
    }
    
    // ================================================================
    // 4. GENERADORES DE GEOMETRÍA MEJORADOS (NIVEL 2)
    // ================================================================
    
    function createPipeGeometry(start, end, diameter, specCode, materialType) {
        const dir = new THREE.Vector3().subVectors(
            new THREE.Vector3(end.x, end.y, end.z),
            new THREE.Vector3(start.x, start.y, start.z)
        );
        const length = dir.length();
        if (length < 0.1) return new THREE.Group();
        
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        
        // Usar material basado en especificación
        const pipeMaterial = getMaterialBySpec(specCode, 'pipe');
        
        // Tubería principal
        const pipeGeom = new THREE.CylinderGeometry(radius, radius, length, _config.pipeSegments);
        const pipeMesh = new THREE.Mesh(pipeGeom, pipeMaterial);
        pipeMesh.castShadow = true;
        pipeMesh.receiveShadow = true;
        group.add(pipeMesh);
        
        // === NUEVO: Cordón de soldadura cada 6 metros ===
        const weldSpacing = 6000;
        const numWelds = Math.floor(length / weldSpacing);
        const weldMat = getMaterialBySpec(specCode, 'flange');
        
        for (let w = 1; w <= numWelds; w++) {
            const weldGeom = new THREE.TorusGeometry(radius + 1.2, 2.2, 12, _config.pipeSegments);
            const weld = new THREE.Mesh(weldGeom, weldMat);
            weld.rotation.x = Math.PI / 2;
            weld.position.y = -length/2 + w * weldSpacing;
            group.add(weld);
        }
        
        // === NUEVO: Revestimiento para CS (efecto visual) ===
        const materialKey = SpecMaterialMap[specCode] || 'CS';
        if (materialKey === 'CS' && diameter > 8) {
            const coatingMat = new THREE.MeshStandardMaterial({
                color: 0x556677,
                roughness: 0.7,
                metalness: 0.05,
                transparent: true,
                opacity: 0.15
            });
            const coatingGeom = new THREE.CylinderGeometry(radius + 1.5, radius + 1.5, length, _config.pipeSegments);
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
    
    function createFlangeGeometry(position, direction, diameter, specCode, flangeType, materialType) {
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        const flangeRadius = radius * 1.45;
        const flangeThickness = diameter <= 4 ? 14 : diameter <= 8 ? 20 : 26;
        const boltRadius = flangeRadius * 0.82;
        const numBolts = diameter <= 4 ? 8 : diameter <= 8 ? 12 : 16;
        
        const flangeMat = getMaterialBySpec(specCode, 'flange');
        const boltMat = createSteelMaterial(0x505050, 0.25, 0.92, 'brushed');
        const gasketMat = createPlasticMaterial(0x445566, 0.7, 0.02, 0.1);
        
        // Cuerpo de la brida
        const flangeGeom = new THREE.CylinderGeometry(flangeRadius, flangeRadius, flangeThickness, _config.flangeDetail);
        const flangeMesh = new THREE.Mesh(flangeGeom, flangeMat);
        flangeMesh.castShadow = true;
        group.add(flangeMesh);
        
        // Junta (gasket)
        const gasketGeom = new THREE.CylinderGeometry(radius + 2, radius + 2, 1.5, _config.flangeDetail);
        const gasket = new THREE.Mesh(gasketGeom, gasketMat);
        gasket.position.y = flangeThickness/2 + 0.75;
        group.add(gasket);
        
        // Cara de la brida (RF - Raised Face)
        const rfGeom = new THREE.CylinderGeometry(radius + 3, radius + 3, 2.5, _config.flangeDetail);
        const rfMesh = new THREE.Mesh(rfGeom, flangeMat);
        rfMesh.position.y = flangeThickness/2 + 1.5;
        group.add(rfMesh);
        
        // Pernos con tuercas
        const boltGeom = new THREE.CylinderGeometry(1.8, 1.8, flangeThickness + 12, 8);
        
        for (let i = 0; i < numBolts; i++) {
            const angle = (i / numBolts) * Math.PI * 2;
            const boltGroup = new THREE.Group();
            
            const boltMesh = new THREE.Mesh(boltGeom, boltMat);
            boltGroup.add(boltMesh);
            
            const headGeom = new THREE.CylinderGeometry(3.2, 3.2, 4.5, 6);
            const headMesh = new THREE.Mesh(headGeom, boltMat);
            headMesh.position.y = -flangeThickness/2 - 6;
            boltGroup.add(headMesh);
            
            const nutGeom = new THREE.CylinderGeometry(2.8, 2.8, 4, 6);
            const nutTop = new THREE.Mesh(nutGeom, boltMat);
            nutTop.position.y = flangeThickness/2 + 6;
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
    
    function createElbow90(position, directionIn, directionOut, diameter, specCode, materialType) {
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        const bendRadius = radius * 1.6;
        
        const material = getMaterialBySpec(specCode, 'pipe');
        
        // Codo principal (torus)
        const torusGeom = new THREE.TorusGeometry(bendRadius, radius, _config.pipeSegments, _config.pipeSegments, Math.PI / 2);
        const torusMesh = new THREE.Mesh(torusGeom, material);
        torusMesh.castShadow = true;
        group.add(torusMesh);
        
        // Extensión recta
        const straightLength = radius * 0.6;
        const straightGeom = new THREE.CylinderGeometry(radius, radius, straightLength, _config.pipeSegments);
        
        const straight1 = new THREE.Mesh(straightGeom, material);
        straight1.position.set(0, 0, bendRadius + straightLength/2);
        group.add(straight1);
        
        const straight2 = new THREE.Mesh(straightGeom.clone(), material);
        straight2.position.set(bendRadius + straightLength/2, 0, 0);
        straight2.rotation.z = -Math.PI/2;
        group.add(straight2);
        
        // Refuerzo de soldadura en la unión
        const weldMat = getMaterialBySpec(specCode, 'flange');
        const weldGeom = new THREE.TorusGeometry(radius + 1.5, 2, 8, 24);
        const weldRing = new THREE.Mesh(weldGeom, weldMat);
        weldRing.rotation.x = Math.PI / 2;
        weldRing.position.set(0, 0, bendRadius);
        group.add(weldRing);
        
        group.position.set(position.x, position.y, position.z);
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    
    // ================================================================
    // 5. VÁLVULAS MEJORADAS (NIVEL 2)
    // ================================================================
    
    function createGateValve(position, direction, diameter, specCode, handwheelColor, materialType) {
        const group = new THREE.Group();
        const radius = (diameter * 25.4) / 2;
        const bodyLength = diameter * 25.4 * 1.5;
        const bodyWidth = radius * 2.2;
        const bonnetHeight = radius * 2;
        const stemHeight = radius * 3;
        
        const bodyMat = getMaterialBySpec(specCode, 'valve');
        const flangeMat = getMaterialBySpec(specCode, 'flange');
        const handwheelMat = new THREE.MeshStandardMaterial({
            color: handwheelColor || 0xff4444,
            roughness: 0.35,
            metalness: 0.2,
            clearcoat: 0.4
        });
        const stemMat = createSteelMaterial(0x888888, 0.2, 0.95, 'brushed');
        
        // Cuerpo principal con detalles
        const bodyGeom = new THREE.BoxGeometry(bodyLength, bodyWidth, bodyWidth, 2, _config.valveDetail, _config.valveDetail);
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        bodyMesh.castShadow = true;
        group.add(bodyMesh);
        
        // Bridas de conexión
        const flangeThickness = 10;
        const flangeGeom = new THREE.CylinderGeometry(radius * 1.35, radius * 1.35, flangeThickness, _config.flangeDetail);
        
        const flange1 = new THREE.Mesh(flangeGeom, flangeMat);
        flange1.rotation.x = Math.PI / 2;
        flange1.position.z = -bodyLength/2;
        group.add(flange1);
        
        const flange2 = new THREE.Mesh(flangeGeom.clone(), flangeMat);
        flange2.rotation.x = Math.PI / 2;
        flange2.position.z = bodyLength/2;
        group.add(flange2);
        
        // Bonete
        const bonnetGeom = new THREE.CylinderGeometry(radius * 0.65, radius, bonnetHeight, _config.valveDetail);
        const bonnetMesh = new THREE.Mesh(bonnetGeom, bodyMat);
        bonnetMesh.position.y = bodyWidth/2 + bonnetHeight/2;
        bonnetMesh.castShadow = true;
        group.add(bonnetMesh);
        
        // Pernos del bonete
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const boltGeom = new THREE.CylinderGeometry(2.2, 2.2, 14, 6);
            const bolt = new THREE.Mesh(boltGeom, createSteelMaterial(0x404040, 0.2, 0.95));
            bolt.position.set(
                Math.cos(angle) * radius * 0.7,
                bodyWidth/2 - 3,
                Math.sin(angle) * radius * 0.7
            );
            group.add(bolt);
        }
        
        // Vástago
        const stemGeom = new THREE.CylinderGeometry(radius * 0.22, radius * 0.25, stemHeight, _config.valveDetail);
        const stemMesh = new THREE.Mesh(stemGeom, stemMat);
        stemMesh.position.y = bodyWidth/2 + bonnetHeight + stemHeight/2;
        stemMesh.castShadow = true;
        group.add(stemMesh);
        
        // Volante
        const handwheelGeom = new THREE.TorusGeometry(radius * 0.85, radius * 0.12, 10, _config.valveDetail);
        const handwheelMesh = new THREE.Mesh(handwheelGeom, handwheelMat);
        handwheelMesh.position.y = bodyWidth/2 + bonnetHeight + stemHeight;
        group.add(handwheelMesh);
        
        // Radios del volante
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const spokeGeom = new THREE.CylinderGeometry(1.8, 1.8, radius * 0.7, 6);
            const spoke = new THREE.Mesh(spokeGeom, handwheelMat);
            spoke.position.set(
                Math.cos(angle) * radius * 0.4,
                bodyWidth/2 + bonnetHeight + stemHeight,
                Math.sin(angle) * radius * 0.4
            );
            group.add(spoke);
        }
        
        // Placa de identificación
        const nameplate = createNameplate(equipmentData?.tag || 'VALVE', specCode, diameter);
        nameplate.position.set(0, bodyWidth/2 - 15, bodyLength/2 + 5);
        group.add(nameplate);
        
        group.position.set(position.x, position.y, position.z);
        const dirVec = new THREE.Vector3(direction.dx, direction.dy, direction.dz).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirVec);
        group.setRotationFromQuaternion(quat);
        
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    
    // ================================================================
    // 6. FUNCIÓN AUXILIAR: PLACA DE IDENTIFICACIÓN
    // ================================================================
    
    function createNameplate(tag, specCode, diameter, additionalInfo = {}) {
        const group = new THREE.Group();
        const materialDef = IndustrialMaterials[SpecMaterialMap[specCode] || 'CS'];
        
        const plateColor = materialDef?.color || 0xc0c0c0;
        const plateMat = createSteelMaterial(plateColor, 0.25, 0.85, 'brushed');
        
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Fondo de la placa
        ctx.fillStyle = '#c8d0d8';
        ctx.fillRect(0, 0, 512, 256);
        ctx.strokeStyle = '#334455';
        ctx.lineWidth = 3;
        ctx.strokeRect(5, 5, 502, 246);
        
        // Borde decorativo
        ctx.strokeStyle = '#8899aa';
        ctx.lineWidth = 1;
        ctx.strokeRect(10, 10, 492, 236);
        
        // Texto principal (TAG)
        ctx.fillStyle = '#000000';
        ctx.font = 'Bold 32px "Arial", "Microsoft YaHei"';
        ctx.textAlign = 'center';
        ctx.fillText(tag || 'EQUIPMENT', 256, 60);
        
        // Especificación
        ctx.font = '20px "Arial"';
        ctx.fillStyle = '#334455';
        ctx.fillText(`SPEC: ${specCode || 'STD'}`, 256, 110);
        
        // Diámetro / tamaño
        ctx.font = '18px "Arial"';
        ctx.fillStyle = '#445566';
        ctx.fillText(`SIZE: ${diameter || '?'}"`, 256, 155);
        
        // Información adicional
        if (additionalInfo.rating) {
            ctx.fillText(`CLASS: ${additionalInfo.rating}`, 256, 195);
        }
        if (additionalInfo.material) {
            ctx.fillText(`MAT: ${additionalInfo.material}`, 256, 235);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        const textMat = new THREE.MeshStandardMaterial({ 
            map: texture, 
            metalness: 0.1,
            roughness: 0.4
        });
        
        const plate = new THREE.Mesh(new THREE.BoxGeometry(70, 35, 1.5), plateMat);
        const textPlate = new THREE.Mesh(new THREE.BoxGeometry(68, 33, 0.5), textMat);
        textPlate.position.z = 1;
        
        group.add(plate);
        group.add(textPlate);
        
        return group;
    }
    
    // ================================================================
    // 7. TANQUES MEJORADOS (NIVEL 2)
    // ================================================================
    
    function createVerticalTank(equipmentData) {
        const group = new THREE.Group();
        const specCode = equipmentData.spec;
        const diametro = equipmentData.diametro || 2000;
        const altura = equipmentData.altura || 5000;
        const radius = diametro / 2;
        
        const bodyMat = getMaterialBySpec(specCode, 'tank');
        const ringMat = getMaterialBySpec(specCode, 'flange');
        
        // Cuerpo principal
        const bodyGeom = new THREE.CylinderGeometry(radius, radius, altura, _config.pipeSegments, 1);
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        group.add(bodyMesh);
        
        // Anillos de refuerzo
        const numRings = Math.floor(altura / 1200);
        for (let i = 1; i < numRings; i++) {
            const ringGeom = new THREE.TorusGeometry(radius + 6, 10, 12, _config.pipeSegments);
            const ringMesh = new THREE.Mesh(ringGeom, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.y = -altura/2 + i * 1200;
            group.add(ringMesh);
        }
        
        // Fondo toriesférico
        const bottomGeom = new THREE.SphereGeometry(radius * 1.05, _config.pipeSegments, _config.pipeSegments/2, 0, Math.PI * 2, 0, Math.PI/4);
        const bottomMesh = new THREE.Mesh(bottomGeom, bodyMat);
        bottomMesh.position.y = -altura/2;
        bottomMesh.castShadow = true;
        group.add(bottomMesh);
        
        // Techo
        const roofMat = getMaterialBySpec(specCode, 'tank');
        const roofGeom = new THREE.CylinderGeometry(radius * 0.2, radius, radius * 0.3, _config.pipeSegments);
        const roofMesh = new THREE.Mesh(roofGeom, roofMat);
        roofMesh.position.y = altura/2 + radius * 0.15;
        roofMesh.castShadow = true;
        group.add(roofMesh);
        
        // Escalera
        const ladderMat = getMaterialBySpec('CS_GALVANIZED', 'structure');
        for (let i = 0; i < 10; i++) {
            const rungGeom = new THREE.CylinderGeometry(5, 5, 280, 8);
            const rung = new THREE.Mesh(rungGeom, ladderMat);
            rung.position.set(radius + 45, -altura/2 + 500 + i * 520, 0);
            rung.rotation.z = Math.PI / 2;
            group.add(rung);
        }
        
        // Placa de identificación
        const nameplate = createNameplate(equipmentData.tag, specCode, diametro / 25.4, {
            rating: equipmentData.presion || 'ATM',
            material: equipmentData.material || 'CS'
        });
        nameplate.position.set(0, altura/2 - 200, radius + 10);
        group.add(nameplate);
        
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    
    // ================================================================
    // 8. BOMBA MEJORADA (NIVEL 2)
    // ================================================================
    
    function createPumpMesh(equipmentData) {
        const group = new THREE.Group();
        const specCode = equipmentData.spec;
        
        const largo = equipmentData.largo || 1200;
        const ancho = equipmentData.ancho || 600;
        const altura = equipmentData.altura || 800;
        
        const baseMat = getMaterialBySpec('CS', 'structure');
        const carcasaMat = getMaterialBySpec(specCode, 'body');
        const motorMat = getMaterialBySpec('SS304', 'body');
        
        // Base de montaje
        const baseGeom = new THREE.BoxGeometry(largo, 30, ancho);
        const baseMesh = new THREE.Mesh(baseGeom, baseMat);
        baseMesh.position.y = -altura/2;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        group.add(baseMesh);
        
        // Carcasa (voluta)
        const voluteGeom = new THREE.SphereGeometry(ancho * 0.35, _config.valveDetail, _config.valveDetail);
        voluteGeom.scale(1, 0.55, 1.2);
        const voluteMesh = new THREE.Mesh(voluteGeom, carcasaMat);
        voluteMesh.position.y = -altura/4;
        voluteMesh.castShadow = true;
        group.add(voluteMesh);
        
        // Motor
        const motorGeom = new THREE.CylinderGeometry(ancho * 0.25, ancho * 0.25, largo * 0.45, _config.valveDetail);
        const motorMesh = new THREE.Mesh(motorGeom, motorMat);
        motorMesh.rotation.z = Math.PI / 2;
        motorMesh.position.set(largo * 0.25, -altura/5, 0);
        motorMesh.castShadow = true;
        group.add(motorMesh);
        
        // Placa de identificación
        const nameplate = createNameplate(equipmentData.tag, specCode, equipmentData.diametro || 4, {
            rating: `${equipmentData.potencia || 'N/A'} kW`,
            material: equipmentData.material || 'CS'
        });
        nameplate.position.set(0, 20, ancho/2 + 10);
        group.add(nameplate);
        
        group.castShadow = true;
        group.receiveShadow = true;
        
        return group;
    }
    
    // ================================================================
    // 9. ENTORNO HDRI (REALISMO AMBIENTAL)
    // ================================================================
    
    let _environmentMap = null;
    
    function setupEnvironment() {
        // Crear entorno HDRI procedural
        const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
        const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
        
        // Simular entorno industrial
        const envScene = new THREE.Scene();
        const envLight = new THREE.AmbientLight(0x445566);
        envScene.add(envLight);
        
        // Añadir "cielo" industrial
        const skyColor = new THREE.Color(0x4a6a8a);
        const groundColor = new THREE.Color(0x3a4a5a);
        
        // Usar CubeTextureLoader para un entorno más realista
        const cubeTextureLoader = new THREE.CubeTextureLoader();
        cubeTextureLoader.setPath('textures/cube/');
        
        // Si no hay texturas externas, usar color sólido con reflejos
        const envMap = cubeTextureLoader.load([
            'px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg'
        ], undefined, undefined, function(err) {
            console.log('Usando entorno procedural (HDRI no disponible)');
            // Fallback: crear textura procedural
            const proceduralEnv = createProceduralEnvironment();
            _scene.environment = proceduralEnv;
        });
        
        if (envMap) {
            _scene.environment = envMap;
            _scene.background = envMap;
        }
        
        // Intensidad de reflejos global
        _scene.environmentIntensity = 1.2;
    }
    
    function createProceduralEnvironment() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Cielo industrial
        const gradient = ctx.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#4a6a8a');
        gradient.addColorStop(0.5, '#6a8aaa');
        gradient.addColorStop(1, '#3a4a5a');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1024, 512);
        
        // Nubes
        for (let i = 0; i < 80; i++) {
            ctx.fillStyle = `rgba(200,210,230,${Math.random() * 0.2})`;
            ctx.beginPath();
            ctx.ellipse(
                Math.random() * 1024, Math.random() * 300,
                Math.random() * 80 + 30, Math.random() * 40 + 15,
                0, 0, Math.PI * 2
            );
            ctx.fill();
        }
        
        // Suelo industrial (gris)
        ctx.fillStyle = '#4a5a6a';
        ctx.fillRect(0, 400, 1024, 112);
        
        // Líneas del suelo (como piso de planta)
        ctx.strokeStyle = '#6a7a8a';
        ctx.lineWidth = 2;
        for (let x = 0; x < 1024; x += 100) {
            ctx.beginPath();
            ctx.moveTo(x, 400);
            ctx.lineTo(x, 512);
            ctx.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        
        return texture;
    }
    
    // ================================================================
    // 10. FUNCIÓN DE ACTUALIZACIÓN DEL CICLO DE VIDA
    // ================================================================
    
    // Override de la función buildEquipment original para usar materiales Nivel 2
    const _originalBuildEquipment = buildEquipment;
    
    function buildEquipment(eq) {
        // Usar las nuevas funciones mejoradas
        const tipo = eq.tipo || '';
        
        let mesh;
        if (tipo === 'bomba' || tipo === 'bomba_centrifuga') {
            mesh = createPumpMesh(eq);
        } else if (tipo === 'tanque_v' || tipo === 'torre' || tipo === 'reactor') {
            mesh = createVerticalTank(eq);
        } else if (tipo === 'intercambiador' || tipo === 'condensador') {
            mesh = createHeatExchanger(eq);
        } else {
            mesh = _originalBuildEquipment(eq);
        }
        
        if (mesh) {
            mesh.position.set(eq.posX || 0, eq.posY || 0, eq.posZ || 0);
            mesh.userData = { tag: eq.tag, type: 'equipment', data: eq };
            _scene.add(mesh);
            _equipmentMeshes.set(eq.tag, mesh);
        }
        
        return mesh;
    }
    
    // ================================================================
    // 11. EXPORTAR API ACTUALIZADA
    // ================================================================
    
    // Mantener todas las funciones existentes y añadir las nuevas
    
    return {
        init: init,
        rebuildScene: rebuildScene,
        updateAll: updateAll,
        updateEquipmentMesh: updateEquipmentMesh,
        updateLineMesh: updateLineMesh,
        dispose: dispose,
        setView: setView,
        setIsoView: setIsoView,
        focusOn: focusOn,
        zoomToFit: zoomToFit,
        selectObject: selectObject,
        deselectObject: deselectObject,
        getSelected: getSelected,
        onSelection: onSelection,
        setConfig: setConfig,
        getConfig: getConfig,
        getScene: getScene,
        getCamera: getCamera,
        getRenderer: getRenderer,
        getControls: getControls,
        onRender: onRender,
        setNotify: setNotify,
        isReady: isReady,
        // Nuevas funciones Nivel 2
        getMaterialBySpec: getMaterialBySpec,
        createNameplate: createNameplate,
        setEnvironmentIntensity: function(intensity) { 
            if (_scene) _scene.environmentIntensity = intensity;
        },
        // Funciones existentes (mantener compatibilidad)
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

// Exponer globalmente
window.SmartFlowRenderer3D = SmartFlowRenderer3D;
