
// ============================================================
// SMARTFLOW RENDER v8.0 (Símbolos 3D + Cotas + Flujo + CÁMARA ORTOGRÁFICA ISOMÉTRICA)
// Archivo: js/render.js
// Cambios: 
//   - Agregado soporte para cámara ortográfica (verdadera proyección isométrica)
//   - Toggle entre perspectiva y ortográfica
//   - Compatibilidad con Core v5.4+
// ============================================================

const SmartFlowRender = (function() {
    let _composer = null;
    let _outlinePass = null;
    let _currentHighlighted = null;
    let _infoPanel = null;
    let _core = null;
    let _labelRenderer = null;
    
    let _symbolGroup = new THREE.Group();
    let _dimensionGroup = new THREE.Group();
    let _flowArrowGroup = new THREE.Group();
    
    let _isAnimating = false;
    let _targetPos = new THREE.Vector3();
    let _targetLookAt = new THREE.Vector3();
    const _transitionSpeed = 0.08;
    
    let _debounceTimer = null;
    
    // ==================== CÁMARA ORTOGRÁFICA ISOMÉTRICA ====================
    let _orthoCamera = null;
    let _perspCamera = null;
    let _isOrthoMode = false;
    let _originalCamera = null;
    
    // Configuración de la cámara ortográfica
    const ORTHO_SIZE = 14;        // Tamaño de vista en unidades (metros)
    const ORTHO_ZOOM_DEFAULT = 1.2;
    const ORTHO_POSITION = { x: 10, y: 10, z: 10 };  // Posición isométrica clásica
    
    function createOrthoCamera(containerWidth, containerHeight) {
        const aspect = containerWidth / containerHeight;
        
        const camera = new THREE.OrthographicCamera(
            -ORTHO_SIZE * aspect, ORTHO_SIZE * aspect,
            ORTHO_SIZE, -ORTHO_SIZE,
            0.1, 1000
        );
        
        // Posición isométrica clásica: ángulos 45° y 35.264°
        camera.position.set(ORTHO_POSITION.x, ORTHO_POSITION.y, ORTHO_POSITION.z);
        camera.lookAt(0, 0, 0);
        camera.zoom = ORTHO_ZOOM_DEFAULT;
        camera.updateProjectionMatrix();
        
        return camera;
    }
    
    function switchToOrthoMode() {
        if (!_core) return false;
        
        // Obtener cámara actual (perspectiva)
        const currentCam = _core.getCamera();
        if (!currentCam) return false;
        
        // Guardar cámara perspectiva original si no existe
        if (!_perspCamera) {
            _perspCamera = currentCam;
        }
        
        // Crear cámara ortográfica
        const container = document.getElementById('canvas-container');
        const width = container ? container.clientWidth : window.innerWidth;
        const height = container ? container.clientHeight : window.innerHeight;
        _orthoCamera = createOrthoCamera(width, height);
        
        // Calcular centro de la escena para mantener la vista
        const center = calculateSceneCenter();
        if (center) {
            _orthoCamera.position.set(
                center.x + ORTHO_POSITION.x,
                center.y + ORTHO_POSITION.y,
                center.z + ORTHO_POSITION.z
            );
            _orthoCamera.lookAt(center);
        }
        
        // Reemplazar cámara en el core
        if (typeof _core.setCamera === 'function') {
            _core.setCamera(_orthoCamera);
        }
        
        // Actualizar controles
        const controls = _core.getControls();
        if (controls) {
            controls.object = _orthoCamera;
            controls.target.set(center ? center.x : 0, center ? center.y : 0, center ? center.z : 0);
            controls.update();
        }
        
        _isOrthoMode = true;
        console.log('✅ Modo ISOMÉTRICO ORTOGRÁFICO activado');
        
        // Notificar cambio de cámara
        if (typeof _core.emit === 'function') {
            _core.emit('cameraChanged', { mode: 'ortho', camera: _orthoCamera });
        }
        
        return true;
    }
    
    function switchToPerspMode() {
        if (!_core || !_perspCamera) return false;
        
        // Restaurar cámara perspectiva
        if (typeof _core.setCamera === 'function') {
            _core.setCamera(_perspCamera);
        }
        
        // Actualizar controles
        const controls = _core.getControls();
        if (controls) {
            controls.object = _perspCamera;
            controls.update();
        }
        
        _isOrthoMode = false;
        console.log('✅ Modo PERSPECTIVA activado');
        
        // Notificar cambio de cámara
        if (typeof _core.emit === 'function') {
            _core.emit('cameraChanged', { mode: 'perspective', camera: _perspCamera });
        }
        
        return true;
    }
    
    function toggleCameraMode() {
        if (_isOrthoMode) {
            return switchToPerspMode();
        } else {
            return switchToOrthoMode();
        }
    }
    
    function isOrthoMode() {
        return _isOrthoMode;
    }
    
    function handleWindowResize() {
        if (!_isOrthoMode || !_orthoCamera) return;
        
        const container = document.getElementById('canvas-container');
        if (!container) return;
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        const aspect = width / height;
        
        _orthoCamera.left = -ORTHO_SIZE * aspect;
        _orthoCamera.right = ORTHO_SIZE * aspect;
        _orthoCamera.top = ORTHO_SIZE;
        _orthoCamera.bottom = -ORTHO_SIZE;
        _orthoCamera.updateProjectionMatrix();
    }
    
    function calculateSceneCenter() {
        const scene = _core.getScene();
        if (!scene) return null;
        
        const bounds = new THREE.Box3();
        let hasValidObject = false;
        
        scene.traverse((child) => {
            if (child.isMesh && child.visible && child.geometry) {
                if (child.userData && (child.userData.isComponentSymbol || 
                    child.userData.isDimensionLine || 
                    child.userData.isFlowArrow)) {
                    return;
                }
                if (child.parent === _symbolGroup || 
                    child.parent === _dimensionGroup || 
                    child.parent === _flowArrowGroup) {
                    return;
                }
                if (child instanceof THREE.GridHelper) return;
                if (child instanceof THREE.CSS2DObject) return;
                
                bounds.expandByObject(child);
                hasValidObject = true;
            }
        });
        
        if (!hasValidObject) return null;
        return bounds.getCenter(new THREE.Vector3());
    }
    
    // ==================== FIN CÁMARA ORTOGRÁFICA ====================
    
    const materials = {
        valve: new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.4, roughness: 0.3 }),
        tee: new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.4, roughness: 0.3 }),
        reducer: new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.4, roughness: 0.3 }),
        elbow: new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.4, roughness: 0.3 }),
        flange: new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.2 }),
        instrument: new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.2, roughness: 0.5 }),
        pipe: new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.1, roughness: 0.6 }),
        platform_steel: new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.8, roughness: 0.3 }),
        platform_concrete: new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.1, roughness: 0.8 }),
        highlight: new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.3 })
    };

    function setupEffects() {
        const scene = _core.getScene();
        const camera = _core.getCamera();
        const renderer = _core.getRenderer();
        if (!scene || !camera || !renderer) return;
        
        if (typeof THREE.EffectComposer !== 'undefined') {
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
        }
    }
    
    function createValve3D(comp, position, direction, size) {
        const group = new THREE.Group();
        const s = size || 0.3;
        
        const bodyGeo = new THREE.BoxGeometry(s * 1.5, s, s);
        const body = new THREE.Mesh(bodyGeo, materials.valve.clone());
        group.add(body);
        
        const handwheelGeo = new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 0.3, 16);
        const handwheel = new THREE.Mesh(handwheelGeo, materials.valve.clone());
        handwheel.position.y = s * 0.7;
        group.add(handwheel);
        
        const stemGeo = new THREE.CylinderGeometry(s * 0.1, s * 0.1, s * 0.5, 8);
        const stem = new THREE.Mesh(stemGeo, materials.valve.clone());
        stem.position.y = s * 0.3;
        group.add(stem);
        
        group.position.copy(position);
        if (direction) {
            group.quaternion.setFromUnitVectors(
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(direction.dx, direction.dy, direction.dz)
            );
        }
        
        return group;
    }
    
    function createTee3D(position, direction, perpendicular, size) {
        const group = new THREE.Group();
        const s = size || 0.25;
        
        const mainGeo = new THREE.CylinderGeometry(s * 0.6, s * 0.6, s * 3, 16);
        const main = new THREE.Mesh(mainGeo, materials.tee.clone());
        main.rotation.z = Math.PI / 2;
        group.add(main);
        
        const branchGeo = new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 1.5, 16);
        const branch = new THREE.Mesh(branchGeo, materials.tee.clone());
        branch.position.y = s * 0.75;
        group.add(branch);
        
        const centerGeo = new THREE.SphereGeometry(s * 0.7, 16, 16);
        const center = new THREE.Mesh(centerGeo, materials.tee.clone());
        group.add(center);
        
        group.position.copy(position);
        if (direction && perpendicular) {
            const dirVec = new THREE.Vector3(direction.dx, direction.dy, direction.dz);
            const quat = new THREE.Quaternion();
            quat.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dirVec);
            group.quaternion.copy(quat);
        }
        
        return group;
    }
    
    function createReducer3D(position, direction, size) {
        const group = new THREE.Group();
        const s = size || 0.25;
        
        const reducerGeo = new THREE.CylinderGeometry(s * 0.7, s * 0.4, s * 2, 16);
        const reducer = new THREE.Mesh(reducerGeo, materials.reducer.clone());
        reducer.rotation.z = Math.PI / 2;
        group.add(reducer);
        
        group.position.copy(position);
        if (direction) {
            group.quaternion.setFromUnitVectors(
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(direction.dx, direction.dy, direction.dz)
            );
        }
        
        return group;
    }
    
    function createElbow3D(position, direction, nextDirection, size, angle) {
        const group = new THREE.Group();
        const s = size || 0.25;
        
        const elbowGeo = new THREE.SphereGeometry(s * 0.6, 16, 16);
        const elbow = new THREE.Mesh(elbowGeo, materials.elbow.clone());
        group.add(elbow);
        
        const ringGeo = new THREE.TorusGeometry(s * 0.7, s * 0.1, 8, 16);
        const ring = new THREE.Mesh(ringGeo, materials.elbow.clone());
        group.add(ring);
        
        group.position.copy(position);
        
        return group;
    }
    
    function createFlange3D(position, direction, size) {
        const group = new THREE.Group();
        const s = size || 0.25;
        
        const flangeGeo = new THREE.CylinderGeometry(s * 0.8, s * 0.8, s * 0.3, 32);
        const flange = new THREE.Mesh(flangeGeo, materials.flange.clone());
        flange.rotation.z = Math.PI / 2;
        group.add(flange);
        
        group.position.copy(position);
        if (direction) {
            group.quaternion.setFromUnitVectors(
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(direction.dx, direction.dy, direction.dz)
            );
        }
        
        return group;
    }
    
    function createInstrument3D(position, type, size) {
        const group = new THREE.Group();
        const s = size || 0.2;
        
        const boxGeo = new THREE.BoxGeometry(s * 1.2, s * 1.5, s * 0.8);
        const box = new THREE.Mesh(boxGeo, materials.instrument.clone());
        group.add(box);
        
        const dialGeo = new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 0.1, 32);
        const dial = new THREE.Mesh(dialGeo, materials.instrument.clone());
        dial.position.z = s * 0.5;
        group.add(dial);
        
        group.position.copy(position);
        
        return group;
    }
    
    function createPlatform3D(eq) {
        const group = new THREE.Group();
        const w = (eq.largo || 6000) / 1000;
        const d = (eq.ancho || 3000) / 1000;
        const h = (eq.altura || 400) / 1000;
        const material = (eq.material || '').toUpperCase();
        const esConcreto = material.includes('CONCRETO') || material.includes('CEMENTO');
        
        const baseGeo = new THREE.BoxGeometry(w, h, d);
        const baseMat = esConcreto ? materials.platform_concrete.clone() : materials.platform_steel.clone();
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = h / 2;
        group.add(base);
        
        const legGeo = new THREE.BoxGeometry(0.1, h * 2, 0.1);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.7, roughness: 0.3 });
        const positions = [
            { x: -w/2 + 0.15, z: -d/2 + 0.15 },
            { x: w/2 - 0.15, z: -d/2 + 0.15 },
            { x: w/2 - 0.15, z: d/2 - 0.15 },
            { x: -w/2 + 0.15, z: d/2 - 0.15 }
        ];
        positions.forEach(pos => {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(pos.x, -h/2, pos.z);
            group.add(leg);
        });
        
        if (eq.baranda) {
            const railGeo = new THREE.BoxGeometry(w, 0.05, 0.05);
            const railMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.6, roughness: 0.3 });
            const railH = h + 0.2;
            ['front', 'back'].forEach((side, idx) => {
                const rail = new THREE.Mesh(railGeo, railMat);
                rail.position.set(0, railH, idx === 0 ? d/2 : -d/2);
                group.add(rail);
            });
            const sideGeo = new THREE.BoxGeometry(0.05, 0.05, d);
            ['left', 'right'].forEach((side, idx) => {
                const rail = new THREE.Mesh(sideGeo, railMat);
                rail.position.set(idx === 0 ? -w/2 : w/2, railH, 0);
                group.add(rail);
            });
        }
        
        group.position.set(eq.posX / 1000, eq.posY / 1000, eq.posZ / 1000);
        group.userData = { tag: eq.tag, type: 'plataforma', isEquipment: true };
        
        return group;
    }
    
    function createComponentSymbols(line) {
        if (!line.components || !line.components.length) return;
        
        const pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
        if (pts.length < 2) return;
        
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d);
            totalLen += d;
        }
        if (totalLen === 0) return;
        
        line.components.forEach(comp => {
            const param = comp.param || 0.5;
            const targetLen = totalLen * Math.min(1, Math.max(0, param));
            let accum = 0, segIdx = 0, t = 0;
            
            for (let i = 0; i < lengths.length; i++) {
                if (accum + lengths[i] >= targetLen || i === lengths.length - 1) {
                    segIdx = i;
                    t = (targetLen - accum) / (lengths[i] || 1);
                    break;
                }
                accum += lengths[i];
            }
            
            const pA = pts[segIdx], pB = pts[segIdx + 1];
            const position = {
                x: pA.x + (pB.x - pA.x) * t,
                y: pA.y + (pB.y - pA.y) * t,
                z: pA.z + (pB.z - pA.z) * t
            };
            
            const direction = {
                dx: pB.x - pA.x,
                dy: pB.y - pA.y,
                dz: pB.z - pA.z
            };
            const dirLen = Math.hypot(direction.dx, direction.dy, direction.dz) || 1;
            const dirUnit = {
                dx: direction.dx / dirLen,
                dy: direction.dy / dirLen,
                dz: direction.dz / dirLen
            };
            
            const size = (line.diameter || 4) * 0.06;
            const pos3D = new THREE.Vector3(position.x / 1000, position.y / 1000, position.z / 1000);
            const dir3D = new THREE.Vector3(dirUnit.dx, dirUnit.dy, dirUnit.dz);
            
            let symbol = null;
            const type = (comp.type || '').toUpperCase();
            
            if (type.includes('VALVE') || type.includes('VALVULA')) {
                symbol = createValve3D(comp, pos3D, dir3D, size);
            } else if (type.includes('TEE')) {
                symbol = createTee3D(comp, pos3D, dir3D, null, size);
            } else if (type.includes('REDUCER') || type.includes('REDUCTOR')) {
                symbol = createReducer3D(comp, pos3D, dir3D, size);
            } else if (type.includes('ELBOW') || type.includes('CODO')) {
                symbol = createElbow3D(comp, pos3D, dir3D, null, size, comp.angle || 90);
            } else if (type.includes('FLANGE') || type.includes('BRIDA')) {
                symbol = createFlange3D(comp, pos3D, dir3D, size);
            } else if (type.includes('GAUGE') || type.includes('METER') || type.includes('SWITCH')) {
                symbol = createInstrument3D(comp, pos3D, type, size);
            } else {
                const geo = new THREE.SphereGeometry(size * 0.4, 8, 8);
                symbol = new THREE.Mesh(geo, materials.valve.clone());
                symbol.position.copy(pos3D);
            }
            
            if (symbol) {
                symbol.userData = { tag: comp.tag, type: comp.type, lineTag: line.tag, isComponentSymbol: true };
                _symbolGroup.add(symbol);
            }
        });
    }
    
    function refreshAllSymbols() {
        if (!_core) return;
        
        while (_symbolGroup.children.length > 0) {
            const child = _symbolGroup.children[0];
            if (child.material) child.material.dispose();
            if (child.geometry) child.geometry.dispose();
            _symbolGroup.remove(child);
        }
        
        const db = _core.getDb();
        (db.lines || []).forEach(line => {
            createComponentSymbols(line);
        });
    }
    
    function createDimensionLine(p1, p2, color = 0xfacc15) {
        const pos1 = new THREE.Vector3(p1.x / 1000, p1.y / 1000 + 0.3, p1.z / 1000);
        const pos2 = new THREE.Vector3(p2.x / 1000, p2.y / 1000 + 0.3, p2.z / 1000);
        
        const lineGeo = new THREE.BufferGeometry().setFromPoints([pos1, pos2]);
        const lineMat = new THREE.LineBasicMaterial({ color: color, linewidth: 1, transparent: true, opacity: 0.7 });
        const line = new THREE.Line(lineGeo, lineMat);
        line.userData = { isDimensionLine: true };
        _dimensionGroup.add(line);
        
        const tickSize = 0.15;
        const normal = new THREE.Vector3(0, -1, 0);
        const tickGeo1 = new THREE.BufferGeometry().setFromPoints([
            pos1, new THREE.Vector3().addVectors(pos1, normal.clone().multiplyScalar(tickSize))
        ]);
        const tickGeo2 = new THREE.BufferGeometry().setFromPoints([
            pos2, new THREE.Vector3().addVectors(pos2, normal.clone().multiplyScalar(tickSize))
        ]);
        const tick1 = new THREE.Line(tickGeo1, lineMat);
        const tick2 = new THREE.Line(tickGeo2, lineMat);
        tick1.userData = { isDimensionLine: true };
        tick2.userData = { isDimensionLine: true };
        _dimensionGroup.add(tick1);
        _dimensionGroup.add(tick2);
    }
    
    function refreshAllDimensions() {
        if (!_core) return;
        
        while (_dimensionGroup.children.length > 0) {
            const child = _dimensionGroup.children[0];
            if (child.material) child.material.dispose();
            if (child.geometry) child.geometry.dispose();
            _dimensionGroup.remove(child);
        }
        
        const db = _core.getDb();
        (db.lines || []).forEach(line => {
            const pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
            if (pts.length >= 2) {
                for (let i = 0; i < pts.length - 1; i++) {
                    createDimensionLine(pts[i], pts[i + 1]);
                }
            }
        });
    }
    
    function createFlowArrows(line) {
        const pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
        if (pts.length < 2) return;
        
        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i], p2 = pts[i + 1];
            const mid = {
                x: (p1.x + p2.x) / 2 / 1000,
                y: (p1.y + p2.y) / 2 / 1000,
                z: (p1.z + p2.z) / 2 / 1000
            };
            
            const dir = {
                x: (p2.x - p1.x) / 1000,
                y: (p2.y - p1.y) / 1000,
                z: (p2.z - p1.z) / 1000
            };
            const dirLen = Math.hypot(dir.x, dir.y, dir.z) || 1;
            
            const coneGeo = new THREE.ConeGeometry(0.08, 0.2, 8, 8);
            const cone = new THREE.Mesh(coneGeo, new THREE.MeshStandardMaterial({ 
                color: 0x00f2ff, 
                emissive: 0x003344,
                metalness: 0.1,
                roughness: 0.4
            }));
            cone.position.set(mid.x, mid.y + 0.15, mid.z);
            
            const dirVec = new THREE.Vector3(dir.x / dirLen, dir.y / dirLen, dir.z / dirLen);
            const upVec = new THREE.Vector3(0, 1, 0);
            const quat = new THREE.Quaternion();
            quat.setFromUnitVectors(upVec, dirVec);
            cone.quaternion.copy(quat);
            
            cone.userData = { type: 'flowArrow', lineTag: line.tag, isFlowArrow: true };
            _flowArrowGroup.add(cone);
        }
    }
    
    function refreshAllFlowArrows() {
        if (!_core) return;
        
        while (_flowArrowGroup.children.length > 0) {
            const child = _flowArrowGroup.children[0];
            if (child.material) child.material.dispose();
            if (child.geometry) child.geometry.dispose();
            _flowArrowGroup.remove(child);
        }
        
        const db = _core.getDb();
        (db.lines || []).forEach(line => {
            createFlowArrows(line);
        });
    }
    
    function focusOnObject(mesh) {
        if (!mesh || !_core.getControls()) return;
        const camera = _core.getCamera();
        const controls = _core.getControls();
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        if (_isOrthoMode && _orthoCamera) {
            // Modo ortográfico: ajustar zoom y posición
            const targetZoom = Math.max(0.8, Math.min(3, ORTHO_SIZE / Math.max(maxDim, 0.1)));
            _orthoCamera.zoom = targetZoom;
            _orthoCamera.position.set(center.x + ORTHO_POSITION.x, center.y + ORTHO_POSITION.y, center.z + ORTHO_POSITION.z);
            _orthoCamera.lookAt(center);
            _orthoCamera.updateProjectionMatrix();
            controls.target.copy(center);
        } else {
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8;
            const direction = new THREE.Vector3().subVectors(camera.position, center).normalize();
            _targetPos.copy(center).add(direction.multiplyScalar(cameraZ));
            _targetLookAt.copy(center);
            _isAnimating = true;
        }
        controls.update();
    }
    
    function fitCameraToEquipments() {
        const scene = _core.getScene();
        const camera = _core.getCamera();
        const controls = _core.getControls();
        if (!scene || !camera || !controls) return;
        
        const bounds = new THREE.Box3();
        let hasValidObject = false;
        
        scene.traverse((child) => {
            if (child.isMesh && child.visible && child.geometry) {
                if (child.userData && (child.userData.isComponentSymbol || 
                    child.userData.isDimensionLine || 
                    child.userData.isFlowArrow)) {
                    return;
                }
                if (child.parent === _symbolGroup || 
                    child.parent === _dimensionGroup || 
                    child.parent === _flowArrowGroup) {
                    return;
                }
                if (child instanceof THREE.GridHelper) return;
                if (child instanceof THREE.CSS2DObject) return;
                
                const box = new THREE.Box3().setFromObject(child);
                if (box.getSize(new THREE.Vector3()).length() > 0.01) {
                    bounds.expandByObject(child);
                    hasValidObject = true;
                }
            }
        });
        
        if (!hasValidObject) {
            setView('iso');
            return;
        }
        
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        if (_isOrthoMode && _orthoCamera) {
            const targetZoom = Math.max(0.8, Math.min(3, ORTHO_SIZE / Math.max(maxDim, 0.1)));
            _orthoCamera.zoom = targetZoom;
            _orthoCamera.position.set(center.x + ORTHO_POSITION.x, center.y + ORTHO_POSITION.y, center.z + ORTHO_POSITION.z);
            _orthoCamera.lookAt(center);
            _orthoCamera.updateProjectionMatrix();
            controls.target.copy(center);
        } else {
            const effectiveMaxDim = Math.max(maxDim, 5);
            const fov = camera.fov * (Math.PI / 180);
            let distance = Math.abs(effectiveMaxDim / 2 / Math.tan(fov / 2)) * 1.8;
            distance = Math.min(distance, 100);
            distance = Math.max(distance, 5);
            
            const angleRad = 45 * (Math.PI / 180);
            camera.position.set(
                center.x + distance * Math.sin(angleRad),
                center.y + distance * 0.6,
                center.z + distance * Math.cos(angleRad)
            );
            controls.target.copy(center);
        }
        controls.update();
    }
    
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
    
    function setView(type) {
        const camera = _core.getCamera();
        const controls = _core.getControls();
        if (!camera) return;
        
        const distance = 12;
        const target = new THREE.Vector3(0, 0, 0);
        
        if (_isOrthoMode && _orthoCamera) {
            switch(type) {
                case 'top':
                    _orthoCamera.position.set(0, distance, 0);
                    _orthoCamera.up.set(0, 0, 1);
                    break;
                case 'front':
                    _orthoCamera.position.set(0, 0, distance);
                    _orthoCamera.up.set(0, 1, 0);
                    break;
                case 'side':
                    _orthoCamera.position.set(distance, 0, 0);
                    _orthoCamera.up.set(0, 1, 0);
                    break;
                case 'iso':
                default:
                    _orthoCamera.position.set(distance, distance, distance);
                    _orthoCamera.up.set(0, 1, 0);
                    break;
            }
            _orthoCamera.lookAt(target);
            _orthoCamera.updateProjectionMatrix();
        } else {
            switch(type) {
                case 'top': camera.position.set(0, distance, 0); break;
                case 'front': camera.position.set(0, 0, distance); break;
                case 'side': camera.position.set(distance, 0, 0); break;
                case 'iso': camera.position.set(distance, distance, distance); break;
                default: return;
            }
            camera.lookAt(target);
        }
        
        if (controls) {
            controls.target.copy(target);
            controls.update();
        }
    }
    
    function createInfoPanel() {
        let panel = document.getElementById('selectionInfo3D');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'selectionInfo3D';
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
            const posX = obj.posX ?? obj.pos?.x ?? 0;
            const posY = obj.posY ?? obj.pos?.y ?? 0;
            const posZ = obj.posZ ?? obj.pos?.z ?? 0;
            _infoPanel.innerHTML = `
                <div style="color: #00f2ff; font-weight: bold; border-bottom: 1px solid #334155; margin-bottom: 8px; padding-bottom: 4px;">
                    📌 ${obj.tag}
                </div>
                <div><span style="color:#94a3b8;">TIPO:</span> ${selected.type.toUpperCase()}</div>
                <div><span style="color:#94a3b8;">MATERIAL:</span> ${obj.material || 'N/A'}</div>
                <div><span style="color:#94a3b8;">DIÁMETRO:</span> ${obj.diameter || obj.diametro || '-'}"</div>
                <div><span style="color:#94a3b8;">POSICIÓN:</span> X:${Math.round(posX)} Y:${Math.round(posY)} Z:${Math.round(posZ)}</div>
                ${obj.puertos ? `<div style="margin-top:6px;"><span style="color:#94a3b8;">PUERTOS:</span> ${obj.puertos.map(p => p.id).join(', ')}</div>` : ''}
            `;
        } else {
            _infoPanel.innerHTML = `
                <div style="color: #00f2ff; font-weight: bold;">🔍 SIN SELECCIÓN</div>
                <div style="color:#94a3b8;">Ctrl+Click en puerto para coordenadas</div>
            `;
        }
    }
    
    function scheduleRefresh() {
        if (_debounceTimer) clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => {
            refreshAllSymbols();
            refreshAllDimensions();
            refreshAllFlowArrows();
        }, 200);
    }
    
    function initUIBridge() {
        if (!_core) return;
        _infoPanel = createInfoPanel();
        
        if (typeof _core.on === 'function') {
            _core.on('modelChanged', () => {
                scheduleRefresh();
                const selected = _core.getSelected();
                updateInfoPanel(selected);
                updateSelectionHighlight();
            });
        }
        
        setInterval(() => {
            const selected = _core.getSelected();
            updateInfoPanel(selected);
            updateSelectionHighlight();
        }, 500);
    }
    
    function init(coreInstance) {
        _core = coreInstance;
        if (!_core) return;
        
        // Obtener scene, camera, renderer, controls desde el core
        const scene = _core.getScene();
        const camera = _core.getCamera();
        const renderer = _core.getRenderer();
        const controls = _core.getControls();
        
        if (!scene || !camera || !renderer) {
            console.warn('⚠️ No se pudieron obtener los elementos visuales del core');
            return;
        }
        
        setupEffects();
        initUIBridge();
        
        if (scene) {
            _symbolGroup.userData = { isSymbolGroup: true };
            _dimensionGroup.userData = { isDimensionGroup: true };
            _flowArrowGroup.userData = { isFlowArrowGroup: true };
            scene.add(_symbolGroup);
            scene.add(_dimensionGroup);
            scene.add(_flowArrowGroup);
        }
        
        const originalAnimate = _core.getAnimate();
        if (originalAnimate) {
            const newAnimate = () => {
                if (_isAnimating) {
                    const currentCamera = _core.getCamera();
                    const currentControls = _core.getControls();
                    if (currentCamera && currentControls) {
                        currentCamera.position.lerp(_targetPos, _transitionSpeed);
                        currentControls.target.lerp(_targetLookAt, _transitionSpeed);
                        currentControls.update();
                        if (currentCamera.position.distanceTo(_targetPos) < 0.01) {
                            _isAnimating = false;
                        }
                    }
                } else {
                    if (_core.getControls()) _core.getControls().update();
                }
                if (_composer) _composer.render();
                if (_labelRenderer && scene && _core.getCamera()) {
                    _labelRenderer.render(scene, _core.getCamera());
                }
                if (typeof SmartFlowLabels !== 'undefined' && SmartFlowLabels.actualizarVisibilidad) {
                    SmartFlowLabels.actualizarVisibilidad();
                }
                requestAnimationFrame(newAnimate);
            };
            _core.setAnimate(newAnimate);
        }
        
        // Agregar listener para resize en modo ortográfico
        window.addEventListener('resize', handleWindowResize);
        
        setTimeout(() => {
            refreshAllSymbols();
            refreshAllDimensions();
            refreshAllFlowArrows();
        }, 1000);
        
        scheduleRefresh();
        
        console.log("✔ SmartFlowRender v8.0 listo - Cámara ortográfica isométrica disponible");
    }
    
    function setLabelRenderer(lr) {
        _labelRenderer = lr;
    }
    
    return {
        init,
        setView,
        fitCameraToEquipments,
        updateSelectionHighlight,
        refreshAllSymbols,
        refreshAllDimensions,
        refreshAllFlowArrows,
        setLabelRenderer,
        getComposer: () => _composer,
        getOutlinePass: () => _outlinePass,
        // Nuevos métodos para cámara ortográfica
        toggleCameraMode,
        switchToOrthoMode,
        switchToPerspMode,
        isOrthoMode
    };
})();
