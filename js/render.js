
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';

const SmartFlowRender = (function() {
    let _composer = null;
    let _outlinePass = null;
    let _core = null;
    let _engine = null;
    let _labelRenderer = null;
    
    let _symbolGroup = new THREE.Group();
    let _dimensionGroup = new THREE.Group();
    let _flowArrowGroup = new THREE.Group();
    
    let _debounceTimer = null;
    let _totalObjects = 0;
    let _sceneRef = null;
    let _cameraRef = null;
    let _rendererRef = null;
    
    function toM(mmValue) { return (mmValue || 0) / 1000; }
    function diamToRadiusM(diamPulg) { return ((diamPulg || 4) * 25.4) / 2000; }
    function compSize(diamPulg) { return diamToRadiusM(diamPulg) * 3; }
    
    const MaterialLibrary = {
        carbonSteel: new THREE.MeshStandardMaterial({ color: 0x5c6b7a, metalness: 0.85, roughness: 0.45 }),
        carbonSteelDark: new THREE.MeshStandardMaterial({ color: 0x3d4a56, metalness: 0.9, roughness: 0.35 }),
        carbonSteelRough: new THREE.MeshStandardMaterial({ color: 0x6b7c8a, metalness: 0.8, roughness: 0.65 }),
        forgedSteel: new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.9, roughness: 0.3 }),
        stainless316: new THREE.MeshStandardMaterial({ color: 0xd4d9e0, metalness: 0.95, roughness: 0.15 }),
        stainless304: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 }),
        stainlessPolished: new THREE.MeshStandardMaterial({ color: 0xf0f4f8, metalness: 1.0, roughness: 0.08 }),
        stainlessSanitary: new THREE.MeshStandardMaterial({ color: 0xeeeff2, metalness: 0.95, roughness: 0.1 }),
        duplex2205: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.25 }),
        hastelloy: new THREE.MeshStandardMaterial({ color: 0xd4a574, metalness: 0.85, roughness: 0.3 }),
        alloy20: new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.3 }),
        pprGreen: new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.02, roughness: 0.4 }),
        pprDark: new THREE.MeshStandardMaterial({ color: 0x047857, metalness: 0.05, roughness: 0.35 }),
        hdpeBlack: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.03, roughness: 0.35 }),
        hdpeTranslucent: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.03, roughness: 0.35, transparent: true, opacity: 0.85 }),
        pvcOrange: new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.02, roughness: 0.45 }),
        pvcSocket: new THREE.MeshStandardMaterial({ color: 0xca8a04, metalness: 0.02, roughness: 0.4 }),
        cpvcBeige: new THREE.MeshStandardMaterial({ color: 0xfb923c, metalness: 0.02, roughness: 0.45 }),
        pvdfRed: new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.03, roughness: 0.4 }),
        ptfeWhite: new THREE.MeshStandardMaterial({ color: 0xf5f0e8, metalness: 0.01, roughness: 0.3 }),
        frpViolet: new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.05, roughness: 0.55, transparent: true, opacity: 0.9 }),
        concrete: new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.02, roughness: 0.9 }),
        concreteDark: new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.02, roughness: 0.85 }),
        concreteJoint: new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.01, roughness: 0.95 }),
        aluminum: new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.7, roughness: 0.25 }),
        wood: new THREE.MeshStandardMaterial({ color: 0x8b6914, metalness: 0.01, roughness: 0.8 }),
        brassFitting: new THREE.MeshStandardMaterial({ color: 0xd4a800, metalness: 0.9, roughness: 0.15 }),
        stemChrome: new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.95, roughness: 0.1 }),
        handwheelBlack: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.4, roughness: 0.5 }),
        redHandle: new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.05, roughness: 0.4 }),
        greenGasket: new THREE.MeshStandardMaterial({ color: 0x16a34a, metalness: 0.05, roughness: 0.6 }),
        blueActuator: new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.3, roughness: 0.4 }),
        glassSight: new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.55, roughness: 0.05 }),
        motorGray: new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.6, roughness: 0.35 }),
        motorDark: new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.7, roughness: 0.3 }),
        insulation: new THREE.MeshStandardMaterial({ color: 0xd6d3d1, metalness: 0.02, roughness: 0.8 }),
        epoxyPaint: new THREE.MeshStandardMaterial({ color: 0x1e40af, metalness: 0.4, roughness: 0.35 }),
        safetyYellow: new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 }),
        gratingMetal: new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.9, roughness: 0.3 }),
        pipeCS: new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.05, roughness: 0.55 }),
        pipeSS: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.08, roughness: 0.45 }),
        pipePPR: new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.02, roughness: 0.5 }),
        pipeHDPE: new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.02, roughness: 0.5 }),
        pipePVC: new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.02, roughness: 0.5 }),
        clone: function(mat) { return mat.clone(); }
    };
    
    function getSpecMaterial(spec) {
        var s = (spec || '').toUpperCase();
        if (s.includes('SS_SANITARY') || s.includes('SANITARY')) return MaterialLibrary.stainlessSanitary;
        if (s.includes('SS_') || s.includes('INOX') || s.includes('STAINLESS')) return MaterialLibrary.stainless316;
        if (s.includes('DUPLEX')) return MaterialLibrary.duplex2205;
        if (s.includes('HASTELLOY')) return MaterialLibrary.hastelloy;
        if (s.includes('ALLOY20')) return MaterialLibrary.alloy20;
        if (s.includes('PPR')) return MaterialLibrary.pprGreen;
        if (s.includes('HDPE') || s.includes('PE100')) return MaterialLibrary.hdpeBlack;
        if (s.includes('PVC')) return MaterialLibrary.pvcOrange;
        if (s.includes('CPVC')) return MaterialLibrary.cpvcBeige;
        if (s.includes('PVDF')) return MaterialLibrary.pvdfRed;
        if (s.includes('PTFE')) return MaterialLibrary.ptfeWhite;
        if (s.includes('FRP')) return MaterialLibrary.frpViolet;
        if (s.includes('HORMIGON') || s.includes('CONCRETO') || s.includes('CEMENTO')) return MaterialLibrary.concrete;
        if (s.includes('ALUMINIO') || s.includes('ALUMINUM')) return MaterialLibrary.aluminum;
        if (s.includes('MADERA') || s.includes('WOOD')) return MaterialLibrary.wood;
        if (s.includes('CRYO')) return MaterialLibrary.carbonSteelDark;
        if (s.includes('A1A') || s.includes('ACERO') || s.includes('CS_') || s.includes('SCH80') || s.includes('SCH40')) return MaterialLibrary.carbonSteel;
        if (s.includes('A3B') || s.includes('300') || s.includes('600') || s.includes('900')) return MaterialLibrary.forgedSteel;
        return MaterialLibrary.carbonSteel;
    }
    
    function isPlasticSpec(spec) {
        var s = (spec || '').toUpperCase();
        return s.includes('PPR') || s.includes('HDPE') || s.includes('PE100') || s.includes('PVC') || s.includes('CPVC') || s.includes('PVDF') || s.includes('PTFE') || s.includes('FRP');
    }
    
    function getPipeColor(spec) { var mat = getSpecMaterial(spec); return mat.color.getHex(); }
    
    function getEquipmentColor(tipo) {
        var t = (tipo || '').toLowerCase();
        if (t === 'tanque_v' || t === 'tanque_acero') return 0x3b82f6;
        if (t === 'tanque_h') return 0x2563eb;
        if (t === 'torre') return 0x6366f1;
        if (t === 'reactor') return 0x8b5cf6;
        if (t.includes('bomba')) return 0xf39c12;
        if (t === 'compresor') return 0xef4444;
        if (t === 'intercambiador' || t === 'caldera' || t === 'pasteurizador') return 0x06b6d4;
        if (t === 'separador') return 0x14b8a6;
        if (t === 'clarificador' || t === 'filtro_arena') return 0x0ea5e9;
        if (t === 'osmosis') return 0x06b6d4;
        if (t === 'homogeneizador') return 0xa855f7;
        if (t === 'plataforma') return 0x6b7280;
        if (t.includes('TEE')) return 0xd35400;
        return 0x475569;
    }
    
    const matSupport = MaterialLibrary.carbonSteelDark;
    const matStem = MaterialLibrary.stemChrome;
    const matWheel = MaterialLibrary.handwheelBlack;
    const matBlack = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.3, roughness: 0.6 });
    const matGlass = MaterialLibrary.glassSight;
    const matRed = MaterialLibrary.redHandle;
    const matGreen = MaterialLibrary.greenGasket;
    const matBrass = MaterialLibrary.brassFitting;
    
    function createMaterial(color, metalness, roughness) {
        return new THREE.MeshStandardMaterial({ color: color, metalness: metalness || 0.3, roughness: roughness || 0.5 });
    }
    
    function orientComponent(group, dirVec) {
        if (!dirVec || dirVec.lengthSq() < 0.001) return;
        var targetMatrix = new THREE.Matrix4();
        var upVec = Math.abs(dirVec.y) > 0.99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
        targetMatrix.lookAt(new THREE.Vector3(0, 0, 0), dirVec.clone().normalize(), upVec);
        group.quaternion.setFromRotationMatrix(targetMatrix);
        group.rotateY(Math.PI / 2);
    }
    
    function setupEffects(scene, camera, renderer) {
        if (!scene || !camera || !renderer) return;
        try {
            _composer = new EffectComposer(renderer);
            _composer.addPass(new RenderPass(scene, camera));
            _outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
            _outlinePass.edgeStrength = 3; _outlinePass.edgeGlow = 0.6; _outlinePass.edgeThickness = 1.5;
            _outlinePass.pulsePeriod = 2;
            _outlinePass.visibleEdgeColor.setHex(0x00f2ff); _outlinePass.hiddenEdgeColor.setHex(0x1e293b);
            _composer.addPass(_outlinePass);
        } catch (e) {
            console.warn('SmartFlowRender: Efectos de postprocesado no disponibles', e);
            _composer = null; _outlinePass = null;
        }
    }
    
    function deepDisposeGroup(group) {
        if (!group) return;
        group.traverse(function(node) {
            if (!node) return;
            if (node.geometry) { try { node.geometry.dispose(); } catch(e) {} node.geometry = null; }
            if (node.material) {
                try {
                    if (Array.isArray(node.material)) {
                        node.material.forEach(function(m) { if (m.map) { m.map.dispose(); m.map = null; } m.dispose(); });
                    } else {
                        if (node.material.map) { node.material.map.dispose(); node.material.map = null; }
                        node.material.dispose();
                    }
                } catch(e) {}
                node.material = null;
            }
        });
        while (group.children.length > 0) { var child = group.children[group.children.length - 1]; group.remove(child); }
    }
    
    function createNozzle(radius, length, flangeRadius, flangeThickness, material) {
        var group = new THREE.Group();
        var neck = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), material);
        neck.position.y = length / 2; group.add(neck);
        var flange = new THREE.Mesh(new THREE.CylinderGeometry(flangeRadius, flangeRadius, flangeThickness, 24), MaterialLibrary.forgedSteel);
        flange.position.y = length; group.add(flange);
        var rf = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.15, radius * 1.15, flangeThickness * 0.1, 24), MaterialLibrary.stemChrome);
        rf.position.y = length + flangeThickness * 0.55; group.add(rf);
        for (var h = 0; h < Math.PI * 2; h += Math.PI / 4) {
            var hole = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.08, radius * 0.08, flangeThickness * 1.1, 8), matBlack.clone());
            hole.position.set(Math.cos(h) * flangeRadius * 0.7, length, Math.sin(h) * flangeRadius * 0.7);
            group.add(hole);
        }
        return group;
    }
    
    function createPlasticStubEnd(radius, length, material) {
        var group = new THREE.Group();
        var neck = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), material);
        neck.position.y = length / 2; group.add(neck);
        var stubFlare = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.5, radius, radius * 0.3, 16), material);
        stubFlare.position.y = length; group.add(stubFlare);
        var looseFlange = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.7, radius * 0.25, 12, 24), MaterialLibrary.forgedSteel);
        looseFlange.position.y = length - radius * 0.1; looseFlange.rotation.x = Math.PI / 2;
        group.add(looseFlange);
        var gasket = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.3, radius * 0.06, 8, 16), matGreen.clone());
        gasket.position.y = length + radius * 0.15; gasket.rotation.x = Math.PI / 2;
        group.add(gasket);
        return group;
    }
    
    function createSocketEnd(radius, length, material) {
        var group = new THREE.Group();
        var socketR = radius * 1.25;
        var socketLen = radius * 1.2;
        var body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 16), material);
        body.position.x = length / 2; group.add(body);
        var socket = new THREE.Mesh(new THREE.CylinderGeometry(socketR, socketR, socketLen, 16), MaterialLibrary.clone(material));
        socket.rotation.z = Math.PI / 2; socket.position.x = length + socketLen / 2;
        group.add(socket);
        return group;
    }
    // ═══════════════════════════════════════════
    // TANQUE VERTICAL METÁLICO
    // ═══════════════════════════════════════════
    function createTankVerticalMetalico(eq, specMat) {
        var mat = MaterialLibrary.clone(specMat);
        var r = toM((eq.diametro || 3000) / 2);
        var h = toM(eq.altura || 6000);
        var group = new THREE.Group();
        
        var segments = Math.floor(h / 1.5);
        var segHeight = h / segments;
        for (var s = 0; s < segments; s++) {
            var seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r, segHeight, 48), mat);
            seg.position.y = s * segHeight + segHeight / 2;
            seg.castShadow = true; seg.receiveShadow = true;
            group.add(seg);
        }
        
        for (var w = 1; w < segments; w++) {
            var weld = new THREE.Mesh(
                new THREE.TorusGeometry(r + 0.01, 0.015, 8, 48),
                new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.6, roughness: 0.4 })
            );
            weld.rotation.x = Math.PI / 2; weld.position.y = w * segHeight;
            group.add(weld);
        }
        
        var bottomCone = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, r, r * 0.3, 32), mat
        );
        bottomCone.position.y = r * 0.15; bottomCone.castShadow = true;
        group.add(bottomCone);
        
        var skirt = new THREE.Mesh(
            new THREE.CylinderGeometry(r + 0.08, r + 0.08, r * 0.5, 32), MaterialLibrary.carbonSteelDark
        );
        skirt.position.y = -r * 0.15; skirt.castShadow = true;
        group.add(skirt);
        
        var dome = new THREE.Mesh(
            new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2.5), mat
        );
        dome.position.y = h; dome.rotation.x = -Math.PI / 2; dome.castShadow = true;
        group.add(dome);
        
        var ventGeo = new THREE.CylinderGeometry(r * 0.04, r * 0.04, r * 0.15, 8);
        var vent = new THREE.Mesh(ventGeo, MaterialLibrary.forgedSteel);
        vent.position.y = h + r * 0.2; group.add(vent);
        var ventCap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.06, r * 0.06, r * 0.03, 8), MaterialLibrary.carbonSteelDark);
        ventCap.position.y = h + r * 0.28; group.add(ventCap);
        
        var ringCount = Math.floor(h / 2);
        for (var ri = 1; ri <= ringCount; ri++) {
            var ring = new THREE.Mesh(
                new THREE.TorusGeometry(r + 0.04, 0.04, 12, 48), MaterialLibrary.forgedSteel
            );
            ring.rotation.x = Math.PI / 2; ring.position.y = ri * (h / (ringCount + 1));
            ring.castShadow = true; group.add(ring);
        }
        
        if (eq.puertos) {
            eq.puertos.forEach(function(p) {
                var nozzleR = diamToRadiusM(p.diametro || 3);
                var nozzleL = nozzleR * 3;
                var flangeR = nozzleR * 1.8;
                var nozzle = createNozzle(nozzleR, nozzleL, flangeR, nozzleR * 0.3, mat);
                var posY = toM(p.relY || 0);
                nozzle.position.set(0, posY + h/2, 0);
                if (Math.abs(p.relX || 0) > 0) {
                    nozzle.position.set(p.relX > 0 ? r : -r, posY + h/2, 0);
                    nozzle.rotation.z = p.relX > 0 ? -Math.PI/2 : Math.PI/2;
                }
                group.add(nozzle);
            });
        }
        
        var manhole = new THREE.Mesh(
            new THREE.CylinderGeometry(r * 0.12, r * 0.12, r * 0.25, 24), MaterialLibrary.forgedSteel
        );
        manhole.rotation.z = Math.PI / 2; manhole.position.set(r, h * 0.3, 0);
        group.add(manhole);
        
        var ladderRailGeo = new THREE.CylinderGeometry(0.03, 0.03, h * 0.9, 8);
        var ladderRungGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 8);
        for (var lr = 0; lr < 2; lr++) {
            var rail = new THREE.Mesh(ladderRailGeo, MaterialLibrary.carbonSteelDark);
            rail.position.set(r + 0.3 + lr * 0.35, h * 0.45, 0); rail.castShadow = true;
            group.add(rail);
        }
        for (var ru = 0; ru < 20; ru++) {
            var rung = new THREE.Mesh(ladderRungGeo, MaterialLibrary.carbonSteelDark);
            rung.rotation.z = Math.PI / 2;
            rung.position.set(r + 0.475, ru * (h * 0.045) + 0.3, 0);
            group.add(rung);
        }
        
        var nameplate = new THREE.Mesh(
            new THREE.BoxGeometry(r * 0.3, r * 0.2, 0.003),
            new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 })
        );
        nameplate.position.set(0, h * 0.5, r + 0.01); group.add(nameplate);
        
        var groundWire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.01, 0.01, r * 0.6, 6), MaterialLibrary.stemChrome
        );
        groundWire.position.set(-r + 0.1, 0.1, r - 0.1);
        group.add(groundWire);
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    // ═══════════════════════════════════════════
    // TANQUE VERTICAL PLÁSTICO (PE/HDPE/PPR/FRP)
    // ═══════════════════════════════════════════
    function createTankVerticalPlastico(eq, specMat) {
        var mat = MaterialLibrary.clone(specMat);
        if (mat.metalness < 0.05 && mat.color.getHex() !== 0x8b5cf6) {
            mat.transparent = true; mat.opacity = 0.88;
        }
        var r = toM((eq.diametro || 3000) / 2);
        var h = toM(eq.altura || 6000);
        var group = new THREE.Group();
        
        var body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 48), mat);
        body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true;
        group.add(body);
        
        var nervCount = Math.floor(h / 0.6);
        for (var nv = 1; nv <= nervCount; nv++) {
            var nervY = nv * (h / (nervCount + 1));
            var nerv = new THREE.Mesh(
                new THREE.TorusGeometry(r + 0.06, 0.03, 8, 48),
                MaterialLibrary.clone(specMat)
            );
            nerv.rotation.x = Math.PI / 2; nerv.position.y = nervY;
            group.add(nerv);
        }
        
        var bottom = new THREE.Mesh(
            new THREE.CylinderGeometry(r, r, h * 0.03, 32), MaterialLibrary.clone(specMat)
        );
        bottom.position.y = h * 0.015; bottom.castShadow = true;
        group.add(bottom);
        
        var dome = new THREE.Mesh(
            new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 4), mat
        );
        dome.position.y = h; dome.rotation.x = -Math.PI / 2;
        group.add(dome);
        
        if (eq.puertos) {
            eq.puertos.forEach(function(p) {
                var nozzleR = diamToRadiusM(p.diametro || 3);
                var nozzleL = nozzleR * 2.5;
                var stub = createPlasticStubEnd(nozzleR, nozzleL, mat);
                var posY = toM(p.relY || 0);
                stub.position.set(0, posY + h/2, 0);
                if (Math.abs(p.relX || 0) > 0) {
                    stub.position.set(p.relX > 0 ? r : -r, posY + h/2, 0);
                    stub.rotation.z = p.relX > 0 ? -Math.PI/2 : Math.PI/2;
                }
                group.add(stub);
            });
        }
        
        var manholeR = r * 0.08;
        var manhole = new THREE.Mesh(
            new THREE.CylinderGeometry(manholeR, manholeR, r * 0.2, 16), MaterialLibrary.clone(specMat)
        );
        manhole.rotation.z = Math.PI / 2; manhole.position.set(r, h * 0.6, 0);
        group.add(manhole);
        var manholeCap = new THREE.Mesh(
            new THREE.CylinderGeometry(manholeR * 1.1, manholeR * 1.1, r * 0.03, 16), MaterialLibrary.clone(specMat)
        );
        manholeCap.rotation.z = Math.PI / 2; manholeCap.position.set(r + r * 0.11, h * 0.6, 0);
        group.add(manholeCap);
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    function createTankVertical(eq) {
        var specMat = getSpecMaterial(eq.spec || 'ACERO_150_RF');
        if (isPlasticSpec(eq.spec || eq.material || '')) {
            return createTankVerticalPlastico(eq, specMat);
        }
        return createTankVerticalMetalico(eq, specMat);
    }
    
    // ═══════════════════════════════════════════
    // TANQUE HORIZONTAL MEJORADO
    // ═══════════════════════════════════════════
    function createTankHorizontal(eq) {
        var specMat = getSpecMaterial(eq.spec || 'ACERO_150_RF');
        var mat = MaterialLibrary.clone(specMat);
        var r = toM((eq.diametro || 3000) / 2);
        var l = toM(eq.largo || 6000);
        var group = new THREE.Group();
        
        var body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 48), mat);
        body.rotation.z = Math.PI / 2; body.position.set(l / 2, r, 0);
        body.castShadow = true; body.receiveShadow = true; group.add(body);
        
        var capGeo = new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2.5);
        var cap1 = new THREE.Mesh(capGeo, mat);
        cap1.position.set(0, r, 0); cap1.rotation.z = -Math.PI / 2; group.add(cap1);
        var cap2 = new THREE.Mesh(capGeo, mat);
        cap2.position.set(l, r, 0); cap2.rotation.z = Math.PI / 2; group.add(cap2);
        
        var headWeldGeo = new THREE.TorusGeometry(r, 0.02, 8, 48);
        [0, l].forEach(function(x) {
            var hw = new THREE.Mesh(headWeldGeo, new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.6, roughness: 0.4 }));
            hw.position.set(x, r, 0); hw.rotation.y = Math.PI / 2; group.add(hw);
        });
        
        var manholeR = r * 0.1;
        var manhole = new THREE.Mesh(new THREE.CylinderGeometry(manholeR, manholeR, r * 0.2, 16), MaterialLibrary.forgedSteel);
        manhole.position.set(l / 2, r * 2, 0); group.add(manhole);
        var manholeFlange = new THREE.Mesh(new THREE.CylinderGeometry(manholeR * 1.3, manholeR * 1.3, r * 0.03, 16), MaterialLibrary.forgedSteel);
        manholeFlange.position.set(l / 2, r * 2.1, 0); group.add(manholeFlange);
        
        var drainR = r * 0.04;
        var drain = new THREE.Mesh(new THREE.CylinderGeometry(drainR, drainR, r * 0.3, 8), MaterialLibrary.forgedSteel);
        drain.position.set(l / 2, -r * 1.3, 0); group.add(drain);
        
        for (var si = 0; si < 2; si++) {
            var saddleX = l * 0.2 + si * l * 0.6;
            var saddleBase = new THREE.Mesh(
                new THREE.BoxGeometry(r * 0.3, r * 1.3, r * 0.4), MaterialLibrary.concreteDark
            );
            saddleBase.position.set(saddleX, -r * 0.45, 0); saddleBase.castShadow = true; group.add(saddleBase);
            var saddlePlate = new THREE.Mesh(
                new THREE.BoxGeometry(r * 0.35, 0.03, r * 0.45), MaterialLibrary.carbonSteelDark
            );
            saddlePlate.position.set(saddleX, 0.2, 0); group.add(saddlePlate);
        }
        
        for (var li = 0; li < 2; li++) {
            var lugX = l * 0.25 + li * l * 0.5;
            var lug = new THREE.Mesh(
                new THREE.TorusGeometry(r * 0.08, r * 0.04, 6, 8), MaterialLibrary.carbonSteelDark
            );
            lug.position.set(lugX, r * 2.1, 0); lug.rotation.z = Math.PI / 2; group.add(lug);
        }
        
        if (eq.puertos) {
            eq.puertos.forEach(function(p) {
                var nozzleR = diamToRadiusM(p.diametro || 3);
                var nozzleL = nozzleR * 2.5;
                var flangeR = nozzleR * 1.8;
                var nozzle = createNozzle(nozzleR, nozzleL, flangeR, nozzleR * 0.3, mat);
                var posX = l/2 + toM(p.relX || 0);
                var posY = r + toM(p.relY || 0);
                nozzle.position.set(posX, posY, 0);
                if (Math.abs(p.relY || 0) > Math.abs(p.relX || 0)) { nozzle.rotation.z = Math.PI; }
                group.add(nozzle);
            });
        }
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    // ═══════════════════════════════════════════
    // BOMBA CENTRÍFUGA MEJORADA
    // ═══════════════════════════════════════════
    function createBomba(eq) {
        var specMat = getSpecMaterial(eq.spec || 'ACERO_150_RF');
        var mat = MaterialLibrary.clone(specMat);
        var s = toM(eq.diametro || 800);
        var group = new THREE.Group();
        
        var basePlate = new THREE.Mesh(
            new THREE.BoxGeometry(s * 1.8, s * 0.08, s * 0.9), MaterialLibrary.carbonSteelDark
        );
        basePlate.castShadow = true; basePlate.receiveShadow = true; group.add(basePlate);
        
        var boltGeo = new THREE.CylinderGeometry(s * 0.02, s * 0.02, s * 0.05, 8);
        [[-s*0.7, -s*0.3], [s*0.7, -s*0.3], [s*0.7, s*0.3], [-s*0.7, s*0.3]].forEach(function(pos) {
            var bolt = new THREE.Mesh(boltGeo, MaterialLibrary.stemChrome);
            bolt.position.set(pos[0], -s * 0.02, pos[1]); group.add(bolt);
        });
        
        var casingFeet = [
            [-s * 0.25, -s * 0.2], [s * 0.05, -s * 0.2], [-s * 0.25, s * 0.2], [s * 0.05, s * 0.2]
        ];
        casingFeet.forEach(function(pos) {
            var foot = new THREE.Mesh(
                new THREE.BoxGeometry(s * 0.12, s * 0.1, s * 0.12), MaterialLibrary.carbonSteelDark
            );
            foot.position.set(pos[0], s * 0.05, pos[1]); group.add(foot);
        });
        
        var casing = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.4, s * 0.6, 24), MaterialLibrary.epoxyPaint);
        casing.position.set(-s * 0.1, s * 0.35, 0); casing.castShadow = true; group.add(casing);
        
        var impeller = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.15, s * 0.08, 16), MaterialLibrary.stemChrome);
        impeller.position.set(-s * 0.1, s * 0.4, s * 0.22); group.add(impeller);
        
        var succFlange = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.25, s * 0.25, s * 0.08, 24), MaterialLibrary.forgedSteel
        );
        succFlange.rotation.z = Math.PI / 2; succFlange.position.set(-s * 0.45, s * 0.35, 0); group.add(succFlange);
        
        var discFlange = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.2, s * 0.2, s * 0.06, 24), MaterialLibrary.forgedSteel
        );
        discFlange.position.set(-s * 0.1, s * 0.7, 0); group.add(discFlange);
        
        var drainPlug = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.03, s * 0.03, s * 0.08, 8), MaterialLibrary.brassFitting
        );
        drainPlug.position.set(-s * 0.1, s * 0.05, s * 0.3); group.add(drainPlug);
        
        var motorBody = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.28, s * 0.28, s * 0.55, 24), MaterialLibrary.motorGray
        );
        motorBody.position.set(s * 0.4, s * 0.42, 0); motorBody.castShadow = true; group.add(motorBody);
        
        for (var af = 0; af < 6; af++) {
            var fin = new THREE.Mesh(
                new THREE.TorusGeometry(s * 0.3, s * 0.015, 8, 24), MaterialLibrary.motorDark
            );
            fin.position.set(s * 0.4, s * 0.15 + af * s * 0.08, 0); fin.rotation.x = Math.PI / 2; group.add(fin);
        }
        
        var junctionBox = new THREE.Mesh(
            new THREE.BoxGeometry(s * 0.2, s * 0.15, s * 0.15), MaterialLibrary.motorDark
        );
        junctionBox.position.set(s * 0.4, s * 0.72, s * 0.2); group.add(junctionBox);
        
        var shaft = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.35, 16), MaterialLibrary.stemChrome
        );
        shaft.rotation.z = Math.PI / 2; shaft.position.set(s * 0.1, s * 0.4, 0); group.add(shaft);
        
        var coupling = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.08, s * 0.08, s * 0.1, 16), MaterialLibrary.carbonSteelDark
        );
        coupling.rotation.z = Math.PI / 2; coupling.position.set(s * 0.25, s * 0.4, 0); group.add(coupling);
        
        var guard = new THREE.Mesh(
            new THREE.CylinderGeometry(s * 0.11, s * 0.11, s * 0.18, 16, 1, true),
            MaterialLibrary.safetyYellow.clone()
        );
        guard.material.side = THREE.DoubleSide;
        guard.rotation.z = Math.PI / 2; guard.position.set(s * 0.25, s * 0.4, 0); group.add(guard);
        
        var nameplate = new THREE.Mesh(
            new THREE.BoxGeometry(s * 0.2, s * 0.12, 0.002),
            new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 })
        );
        nameplate.position.set(s * 0.4, s * 0.3, s * 0.16); group.add(nameplate);
        
        for (var li = 0; li < 2; li++) {
            var lugX = s * 0.7 + li * s * 0.6;
            var liftLug = new THREE.Mesh(
                new THREE.TorusGeometry(s * 0.05, s * 0.025, 6, 8), MaterialLibrary.carbonSteelDark
            );
            liftLug.position.set(lugX, s * 0.65, 0); liftLug.rotation.z = Math.PI / 2; group.add(liftLug);
        }
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    // ═══════════════════════════════════════════
    // COMPRESOR MEJORADO
    // ═══════════════════════════════════════════
    function createCompresor(eq) {
        var specMat = getSpecMaterial(eq.spec || 'ACERO_150_RF');
        var mat = MaterialLibrary.clone(specMat);
        var s = toM(eq.diametro || 1000);
        var group = new THREE.Group();
        
        var base = new THREE.Mesh(new THREE.BoxGeometry(s * 1.5, s * 0.08, s * 0.8), MaterialLibrary.carbonSteelDark);
        base.castShadow = true; base.receiveShadow = true; group.add(base);
        
        var body = new THREE.Mesh(new THREE.BoxGeometry(s * 1.2, s * 0.7, s * 0.6), MaterialLibrary.epoxyPaint);
        body.position.y = s * 0.4; body.castShadow = true; group.add(body);
        
        for (var c = 0; c < 2; c++) {
            var head = new THREE.Mesh(new THREE.BoxGeometry(s * 0.15, s * 0.5, s * 0.5), MaterialLibrary.forgedSteel);
            head.position.set(-s * 0.5 + c * s, s * 0.35, 0); group.add(head);
        }
        
        var motor = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.25, s * 0.25, s * 0.6, 24), MaterialLibrary.motorGray);
        motor.position.set(s * 0.7, s * 0.45, 0); motor.castShadow = true; group.add(motor);
        
        var pulley = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.2, s * 0.08, 24), MaterialLibrary.carbonSteelDark);
        pulley.rotation.z = Math.PI / 2; pulley.position.set(s * 0.35, s * 0.45, 0); group.add(pulley);
        
        var belt = new THREE.Mesh(new THREE.TorusGeometry(s * 0.21, s * 0.015, 8, 24), matBlack.clone());
        belt.position.set(s * 0.35, s * 0.45, 0); belt.rotation.y = Math.PI / 2; group.add(belt);
        
        for (var pi = 0; pi < 2; pi++) {
            var pipeSeg = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.3, 12), MaterialLibrary.stemChrome);
            pipeSeg.position.set(-s * 0.3 + pi * s * 0.6, s * 0.6, 0); group.add(pipeSeg);
        }
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    // ═══════════════════════════════════════════
    // INTERCAMBIADOR DE CALOR MEJORADO
    // ═══════════════════════════════════════════
    function createExchanger(eq) {
        var specMat = getSpecMaterial(eq.spec || 'ACERO_150_RF');
        var mat = MaterialLibrary.clone(specMat);
        var l = toM(eq.largo || 4000);
        var r = toM((eq.diametro || 800) / 2);
        var group = new THREE.Group();
        
        var shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 32), mat);
        shell.rotation.z = Math.PI / 2; shell.position.set(l / 2, r * 1.5, 0);
        shell.castShadow = true; group.add(shell);
        
        for (var ti = 0; ti < 3; ti++) {
            var tubeX = l * 0.2 + ti * l * 0.3;
            var tube = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.12, r * 0.12, l * 0.8, 16), MaterialLibrary.stainless316);
            tube.rotation.z = Math.PI / 2; tube.position.set(l / 2, r * 1.5, -r * 0.3 + ti * r * 0.3);
            group.add(tube);
        }
        
        var headGeo = new THREE.SphereGeometry(r * 0.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        var head1 = new THREE.Mesh(headGeo, mat);
        head1.position.set(0, r * 1.5, 0); head1.rotation.z = -Math.PI / 2; group.add(head1);
        var head2 = new THREE.Mesh(headGeo, mat);
        head2.position.set(l, r * 1.5, 0); head2.rotation.z = Math.PI / 2; group.add(head2);
        
        [0, l].forEach(function(x) {
            var hf = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, r * 0.15, 32), MaterialLibrary.forgedSteel);
            hf.rotation.z = Math.PI / 2; hf.position.set(x, r * 1.5, 0); group.add(hf);
        });
        
        for (var si = 0; si < 2; si++) {
            var sx = l * 0.2 + si * l * 0.6;
            var support = new THREE.Mesh(new THREE.BoxGeometry(r * 0.2, r * 1.3, r * 0.5), MaterialLibrary.carbonSteelDark);
            support.position.set(sx, -r * 0.3, 0); support.castShadow = true; group.add(support);
        }
        
        for (var bi = 0; bi < 2; bi++) {
            var nozR = r * 0.25;
            var nozzle = createNozzle(nozR, nozR * 2, nozR * 1.8, nozR * 0.3, mat);
            nozzle.position.set(l * 0.3 + bi * l * 0.4, r * 2.5, 0); nozzle.rotation.z = Math.PI / 2;
            group.add(nozzle);
        }
        
        var nameplate = new THREE.Mesh(
            new THREE.BoxGeometry(r * 0.5, r * 0.3, 0.005),
            new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 })
        );
        nameplate.position.set(l / 2, r * 2.2, r * 0.9); group.add(nameplate);
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }


    // ═══════════════════════════════════════════
    // PLATAFORMA DE CONCRETO MEJORADA
    // ═══════════════════════════════════════════
    function createPlataformaConcreto(eq) {
        var w = toM(eq.largo || 6000);
        var d = toM(eq.ancho || 3000);
        var h = toM(eq.altura || 400);
        var group = new THREE.Group();
        
        var losa = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), MaterialLibrary.concrete);
        losa.position.y = h / 2;
        losa.castShadow = true; losa.receiveShadow = true;
        group.add(losa);
        
        // Juntas de dilatación (líneas grabadas en la superficie)
        for (var jx = -w/2 + 2; jx < w/2 - 1; jx += 2.5) {
            var jointX = new THREE.Mesh(
                new THREE.BoxGeometry(0.015, h * 0.08, d * 0.9), MaterialLibrary.concreteJoint
            );
            jointX.position.set(jx, h + 0.01, 0);
            group.add(jointX);
        }
        for (var jz = -d/2 + 2; jz < d/2 - 1; jz += 2.5) {
            var jointZ = new THREE.Mesh(
                new THREE.BoxGeometry(w * 0.9, h * 0.08, 0.015), MaterialLibrary.concreteJoint
            );
            jointZ.position.set(0, h + 0.01, jz);
            group.add(jointZ);
        }
        
        // Borde perimetral
        var bordeMat = MaterialLibrary.concreteDark;
        var bordeLargo1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, h * 0.15, 0.2), bordeMat);
        bordeLargo1.position.set(0, h + h * 0.075, -d/2 - 0.05);
        group.add(bordeLargo1);
        var bordeLargo2 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, h * 0.15, 0.2), bordeMat);
        bordeLargo2.position.set(0, h + h * 0.075, d/2 + 0.05);
        group.add(bordeLargo2);
        var bordeAncho1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, h * 0.15, d + 0.15), bordeMat);
        bordeAncho1.position.set(-w/2 - 0.05, h + h * 0.075, 0);
        group.add(bordeAncho1);
        var bordeAncho2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, h * 0.15, d + 0.15), bordeMat);
        bordeAncho2.position.set(w/2 + 0.05, h + h * 0.075, 0);
        group.add(bordeAncho2);
        
        // Canales de drenaje (ranuras en el borde)
        for (var di = 0; di < 2; di++) {
            var drainX = -w/4 + di * w/2;
            var drain = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, h * 0.06, 0.3), matBlack.clone()
            );
            drain.position.set(drainX, h + 0.02, -d/2 + 0.15);
            group.add(drain);
        }
        
        // Pilares con insertos metálicos
        var posiciones = [
            [-w/2 + 0.2, -d/2 + 0.2], [w/2 - 0.2, -d/2 + 0.2],
            [w/2 - 0.2, d/2 - 0.2], [-w/2 + 0.2, d/2 - 0.2]
        ];
        posiciones.forEach(function(pos) {
            var pilar = new THREE.Mesh(
                new THREE.BoxGeometry(0.25, h * 3, 0.25), MaterialLibrary.concreteDark
            );
            pilar.position.set(pos[0], -h * 1.2, pos[1]);
            pilar.castShadow = true; pilar.receiveShadow = true;
            group.add(pilar);
            
            // Inserto metálico (placa de anclaje)
            var inserto = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.04, 0.3), MaterialLibrary.carbonSteelDark
            );
            inserto.position.set(pos[0], h * 0.02, pos[1]);
            group.add(inserto);
            
            // Placa base
            var placa = new THREE.Mesh(
                new THREE.BoxGeometry(0.35, 0.03, 0.35), MaterialLibrary.carbonSteelDark
            );
            placa.position.set(pos[0], -h * 2.7, pos[1]);
            group.add(placa);
        });
        
        // Escalera de acceso
        var escW = 0.6;
        var escH = h * 3 + h;
        var escAngle = Math.atan2(escH, h * 2);
        var escLen = Math.sqrt(escH * escH + (h * 2) * (h * 2));
        var escRailGeo = new THREE.CylinderGeometry(0.02, 0.02, escLen, 8);
        for (var er = 0; er < 2; er++) {
            var escRail = new THREE.Mesh(escRailGeo, MaterialLibrary.carbonSteelDark);
            escRail.position.set(w/2 + 0.6 + er * escW, h - escH/2, -d/2 + 0.3);
            escRail.rotation.z = escAngle;
            group.add(escRail);
        }
        var numSteps = 10;
        for (var st = 0; st < numSteps; st++) {
            var stepGeo = new THREE.BoxGeometry(escW, 0.03, 0.15);
            var step = new THREE.Mesh(stepGeo, MaterialLibrary.gratingMetal);
            var t = st / (numSteps - 1);
            step.position.set(w/2 + 0.6 + escW/2, h - t * escH, -d/2 + 0.3 + t * h * 2);
            step.rotation.z = escAngle;
            group.add(step);
        }
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    // ═══════════════════════════════════════════
    // PLATAFORMA METÁLICA MEJORADA
    // ═══════════════════════════════════════════
    function createPlataformaMetalica(eq) {
        var w = toM(eq.largo || 6000);
        var d = toM(eq.ancho || 3000);
        var h = toM(eq.altura || 400);
        var group = new THREE.Group();
        
        // Parrilla metálica (grating)
        for (var gx = -w/2 + 0.15; gx <= w/2 - 0.15; gx += 0.22) {
            var bar = new THREE.Mesh(
                new THREE.BoxGeometry(0.012, h * 0.12, d * 0.96), MaterialLibrary.gratingMetal
            );
            bar.position.set(gx, h, 0);
            group.add(bar);
        }
        
        // Rodapié perimetral
        var toeMat = MaterialLibrary.carbonSteelDark;
        [-1, 1].forEach(function(side) {
            var toeZ = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.04), toeMat);
            toeZ.position.set(0, h + 0.05, side * (d/2 - 0.02));
            group.add(toeZ);
            var toeX = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, d), toeMat);
            toeX.position.set(side * (w/2 - 0.02), h + 0.05, 0);
            group.add(toeX);
        });
        
        // Vigas principales
        var vigaMat = MaterialLibrary.carbonSteelDark;
        [-1, 1].forEach(function(side) {
            var viga = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.4, 0.08), vigaMat);
            viga.position.set(0, h * 0.2, side * (d/2 - 0.06));
            viga.castShadow = true;
            group.add(viga);
        });
        
        // Columnas con placas
        var posCols = [
            [-w/2 + 0.2, -d/2 + 0.2], [w/2 - 0.2, -d/2 + 0.2],
            [w/2 - 0.2, d/2 - 0.2], [-w/2 + 0.2, d/2 - 0.2]
        ];
        posCols.forEach(function(pos) {
            var col = new THREE.Mesh(new THREE.BoxGeometry(0.12, h * 3, 0.12), vigaMat);
            col.position.set(pos[0], -h * 1.2, pos[1]);
            col.castShadow = true;
            group.add(col);
            
            var placaTop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.2), vigaMat);
            placaTop.position.set(pos[0], h * 0.01, pos[1]);
            group.add(placaTop);
            
            var placaBase = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.22), vigaMat);
            placaBase.position.set(pos[0], -h * 2.71, pos[1]);
            group.add(placaBase);
        });
        
        // Arriostramientos diagonales
        var braceGeoZ = new THREE.BoxGeometry(0.05, h * 2.2, 0.05);
        [-1, 1].forEach(function(side) {
            var brace = new THREE.Mesh(braceGeoZ, vigaMat);
            brace.position.set(0, -h * 0.8, side * (d/2 - 0.15));
            brace.rotation.z = Math.PI / 6;
            group.add(brace);
        });
        
        // Conexión a tierra
        var groundWire = new THREE.Mesh(
            new THREE.CylinderGeometry(0.01, 0.01, h * 0.5, 6), MaterialLibrary.stemChrome
        );
        groundWire.position.set(w/2 - 0.1, -h * 1.5, d/2 - 0.1);
        group.add(groundWire);
        
        // Barandas con pasamanos y postes
        if (eq.baranda !== false) {
            var barandaH = 1.1;
            var barandaMat = MaterialLibrary.safetyYellow;
            [-1, 1].forEach(function(side) {
                var pasZ = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, w, 8), barandaMat);
                pasZ.rotation.z = Math.PI / 2;
                pasZ.position.set(0, h + barandaH, side * (d/2 - 0.05));
                group.add(pasZ);
                var pasX = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, d, 8), barandaMat);
                pasX.rotation.x = Math.PI / 2;
                pasX.position.set(side * (w/2 - 0.05), h + barandaH, 0);
                group.add(pasX);
            });
            
            var posteGeo = new THREE.CylinderGeometry(0.015, 0.015, barandaH, 8);
            for (var px = -w/2 + 0.3; px <= w/2 - 0.3; px += 1.5) {
                [-1, 1].forEach(function(side) {
                    var poste = new THREE.Mesh(posteGeo, barandaMat);
                    poste.position.set(px, h + barandaH/2, side * (d/2 - 0.05));
                    group.add(poste);
                });
            }
            for (var pz = -d/2 + 0.3; pz <= d/2 - 0.3; pz += 1.5) {
                [-1, 1].forEach(function(side) {
                    var poste = new THREE.Mesh(posteGeo, barandaMat);
                    poste.position.set(side * (w/2 - 0.05), h + barandaH/2, pz);
                    group.add(poste);
                });
            }
        }
        
        // Escalera de acceso metálica
        var escW = 0.55;
        var escH = h * 3;
        var escAngle = Math.atan2(escH, h * 2.5);
        var escLen = Math.sqrt(escH * escH + (h * 2.5) * (h * 2.5));
        var escRailGeo = new THREE.CylinderGeometry(0.015, 0.015, escLen, 8);
        for (var er = 0; er < 2; er++) {
            var escRail = new THREE.Mesh(escRailGeo, MaterialLibrary.carbonSteelDark);
            escRail.position.set(w/2 + 0.5 + er * escW, h - escH/2, -d/2 + 0.3);
            escRail.rotation.z = escAngle;
            group.add(escRail);
        }
        var numSteps = 8;
        for (var st = 0; st < numSteps; st++) {
            var step = new THREE.Mesh(
                new THREE.BoxGeometry(escW, 0.03, 0.12), MaterialLibrary.gratingMetal
            );
            var t = st / (numSteps - 1);
            step.position.set(w/2 + 0.5 + escW/2, h - t * escH, -d/2 + 0.3 + t * h * 2.5);
            step.rotation.z = escAngle;
            group.add(step);
        }
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    function createPlataforma(eq) {
        var material = (eq.material || '').toUpperCase();
        var esConcreto = material.includes('CONCRETO') || material.includes('CEMENTO') || material.includes('HORMIGON');
        if (esConcreto) return createPlataformaConcreto(eq);
        return createPlataformaMetalica(eq);
    }
    
    // ═══════════════════════════════════════════
    // BOX EQUIP (genérico para osmosis, etc.)
    // ═══════════════════════════════════════════
    function createBoxEquip(eq) {
        var specMat = getSpecMaterial(eq.spec || 'ACERO_150_RF');
        var mat = MaterialLibrary.clone(specMat);
        var xl = toM(eq.largo || eq.diametro || 800);
        var yh = toM(eq.altura || 800);
        var zw = toM(eq.ancho || eq.diametro || 800);
        var group = new THREE.Group();
        
        var body = new THREE.Mesh(new THREE.BoxGeometry(xl, yh, zw, 2, 2, 2), mat);
        body.position.y = yh / 2;
        body.castShadow = true; body.receiveShadow = true;
        group.add(body);
        
        var edgeGeo = new THREE.BoxGeometry(xl + 0.03, 0.04, zw + 0.03);
        var edgeMat = MaterialLibrary.forgedSteel;
        var topEdge = new THREE.Mesh(edgeGeo, edgeMat);
        topEdge.position.y = yh; group.add(topEdge);
        var bottomEdge = new THREE.Mesh(edgeGeo, edgeMat);
        bottomEdge.position.y = 0; group.add(bottomEdge);
        
        if (eq.puertos) {
            eq.puertos.forEach(function(p) {
                var nozzleR = diamToRadiusM(p.diametro || 3);
                var nozzleL = nozzleR * 2;
                var nozzle = createNozzle(nozzleR, nozzleL, nozzleR * 1.8, nozzleR * 0.3, mat);
                nozzle.position.set(toM(p.relX || 0), yh/2 + toM(p.relY || 0), toM(p.relZ || 0));
                group.add(nozzle);
            });
        }
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    function createEquipmentMesh(eq) {
        if (!eq || !eq.tipo) return null;
        var tipo = (eq.tipo || '').toLowerCase();
        if (tipo === 'tanque_v' || tipo === 'tanque_acero' || tipo === 'torre' || tipo === 'reactor' ||
            tipo === 'desgasificador' || tipo === 'desmineralizador' || tipo === 'suavizador' ||
            tipo === 'filtro_carbon' || tipo === 'filtro_arena' || tipo === 'clarificador' ||
            tipo === 'columna_fraccionadora' || tipo === 'evaporador' || tipo === 'cristalizador' ||
            tipo === 'absorbedor' || tipo === 'stripper' || tipo === 'reactor_encamisado' ||
            tipo === 'autoclave' || tipo === 'agitador' || tipo === 'centrifuga_discos' || tipo === 'tanque_aseptico' ||
            tipo === 'espesador') {
            return createTankVertical(eq);
        }
        if (tipo === 'tanque_h' || tipo === 'separador' || tipo === 'separador_trifasico' ||
            tipo === 'slug_catcher' || tipo === 'calentador_fuego_directo' || tipo === 'secador_rotativo' ||
            tipo === 'centrifuga' || tipo === 'filtro_tambor' || tipo === 'molino' || tipo === 'antorcha') {
            return createTankHorizontal(eq);
        }
        if (tipo.includes('bomba') || tipo === 'bomba_sumergible' || tipo === 'bomba_dosificacion') return createBomba(eq);
        if (tipo === 'compresor') return createCompresor(eq);
        if (tipo === 'intercambiador' || tipo === 'caldera' || tipo === 'pasteurizador' ||
            tipo === 'condensador' || tipo === 'esterilizador_uht') return createExchanger(eq);
        if (tipo === 'plataforma') return createPlataforma(eq);
        return createBoxEquip(eq);
    }
    
    // ═══════════════════════════════════════════
    // TUBERÍAS CON MATERIAL PBR
    // ═══════════════════════════════════════════
    function createPipeMesh(line) {
        var pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
        if (pts.length < 2) return null;
        var specMat = getSpecMaterial(line.spec || line.material || 'PPR_PN12_5');
        var pipeMat = MaterialLibrary.clone(specMat);
        pipeMat.roughness = 0.55;
        pipeMat.metalness = specMat.metalness > 0.1 ? 0.05 : specMat.metalness;
        var radius = diamToRadiusM(line.diameter || 4);
        var isPPR = (line.spec || line.material || '').toUpperCase().includes('PPR');
        var isCS = (line.spec || line.material || '').toUpperCase().includes('CS') || 
                   (line.spec || line.material || '').toUpperCase().includes('ACERO') ||
                   (line.spec || line.material || '').toUpperCase().includes('SCH');
        var vector3Points = pts.map(function(p) { return new THREE.Vector3(toM(p.x), toM(p.y), toM(p.z)); });
        var curve = new THREE.CatmullRomCurve3(vector3Points, false, 'catmullrom', 0);
        var segments = Math.min(Math.max(vector3Points.length * 4, 32), 256);
        var pipe = new THREE.Mesh(
            new THREE.TubeGeometry(curve, segments, radius, 16, false), pipeMat
        );
        pipe.castShadow = true; pipe.receiveShadow = true;
        pipe.userData = { tag: line.tag, tipo: 'linea' };
        if (_engine) _engine.registerVisualMesh(line.tag, pipe);
        
        if (isPPR) {
            var totalLength = curve.getLength();
            var spacing = 1.5;
            var numRings = Math.floor(totalLength / spacing);
            var ringMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, metalness: 0.1, roughness: 0.4, emissive: 0x022c1a, emissiveIntensity: 0.3 });
            for (var i = 1; i < numRings; i++) {
                var t = i * spacing / totalLength;
                var pt = curve.getPointAt(t);
                var tangent = curve.getTangentAt(t).normalize();
                var ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.2, radius * 0.18, 8, 16), ringMat);
                ring.position.copy(pt);
                var q = new THREE.Quaternion();
                q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
                ring.quaternion.copy(q);
                ring.userData = { isFusionRing: true };
                pipe.add(ring);
            }
        }
        
        if (isCS && segments > 4) {
            var weldMat = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, metalness: 0.6, roughness: 0.4 });
            var segLen = curve.getLength() / segments;
            for (var ws = 1; ws < segments; ws += Math.floor(segments / 8)) {
                var wt = ws / segments;
                var wpt = curve.getPointAt(wt);
                var wtan = curve.getTangentAt(wt).normalize();
                var weld = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.08, radius * 0.06, 6, 16), weldMat);
                weld.position.copy(wpt);
                var wq = new THREE.Quaternion();
                wq.setFromUnitVectors(new THREE.Vector3(0, 0, 1), wtan);
                weld.quaternion.copy(wq);
                pipe.add(weld);
            }
        }
        
        return pipe;
    }
    // ═══════════════════════════════════════════
    // FITTINGS UNIFICADOS (PPR / CS / PVC)
    // ═══════════════════════════════════════════
    function createFitting(comp, pos3D, dirVec, size, compType, spec) {
        var type = (compType || comp.type || '').toUpperCase();
        var s = size;
        var specMat = getSpecMaterial(spec);
        var mat = MaterialLibrary.clone(specMat);
        var matDark = MaterialLibrary.clone(specMat);
        matDark.metalness = Math.min(matDark.metalness + 0.15, 1.0);
        matDark.roughness = Math.max(matDark.roughness - 0.15, 0.1);
        var isPPR = spec.toUpperCase().includes('PPR');
        var isPVC = spec.toUpperCase().includes('PVC') || spec.toUpperCase().includes('CPVC');
        var isCS = !isPPR && !isPVC;
        var group = new THREE.Group();

        if (type.includes('ELBOW_90') || type.includes('CODO_90')) {
            var c90 = new THREE.EllipseCurve(0, 0, s * 1.5, s * 1.5, 0, Math.PI / 2, false, 0);
            var p90 = c90.getPoints(32);
            var elbow = new THREE.Mesh(
                new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p90.map(function(p) { return new THREE.Vector3(p.x, p.y, 0); })), 32, s * 0.4, 16, false), mat
            );
            group.add(elbow);
            if (isCS) {
                var reinf = new THREE.Mesh(new THREE.TorusGeometry(s * 0.44, s * 0.03, 8, 24), matDark);
                reinf.rotation.x = Math.PI / 2; reinf.position.set(s * 0.6, s * 0.6, 0);
                group.add(reinf);
            }
            if (isPPR) {
                var ringPPR = new THREE.Mesh(new THREE.TorusGeometry(s * 0.42, s * 0.025, 8, 16), MaterialLibrary.pprDark);
                ringPPR.rotation.x = Math.PI / 2; ringPPR.position.set(s * 0.55, s * 0.55, 0);
                group.add(ringPPR);
            }
            if (isPVC) {
                var socket1 = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.48, s * 0.48, s * 0.2, 16), MaterialLibrary.pvcSocket);
                socket1.rotation.z = Math.PI / 2; socket1.position.x = -s * 0.5; group.add(socket1);
                var socket2 = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.48, s * 0.48, s * 0.2, 16), MaterialLibrary.pvcSocket);
                socket2.position.y = s * 0.5; group.add(socket2);
            }
        }
        else if (type.includes('ELBOW_45') || type.includes('CODO_45')) {
            var c45 = new THREE.EllipseCurve(0, 0, s * 1.5, s * 1.5, 0, Math.PI / 4, false, 0);
            var p45 = c45.getPoints(20);
            group.add(new THREE.Mesh(
                new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p45.map(function(p) { return new THREE.Vector3(p.x, p.y, 0); })), 20, s * 0.4, 16, false), mat
            ));
        }
        else if (type.includes('TEE_EQUAL') || type.includes('TEE_RECTA')) {
            var main = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 2.5, 16), mat);
            main.rotation.z = Math.PI / 2; group.add(main);
            var branch = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 1.2, 16), mat);
            branch.position.y = s * 0.7; group.add(branch);
            if (isCS) {
                var collar = new THREE.Mesh(new THREE.TorusGeometry(s * 0.45, s * 0.06, 12, 24), matDark);
                collar.position.y = s * 0.1; collar.rotation.x = Math.PI / 2; group.add(collar);
                var reinfTee = new THREE.Mesh(new THREE.TorusGeometry(s * 0.42, s * 0.04, 8, 16), matDark);
                reinfTee.position.y = s * 0.55; reinfTee.rotation.x = Math.PI / 2; group.add(reinfTee);
            }
            if (isPPR) {
                var ringTee = new THREE.Mesh(new THREE.TorusGeometry(s * 0.42, s * 0.03, 8, 16), MaterialLibrary.pprDark);
                ringTee.position.y = s * 0.15; ringTee.rotation.x = Math.PI / 2; group.add(ringTee);
            }
            if (isPVC) {
                var sockTee = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.48, s * 0.48, s * 0.2, 16), MaterialLibrary.pvcSocket);
                sockTee.position.y = s * 0.75; group.add(sockTee);
            }
        }
        else if (type.includes('TEE_REDUCING')) {
            var trm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 2.5, 16), mat);
            trm.rotation.z = Math.PI / 2; group.add(trm);
            var trb = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.22, s * 0.22, s * 1.2, 16), mat);
            trb.position.y = s * 0.7; group.add(trb);
            var transCone = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.22, s * 0.35, s * 0.3, 16), matDark);
            transCone.position.y = s * 0.5; group.add(transCone);
        }
        else if (type.includes('CROSS')) {
            var cm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 2.5, 16), mat);
            cm.rotation.z = Math.PI / 2; group.add(cm);
            var cb1 = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.2, 16), mat);
            cb1.position.y = s * 0.7; group.add(cb1);
            var cb2 = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.2, 16), mat);
            cb2.position.y = -s * 0.7; group.add(cb2);
        }
        else if (type.includes('CONCENTRIC_REDUCER') || type.includes('REDUCTOR_CONCENTRICO')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.3, s * 1.8, 16), mat));
        }
        else if (type.includes('ECCENTRIC_REDUCER')) {
            var re = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.3, s * 1.8, 16), mat);
            re.position.y = -s * 0.25; group.add(re);
        }
        else if (type.includes('BULKHEAD') || type.includes('PASAMUROS')) {
            var bh = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.2, 16), mat);
            bh.rotation.z = Math.PI / 2; group.add(bh);
            var bfg = new THREE.CylinderGeometry(s * 0.55, s * 0.55, s * 0.12, 32);
            var bf1 = new THREE.Mesh(bfg, matDark); bf1.rotation.z = Math.PI / 2; bf1.position.x = -s * 0.6; group.add(bf1);
            var bf2 = new THREE.Mesh(bfg, matDark); bf2.rotation.z = Math.PI / 2; bf2.position.x = s * 0.6; group.add(bf2);
            var gask = new THREE.Mesh(new THREE.TorusGeometry(s * 0.45, s * 0.04, 12, 24), matGreen.clone());
            gask.position.x = -s * 0.65; gask.rotation.y = Math.PI / 2; group.add(gask);
        }
        else if (type.includes('FLANGE') || type.includes('BRIDA')) {
            var fb = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.3, 16), mat);
            fb.rotation.z = Math.PI / 2; group.add(fb);
            var fd = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.6, s * 0.6, s * 0.1, 32), matDark);
            fd.rotation.z = Math.PI / 2; fd.position.x = s * 0.2; group.add(fd);
            if (isCS) {
                var rf = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.42, s * 0.42, s * 0.015, 32), MaterialLibrary.stemChrome);
                rf.rotation.z = Math.PI / 2; rf.position.x = s * 0.26; group.add(rf);
            }
            for (var h = 0; h < Math.PI * 2; h += Math.PI / 4) {
                var hole = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.035, s * 0.035, s * 0.12, 8), matBlack.clone());
                hole.rotation.z = Math.PI / 2;
                hole.position.set(s * 0.2, Math.cos(h) * s * 0.45, Math.sin(h) * s * 0.45);
                group.add(hole);
            }
        }
        else if (type.includes('STUB_END') || type.includes('PORTABRIDA')) {
            if (isPPR || isPVC) {
                var stubGroup = createPlasticStubEnd(s * 0.35, s * 0.7, mat);
                group.add(stubGroup);
            } else {
                var se = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.45, s * 0.5, 16), mat);
                se.rotation.z = Math.PI / 2; group.add(se);
                var sef = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.55, s * 0.55, s * 0.1, 32), matDark);
                sef.rotation.z = Math.PI / 2; sef.position.x = s * 0.3; group.add(sef);
            }
        }
        else if (type.includes('CAP') || type.includes('TAPON')) {
            group.add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat));
        }
        else if (type.includes('UNION')) {
            var ub = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 0.7, 16), mat);
            ub.rotation.z = Math.PI / 2; group.add(ub);
            var un = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 0.15, 6), matDark);
            un.rotation.z = Math.PI / 2; un.position.x = s * 0.4; group.add(un);
            if (isPPR) {
                var nutColor = MaterialLibrary.pprDark;
                un.material = nutColor;
            }
            if (isPVC) {
                un.material = MaterialLibrary.pvcSocket;
            }
        }
        else if (type.includes('NIPPLE') || type.includes('NIPLE')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.5, 16), mat));
        }
        else if (type.includes('TRANSITION') || type.includes('ADAPTADOR')) {
            if (isPPR) {
                var trPlastic = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 0.6, 16), mat);
                trPlastic.rotation.z = Math.PI / 2; trPlastic.position.x = -s * 0.3; group.add(trPlastic);
                var trMetal = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.5, 16), MaterialLibrary.forgedSteel);
                trMetal.rotation.z = Math.PI / 2; trMetal.position.x = s * 0.3; group.add(trMetal);
                var trNut = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 0.1, 6), MaterialLibrary.pprDark);
                trNut.rotation.z = Math.PI / 2; trNut.position.x = 0; group.add(trNut);
            } else {
                var trGeo = new THREE.CylinderGeometry(s * 0.4, s * 0.5, s * 1.0, 16);
                group.add(new THREE.Mesh(trGeo, mat));
                var trNut = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 0.15, 6), matDark);
                trNut.rotation.z = Math.PI / 2; trNut.position.x = s * 0.5; group.add(trNut);
            }
        }
        else if (type.includes('EXPANSION_JOINT') || type.includes('JUNTA_EXPANSION')) {
            var ej = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 1.2, 16), mat);
            ej.rotation.z = Math.PI / 2; group.add(ej);
            for (var b = 0; b < 4; b++) {
                var bellows = new THREE.Mesh(new THREE.TorusGeometry(s * 0.52, s * 0.06, 12, 24), matDark);
                bellows.position.x = -s * 0.45 + b * s * 0.3; bellows.rotation.y = Math.PI / 2; group.add(bellows);
            }
            // Tirantes de ajuste
            for (var ti = 0; ti < 2; ti++) {
                var tieRod = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.02, s * 0.02, s * 1.4, 8), MaterialLibrary.stemChrome);
                tieRod.rotation.z = Math.PI / 2;
                tieRod.position.set(0, (ti === 0 ? 1 : -1) * s * 0.55, 0);
                group.add(tieRod);
            }
        }
        else if (type.includes('STRAINER') || type.includes('FILTRO')) {
            var strainerType = type.includes('Y_') ? 'Y' : (type.includes('T_') ? 'T' : 'BASKET');
            var stBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 1.5, 16), mat);
            stBody.rotation.z = Math.PI / 2; group.add(stBody);
            if (strainerType === 'Y') {
                var yLeg = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.25, s * 0.25, s * 1.0, 8), mat);
                yLeg.position.set(0, -s * 0.7, 0); yLeg.rotation.x = Math.PI / 4; group.add(yLeg);
            }
            var stCap = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.2, 16), matDark);
            stCap.position.set(0, -s * 1.0, 0); group.add(stCap);
            var drainPlug = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.06, s * 0.06, s * 0.1, 8), matBrass.clone());
            drainPlug.position.set(0, -s * 1.15, 0); group.add(drainPlug);
        }
        else if (type.includes('STEAM_TRAP') || type.includes('TRAMPA')) {
            var trap = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.9, 16), mat);
            trap.rotation.z = Math.PI / 2; group.add(trap);
            var trapTop = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.25, s * 0.3, s * 0.3, 16), matDark);
            trapTop.position.y = s * 0.5; group.add(trapTop);
        }
        else if (type.includes('CAMLOCK') || type.includes('CAM-LOCK')) {
            var cl = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.6, 16), mat);
            cl.rotation.z = Math.PI / 2; group.add(cl);
            for (var a = 0; a < Math.PI * 2; a += Math.PI) {
                var arm = new THREE.Mesh(new THREE.BoxGeometry(s * 0.06, s * 0.25, s * 0.04), matDark);
                arm.position.set(Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4, 0); group.add(arm);
            }
        }
        else if (type.includes('QUICK_CONNECT') || type.includes('CONEXION_RAPIDA')) {
            var qc = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.5, 16), matBrass.clone());
            qc.rotation.z = Math.PI / 2; group.add(qc);
            var qcRing = new THREE.Mesh(new THREE.TorusGeometry(s * 0.4, s * 0.04, 12, 24), matDark);
            qcRing.rotation.y = Math.PI / 2; group.add(qcRing);
        }
        else if (type.includes('HOSE') || type.includes('MANGUERA')) {
            var hoseColor = type.includes('PTFE') ? 0xa78bfa : (type.includes('METALLIC') ? 0x94a3b8 : 0x22c55e);
            var hoseMat = new THREE.MeshStandardMaterial({ color: hoseColor, metalness: 0.1, roughness: 0.7 });
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 1.5, 16), hoseMat));
            for (var r = 0; r < 5; r++) {
                var rib = new THREE.Mesh(new THREE.TorusGeometry(s * 0.38, s * 0.03, 8, 16), matDark);
                rib.position.x = -s * 0.65 + r * s * 0.325; rib.rotation.y = Math.PI / 2; group.add(rib);
            }
        }
        else if (type.includes('SILENCER') || type.includes('SILENCIADOR')) {
            var sil = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.5, s * 1.5, 16), mat); group.add(sil);
            var silCap1 = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 0.1, 16), matDark);
            silCap1.position.y = s * 0.8; group.add(silCap1);
            var silCap2 = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 0.1, 16), matDark);
            silCap2.position.y = -s * 0.8; group.add(silCap2);
        }
        else if (type.includes('FLAME_ARRESTER') || type.includes('ARRESTADOR')) {
            var fa = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.9, 16),
                new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.3 }));
            fa.rotation.z = Math.PI / 2; group.add(fa);
            var faGrid = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.05, 32), matBlack.clone());
            group.add(faGrid);
        }
        else if (type.includes('VACUUM_BREAKER') || type.includes('ROMPEDOR')) {
            var vb = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.3, s * 0.7, 16),
                new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.5, roughness: 0.3 })); group.add(vb);
            var vbCap = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.1, 16), matDark);
            vbCap.position.y = s * 0.4; group.add(vbCap);
        }
        else if (type.includes('SAMPLE_COOLER') || type.includes('ENFRIADOR')) {
            var sc = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.0, 16), mat);
            sc.rotation.z = Math.PI / 2; group.add(sc);
            var scJacket = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 0.8, 16),
                new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.4 }));
            scJacket.rotation.z = Math.PI / 2; group.add(scJacket);
        }
        else if (type.includes('PIPE_SHOE') || type.includes('ZAPATA')) {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.6, s * 0.3, s * 0.6), matSupport.clone()));
        }
        else if (type.includes('U_BOLT') || type.includes('U-BOLT')) {
            var ubGeo = new THREE.TorusGeometry(s * 0.4, s * 0.05, 8, 8, Math.PI);
            group.add(new THREE.Mesh(ubGeo, matSupport.clone()));
            var ubPlate = new THREE.Mesh(new THREE.BoxGeometry(s * 0.8, s * 0.04, s * 0.1), matSupport.clone());
            ubPlate.position.y = -s * 0.4; group.add(ubPlate);
        }
        else if (type.includes('GUIDE') || type.includes('GUIA')) {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.3, s * 0.6, s * 0.3), matSupport.clone()));
        }
        else if (type.includes('ANCHOR') || type.includes('ANCLAJE')) {
            var anchorGeo = new THREE.BoxGeometry(s * 0.5, s * 0.5, s * 0.5);
            group.add(new THREE.Mesh(anchorGeo, new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.7, roughness: 0.25 })));
        }
        else if (type.includes('HANGER') || type.includes('COLGADOR') || type.includes('SPRING')) {
            var hangerRod = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.05, s * 0.05, s * 1.5, 8), matSupport.clone());
            group.add(hangerRod);
            if (type.includes('SPRING')) {
                var springGeo = new THREE.TorusGeometry(s * 0.2, s * 0.04, 8, 16);
                for (var sp = 0; sp < 4; sp++) {
                    var spring = new THREE.Mesh(springGeo, matSupport.clone());
                    spring.position.y = sp * s * 0.15; group.add(spring);
                }
            }
        }
        else if (type.includes('PIPE_CLAMP') || type.includes('ABRAZADERA')) {
            var clampGeo = new THREE.TorusGeometry(s * 0.45, s * 0.05, 8, 16);
            group.add(new THREE.Mesh(clampGeo, matSupport.clone()));
        }
        else {
            group.add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.35, 16, 16), mat));
        }

        group.position.copy(pos3D);
        orientComponent(group, dirVec);
        group.userData = { tag: comp.tag, type: comp.type, isComponent: true };
        return group;
    }

    // ═══════════════════════════════════════════
    // VÁLVULAS DETALLADAS (GATE, BALL, BUTTERFLY, GLOBE, CHECK, DIAFRAGMA)
    // ═══════════════════════════════════════════
    function createGateValve(pos3D, dirVec, s, spec) {
        var specMat = getSpecMaterial(spec); var mat = MaterialLibrary.clone(specMat);
        var matDark = MaterialLibrary.clone(specMat);
        matDark.metalness = Math.min(matDark.metalness + 0.15, 1.0);
        matDark.roughness = Math.max(matDark.roughness - 0.15, 0.1);
        var group = new THREE.Group();
        var body = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.38, s * 0.38, s * 1.4, 20), mat);
        body.rotation.z = Math.PI / 2; group.add(body);
        var bonnet = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.28, s * 0.38, s * 0.55, 20), matDark);
        bonnet.position.y = s * 0.6; group.add(bonnet);
        var bonnetFlange = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.42, s * 0.42, s * 0.08, 24), MaterialLibrary.forgedSteel);
        bonnetFlange.position.y = s * 0.33; group.add(bonnetFlange);
        for (var bp = 0; bp < Math.PI * 2; bp += Math.PI / 3) {
            var bBolt = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.025, s * 0.025, s * 0.12, 6), MaterialLibrary.stemChrome);
            bBolt.position.set(Math.cos(bp) * s * 0.38, s * 0.35, Math.sin(bp) * s * 0.38); group.add(bBolt);
        }
        var gland = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.15, s * 0.2, s * 0.2, 16), matDark);
        gland.position.y = s * 0.9; group.add(gland);
        var stem = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 1.4, 12), MaterialLibrary.stemChrome);
        stem.position.y = s * 1.3; group.add(stem);
        var wheel = new THREE.Mesh(new THREE.TorusGeometry(s * 0.4, s * 0.06, 12, 32), MaterialLibrary.handwheelBlack);
        wheel.position.y = s * 2.0; wheel.rotation.x = Math.PI / 2; group.add(wheel);
        for (var a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            var spoke = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.025, s * 0.025, s * 0.36, 8), MaterialLibrary.handwheelBlack);
            spoke.position.set(Math.cos(a) * s * 0.18, s * 2.0, Math.sin(a) * s * 0.18); spoke.rotation.z = Math.PI / 2; group.add(spoke);
        }
        var wheelNut = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.06, s * 0.06, s * 0.08, 6), MaterialLibrary.stemChrome);
        wheelNut.position.y = s * 2.04; group.add(wheelNut);
        group.position.copy(pos3D); orientComponent(group, dirVec);
        group.userData = { tag: 'GV-' + Date.now().toString(36), type: 'GATE_VALVE', isComponent: true };
        return group;
    }

    function createBallValve(pos3D, dirVec, s, spec) {
        var specMat = getSpecMaterial(spec); var mat = MaterialLibrary.clone(specMat);
        var matDark = MaterialLibrary.clone(specMat);
        matDark.metalness = Math.min(matDark.metalness + 0.15, 1.0);
        matDark.roughness = Math.max(matDark.roughness - 0.15, 0.1);
        var group = new THREE.Group();
        var body = new THREE.Mesh(new THREE.SphereGeometry(s * 0.38, 24, 24), matDark);
        body.scale.set(1.3, 1, 1); group.add(body);
        [-1, 1].forEach(function(side) {
            var end = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.28, s * 0.32, s * 0.35, 20), mat);
            end.rotation.z = Math.PI / 2; end.position.x = side * s * 0.55; group.add(end);
            var endFlange = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.42, s * 0.42, s * 0.06, 24), matDark);
            endFlange.rotation.z = Math.PI / 2; endFlange.position.x = side * s * 0.75; group.add(endFlange);
        });
        var ballVisible = new THREE.Mesh(new THREE.SphereGeometry(s * 0.22, 16, 16),
            new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.95, roughness: 0.08 }));
        ballVisible.scale.set(1.1, 1, 1); group.add(ballVisible);
        var stem = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.7, 12), MaterialLibrary.stemChrome);
        stem.position.y = s * 0.5; group.add(stem);
        var lever = new THREE.Mesh(new THREE.BoxGeometry(s * 0.9, s * 0.04, s * 0.06), matDark);
        lever.position.y = s * 0.85; group.add(lever);
        var grip = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.05, s * 0.05, s * 0.2, 8), matRed.clone());
        grip.rotation.z = Math.PI / 2; grip.position.set(s * 0.45, s * 0.85, 0); group.add(grip);
        group.position.copy(pos3D); orientComponent(group, dirVec);
        group.userData = { tag: 'BA-' + Date.now().toString(36), type: 'BALL_VALVE', isComponent: true };
        return group;
    }

    function createButterflyValve(pos3D, dirVec, s, spec) {
        var specMat = getSpecMaterial(spec); var matDark = MaterialLibrary.clone(specMat);
        matDark.metalness = Math.min(matDark.metalness + 0.15, 1.0);
        matDark.roughness = Math.max(matDark.roughness - 0.15, 0.1);
        var group = new THREE.Group();
        var body = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 0.25, 32), matDark);
        body.rotation.z = Math.PI / 2; group.add(body);
        var disc = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 0.03, 24), MaterialLibrary.stemChrome);
        disc.rotation.z = Math.PI / 2; disc.rotation.x = Math.PI / 6; group.add(disc);
        var shaft = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.03, s * 0.03, s * 0.55, 12), MaterialLibrary.stemChrome);
        shaft.position.y = s * 0.3; group.add(shaft);
        var actuator = new THREE.Mesh(new THREE.BoxGeometry(s * 0.35, s * 0.3, s * 0.3), matDark);
        actuator.position.y = s * 0.6; group.add(actuator);
        var actWheel = new THREE.Mesh(new THREE.TorusGeometry(s * 0.15, s * 0.025, 8, 16), MaterialLibrary.handwheelBlack);
        actWheel.rotation.x = Math.PI / 2; actWheel.position.y = s * 0.78; group.add(actWheel);
        group.position.copy(pos3D); orientComponent(group, dirVec);
        group.userData = { tag: 'VB-' + Date.now().toString(36), type: 'BUTTERFLY_VALVE', isComponent: true };
        return group;
    }

    function createGlobeValve(pos3D, dirVec, s, spec) {
        var specMat = getSpecMaterial(spec); var mat = MaterialLibrary.clone(specMat);
        var matDark = MaterialLibrary.clone(specMat);
        matDark.metalness = Math.min(matDark.metalness + 0.15, 1.0);
        matDark.roughness = Math.max(matDark.roughness - 0.15, 0.1);
        var group = new THREE.Group();
        var gBody = new THREE.Mesh(new THREE.SphereGeometry(s * 0.48, 24, 24), mat);
        gBody.scale.set(1, 1.3, 1); group.add(gBody);
        var gBonnet = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.22, s * 0.35, s * 0.5, 20), matDark);
        gBonnet.position.y = s * 0.7; group.add(gBonnet);
        var gStem = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 1.0, 12), MaterialLibrary.stemChrome);
        gStem.position.y = s * 1.2; group.add(gStem);
        var gWheel = new THREE.Mesh(new THREE.TorusGeometry(s * 0.3, s * 0.05, 10, 24), MaterialLibrary.handwheelBlack);
        gWheel.position.y = s * 1.7; gWheel.rotation.x = Math.PI / 2; group.add(gWheel);
        for (var a = 0; a < Math.PI * 2; a += Math.PI / 3) {
            var sp = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.02, s * 0.02, s * 0.27, 8), MaterialLibrary.handwheelBlack);
            sp.position.set(Math.cos(a) * s * 0.15, s * 1.7, Math.sin(a) * s * 0.15); sp.rotation.z = Math.PI / 2; group.add(sp);
        }
        group.position.copy(pos3D); orientComponent(group, dirVec);
        group.userData = { tag: 'GL-' + Date.now().toString(36), type: 'GLOBE_VALVE', isComponent: true };
        return group;
    }

    function createCheckValve(pos3D, dirVec, s, spec) {
        var specMat = getSpecMaterial(spec); var mat = MaterialLibrary.clone(specMat);
        var matDark = MaterialLibrary.clone(specMat);
        matDark.metalness = Math.min(matDark.metalness + 0.15, 1.0);
        matDark.roughness = Math.max(matDark.roughness - 0.15, 0.1);
        var group = new THREE.Group();
        var cBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.38, s * 0.38, s * 1.3, 20), mat);
        cBody.rotation.z = Math.PI / 2; group.add(cBody);
        var cap = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.38, s * 0.38, s * 0.2, 20), matDark);
        cap.rotation.z = Math.PI / 2; cap.position.x = s * 0.75; group.add(cap);
        var arrowShaft = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.03, s * 0.03, s * 0.4, 8), MaterialLibrary.stemChrome);
        arrowShaft.position.y = s * 0.5; group.add(arrowShaft);
        var arrowHead = new THREE.Mesh(new THREE.ConeGeometry(s * 0.08, s * 0.2, 8),
            new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x0a3d0a, emissiveIntensity: 0.4 }));
        arrowHead.position.y = s * 0.7; group.add(arrowHead);
        group.position.copy(pos3D); orientComponent(group, dirVec);
        group.userData = { tag: 'CK-' + Date.now().toString(36), type: 'CHECK_VALVE', isComponent: true };
        return group;
    }

    function createDiaphragmValve(pos3D, dirVec, s, spec) {
        var specMat = getSpecMaterial(spec); var mat = MaterialLibrary.clone(specMat);
        var matDark = MaterialLibrary.clone(specMat);
        matDark.metalness = Math.min(matDark.metalness + 0.15, 1.0);
        matDark.roughness = Math.max(matDark.roughness - 0.15, 0.1);
        var group = new THREE.Group();
        var dBody = new THREE.Mesh(new THREE.BoxGeometry(s * 1.1, s * 0.55, s * 0.7, 2, 2, 2), mat);
        dBody.position.y = s * 0.1; group.add(dBody);
        var dBonnet = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.22, s * 0.32, s * 0.45, 20), matDark);
        dBonnet.position.y = s * 0.5; group.add(dBonnet);
        var dWheel = new THREE.Mesh(new THREE.TorusGeometry(s * 0.28, s * 0.04, 10, 24), MaterialLibrary.handwheelBlack);
        dWheel.position.y = s * 0.8; dWheel.rotation.x = Math.PI / 2; group.add(dWheel);
        var indicator = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.03, s * 0.03, s * 0.2, 8), matRed.clone());
        indicator.position.y = s * 0.65; group.add(indicator);
        group.position.copy(pos3D); orientComponent(group, dirVec);
        group.userData = { tag: 'DV-' + Date.now().toString(36), type: 'DIAPHRAGM_VALVE', isComponent: true };
        return group;
    }

    function createValve(comp, pos3D, dirVec, size, compType, spec) {
        var type = (compType || comp.type || '').toUpperCase();
        var s = size;
        if (type.includes('GATE_VALVE') || type.includes('COMPUERTA')) return createGateValve(pos3D, dirVec, s, spec);
        if (type.includes('GLOBE_VALVE')) return createGlobeValve(pos3D, dirVec, s, spec);
        if (type.includes('BALL_VALVE') || type.includes('BOLA') || type.includes('PLUG_VALVE') || type.includes('CHOKE_VALVE') || type.includes('CRYOGENIC_VALVE')) return createBallValve(pos3D, dirVec, s, spec);
        if (type.includes('BUTTERFLY_VALVE') || type.includes('MARIPOSA')) return createButterflyValve(pos3D, dirVec, s, spec);
        if (type.includes('CHECK_VALVE') || type.includes('RETENCION')) return createCheckValve(pos3D, dirVec, s, spec);
        if (type.includes('DIAPHRAGM_VALVE') || type.includes('DIAFRAGMA') || type.includes('ASEPTIC_VALVE')) return createDiaphragmValve(pos3D, dirVec, s, spec);
        if (type.includes('CONTROL_VALVE')) {
            var cvBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.38, s * 0.45, s * 1.2, 20), getSpecMaterial(spec));
            cvBody.rotation.z = Math.PI / 2; var cvGroup = new THREE.Group(); cvGroup.add(cvBody);
            var actuator = new THREE.Mesh(new THREE.BoxGeometry(s * 0.5, s * 0.7, s * 0.5), MaterialLibrary.blueActuator);
            actuator.position.y = s * 0.7; cvGroup.add(actuator);
            cvGroup.position.copy(pos3D); orientComponent(cvGroup, dirVec);
            cvGroup.userData = { tag: comp.tag, type: comp.type, isComponent: true };
            return cvGroup;
        }
        if (type.includes('RELIEF') || type.includes('SAFETY') || type.includes('ALIVIO') || type.includes('SEGURIDAD')) {
            var rBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.25, s * 0.35, s * 0.8, 16),
                new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.3 }));
            var rGroup = new THREE.Group(); rGroup.add(rBody);
            var rCap = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.2, 16), MaterialLibrary.clone(getSpecMaterial(spec)));
            rCap.position.y = s * 0.5; rGroup.add(rCap);
            var lever = new THREE.Mesh(new THREE.BoxGeometry(s * 0.04, s * 0.3, s * 0.04), MaterialLibrary.stemChrome);
            lever.position.y = s * 0.65; rGroup.add(lever);
            rGroup.position.copy(pos3D); orientComponent(rGroup, dirVec);
            rGroup.userData = { tag: comp.tag, type: comp.type, isComponent: true };
            return rGroup;
        }
        var fallbackGroup = new THREE.Group();
        fallbackGroup.add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.4, 16, 16), getSpecMaterial(spec)));
        fallbackGroup.position.copy(pos3D); orientComponent(fallbackGroup, dirVec);
        fallbackGroup.userData = { tag: comp.tag, type: comp.type, isComponent: true };
        return fallbackGroup;
    }

    // ═══════════════════════════════════════════
    // INSTRUMENTOS
    // ═══════════════════════════════════════════
    function createInstrument(comp, pos3D, dirVec, size, compType) {
        var type = (compType || comp.type || '').toUpperCase();
        var s = size;
        var group = new THREE.Group();
        if (type.includes('PRESSURE_GAUGE') || type.includes('MANOMETRO')) {
            var pgBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.12, 32),
                new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.2 })); group.add(pgBody);
            var pgDial = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.27, s * 0.27, s * 0.015, 32),
                new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.05 })); pgDial.position.z = s * 0.08; group.add(pgDial);
            var pgNeedle = new THREE.Mesh(new THREE.BoxGeometry(s * 0.008, s * 0.12, s * 0.008), matRed.clone());
            pgNeedle.position.z = s * 0.085; pgNeedle.rotation.z = Math.PI / 6; group.add(pgNeedle);
        }
        else if (type.includes('TEMPERATURE_GAUGE') || type.includes('TERMOMETRO')) {
            var tgStem = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 1.0, 8), MaterialLibrary.stemChrome); group.add(tgStem);
            var tgDial = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.18, s * 0.18, s * 0.08, 16),
                new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.05 })); tgDial.position.y = s * 0.5; group.add(tgDial);
        }
        else if (type.includes('FLOW_METER') || type.includes('CAUDALIMETRO') || type.includes('CORIOLIS')) {
            var fm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.8, 20), MaterialLibrary.stainless316);
            fm.rotation.z = Math.PI / 2; group.add(fm);
            var fmDisplay = new THREE.Mesh(new THREE.BoxGeometry(s * 0.3, s * 0.4, s * 0.04),
                new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.15 })); fmDisplay.position.y = s * 0.5; group.add(fmDisplay);
        }
        else if (type.includes('TRANSMITTER') || type.includes('TRANSMISOR')) {
            var tx = new THREE.Mesh(new THREE.BoxGeometry(s * 0.4, s * 0.5, s * 0.3), MaterialLibrary.blueActuator); group.add(tx);
            var txAntenna = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.03, s * 0.03, s * 0.3, 8), matBlack.clone());
            txAntenna.position.y = s * 0.4; group.add(txAntenna);
        }
        else if (type.includes('ROTAMETER') || type.includes('ROTAMETRO')) {
            var roTube = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.12, s * 0.15, s * 1.2, 16), matGlass.clone()); group.add(roTube);
            var roFrame = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.16, s * 0.16, s * 1.2, 8),
                new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.7, roughness: 0.3 })); group.add(roFrame);
        }
        else if (type.includes('SIGHT_GLASS') || type.includes('VISOR') || type.includes('MIRILLA')) {
            var sg = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.2, s * 0.5, 16), matGlass.clone());
            sg.rotation.z = Math.PI / 2; group.add(sg);
            [-1, 1].forEach(function(side) {
                var frame = new THREE.Mesh(new THREE.TorusGeometry(s * 0.22, s * 0.03, 12, 24), MaterialLibrary.forgedSteel);
                frame.position.x = side * s * 0.25; frame.rotation.y = Math.PI / 2; group.add(frame);
            });
        }
        else if (type.includes('LEVEL_SWITCH') || type.includes('SWITCH_RANA')) {
            var ls = new THREE.Mesh(new THREE.BoxGeometry(s * 0.35, s * 0.25, s * 0.25),
                new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.3, roughness: 0.4 })); group.add(ls);
            var lsRod = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.6, 8), MaterialLibrary.stemChrome);
            lsRod.position.y = s * 0.4; group.add(lsRod);
        }
        else { group.add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.35, 16, 16), getSpecMaterial('ACERO_150_RF'))); }
        group.position.copy(pos3D); orientComponent(group, dirVec);
        group.userData = { tag: comp.tag, type: comp.type, isComponent: true };
        return group;
    }

    function isFitting(type) {
        var t = (type || '').toUpperCase();
        return t.includes('ELBOW') || t.includes('CODO') || t.includes('TEE') || t.includes('CROSS') ||
               t.includes('REDUCER') || t.includes('REDUCTOR') || t.includes('FLANGE') || t.includes('BRIDA') ||
               t.includes('BULKHEAD') || t.includes('PASAMUROS') || t.includes('CAP') || t.includes('TAPON') ||
               t.includes('UNION') || t.includes('NIPPLE') || t.includes('NIPLE') || t.includes('STUB_END') ||
               t.includes('PORTABRIDA') || t.includes('TRANSITION') || t.includes('ADAPTADOR') ||
               t.includes('EXPANSION') || t.includes('STRAINER') || t.includes('FILTRO') ||
               t.includes('STEAM_TRAP') || t.includes('TRAMPA') || t.includes('CAMLOCK') ||
               t.includes('QUICK_CONNECT') || t.includes('HOSE') || t.includes('MANGUERA') ||
               t.includes('SILENCER') || t.includes('SILENCIADOR') || t.includes('FLAME_ARRESTER') ||
               t.includes('ARRESTADOR') || t.includes('VACUUM_BREAKER') || t.includes('ROMPEDOR') ||
               t.includes('SAMPLE_COOLER') || t.includes('ENFRIADOR') ||
               t.includes('PIPE_SHOE') || t.includes('ZAPATA') || t.includes('U_BOLT') ||
               t.includes('GUIDE') || t.includes('GUIA') || t.includes('ANCHOR') || t.includes('ANCLAJE') ||
               t.includes('HANGER') || t.includes('COLGADOR') || t.includes('SPRING') ||
               t.includes('PIPE_CLAMP') || t.includes('ABRAZADERA');
    }

    function isInstrument(type) {
        var t = (type || '').toUpperCase();
        return t.includes('PRESSURE_GAUGE') || t.includes('MANOMETRO') ||
               t.includes('TEMPERATURE_GAUGE') || t.includes('TERMOMETRO') ||
               t.includes('FLOW_METER') || t.includes('CAUDALIMETRO') || t.includes('CORIOLIS') ||
               t.includes('TRANSMITTER') || t.includes('TRANSMISOR') ||
               t.includes('ROTAMETER') || t.includes('ROTAMETRO') ||
               t.includes('SIGHT_GLASS') || t.includes('VISOR') || t.includes('MIRILLA') ||
               t.includes('LEVEL_SWITCH') || t.includes('SWITCH_RANA') ||
               t.includes('PH_METER') || t.includes('CONDUCTIVITY_METER');
    }

    function refreshAllSymbols() {
        if (!_core) return;
        deepDisposeGroup(_symbolGroup);
        var db = _core.getDb(); if (!db) return;
        _totalObjects = 0;
        var equipos = db.equipos || [];
        for (var i = 0; i < equipos.length; i++) {
            if (equipos[i].tag && equipos[i].tag.toString().startsWith('TEE-')) continue;
            var mesh = createEquipmentMesh(equipos[i]);
            if (mesh) { if (_engine) _engine.registerVisualMesh(equipos[i].tag, mesh); _symbolGroup.add(mesh); _totalObjects++; }
        }
        var lines = db.lines || [];
        for (var j = 0; j < lines.length; j++) {
            var line = lines[j];
            var pipe = createPipeMesh(line);
            if (pipe) { _symbolGroup.add(pipe); _totalObjects++; }
            if (line.components && line.components.length) {
                var pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
                if (pts.length >= 2) {
                    var lengths = [], totalLen = 0;
                    for (var k = 0; k < pts.length - 1; k++) { var d = Math.hypot(pts[k+1].x - pts[k].x, pts[k+1].y - pts[k].y, pts[k+1].z - pts[k].z); lengths.push(d); totalLen += d; }
                    line.components.forEach(function(comp) {
                        var param = comp.param || 0.5, targetLen = totalLen * Math.min(1, Math.max(0, param)), accum = 0, segIdx = 0, t = 0;
                        for (var m = 0; m < lengths.length; m++) { if (accum + lengths[m] >= targetLen || m === lengths.length - 1) { segIdx = m; t = (targetLen - accum) / (lengths[m] || 1); break; } accum += lengths[m]; }
                        var pA = pts[segIdx], pB = pts[segIdx + 1];
                        var pos3D = new THREE.Vector3(toM(pA.x + (pB.x - pA.x) * t), toM(pA.y + (pB.y - pA.y) * t), toM(pA.z + (pB.z - pA.z) * t));
                        var dirVec = new THREE.Vector3(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z).normalize();
                        var size = compSize(line.diameter || 4), spec = line.spec || line.material || 'ACERO';
                        var symbol;
                        if (isInstrument(comp.type)) { symbol = createInstrument(comp, pos3D, dirVec, size, comp.type); }
                        else if (isFitting(comp.type)) { symbol = createFitting(comp, pos3D, dirVec, size, comp.type, spec); }
                        else { symbol = createValve(comp, pos3D, dirVec, size, comp.type, spec); }
                        if (symbol) { _symbolGroup.add(symbol); _totalObjects++; }
                    });
                }
            }
        }
        if (_outlinePass) _outlinePass.enabled = _totalObjects <= 30;
    }

    function refreshAllDimensions() {
        if (!_core) return;
        deepDisposeGroup(_dimensionGroup);
        (_core.getDb().lines || []).forEach(function(line) {
            var pts = _core.getLinePoints(line) || [];
            if (pts.length >= 2) for (var i = 0; i < pts.length - 1; i++) {
                var offset = diamToRadiusM(line.diameter || 4) * 6;
                _dimensionGroup.add(new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(toM(pts[i].x), toM(pts[i].y) + offset, toM(pts[i].z)), new THREE.Vector3(toM(pts[i+1].x), toM(pts[i+1].y) + offset, toM(pts[i+1].z))]),
                    new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.6 })));
            }
        });
    }

    function refreshAllFlowArrows() {
        if (!_core) return;
        deepDisposeGroup(_flowArrowGroup);
        (_core.getDb().lines || []).forEach(function(line) {
            var pts = _core.getLinePoints(line) || [];
            if (pts.length < 2) return;
            var arrowSize = diamToRadiusM(line.diameter || 4) * 1.5;
            for (var i = 0; i < pts.length - 1; i++) {
                var mid = new THREE.Vector3(toM((pts[i].x + pts[i+1].x) / 2), toM((pts[i].y + pts[i+1].y) / 2) + arrowSize, toM((pts[i].z + pts[i+1].z) / 2));
                var dir = new THREE.Vector3(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z).normalize();
                var cone = new THREE.Mesh(new THREE.ConeGeometry(arrowSize, arrowSize * 2.5, 8, 8), new THREE.MeshStandardMaterial({ color: 0x00f2ff, emissive: 0x003344 }));
                cone.position.copy(mid); var q = new THREE.Quaternion(); q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); cone.quaternion.copy(q);
                _flowArrowGroup.add(cone);
            }
        });
    }

    function fitCameraToEquipments() {
        if (!_engine) return;
        var scene = _engine.getScene(), camera = _engine.getCamera(), controls = _engine.getControls();
        if (!scene || !camera || !controls) return;
        var bounds = new THREE.Box3(), has = false;
        scene.traverse(function(c) { if (c.isMesh && c.visible && c.geometry && !(c instanceof THREE.GridHelper || c instanceof THREE.ArrowHelper)) { bounds.expandByObject(c); has = true; } });
        if (!has) { camera.position.set(12, 8, 12); controls.target.set(0, 0, 0); controls.update(); return; }
        var center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z, 1), dist = Math.min(maxDim * 1.3, 80);
        camera.position.set(center.x + dist * 0.8, center.y + dist * 0.6, center.z + dist * 0.8);
        controls.target.copy(center); controls.update();
    }

    function updateSelectionHighlight() {
        var sel = _core ? _core.getSelected() : null;
        if (_outlinePass && _outlinePass.enabled) _outlinePass.selectedObjects = (sel && sel.obj && _engine) ? [_engine.getVisualMesh(sel.obj.tag)].filter(Boolean) : [];
    }

    function scheduleRefresh() {
        if (_debounceTimer) clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(function() { refreshAllSymbols(); refreshAllDimensions(); refreshAllFlowArrows(); }, 200);
    }

    function renderFrame() {
        if (!_rendererRef || !_sceneRef || !_cameraRef) return;
        if (_composer && _outlinePass && _outlinePass.enabled) _composer.render();
        else _rendererRef.render(_sceneRef, _cameraRef);
        if (_labelRenderer && _sceneRef && _cameraRef) _labelRenderer.render(_sceneRef, _cameraRef);
    }

    function init(coreInstance, engineInstance) {
        _core = coreInstance; _engine = engineInstance;
        if (!_engine) { console.error('SmartFlowRender: engineInstance requerido'); return; }
        _sceneRef = _engine.getScene(); _cameraRef = _engine.getCamera(); _rendererRef = _engine.getRenderer();
        if (!_sceneRef || !_cameraRef || !_rendererRef) { console.error('SmartFlowRender: Engine no inicializado'); return; }
        setupEffects(_sceneRef, _cameraRef, _rendererRef);
        _symbolGroup.userData = { isSymbolGroup: true }; _symbolGroup.renderOrder = 1;
        _flowArrowGroup.userData = { isFlowArrowGroup: true }; _flowArrowGroup.renderOrder = 2;
        _dimensionGroup.userData = { isDimensionGroup: true }; _dimensionGroup.renderOrder = 3;
        _sceneRef.add(_symbolGroup); _sceneRef.add(_dimensionGroup); _sceneRef.add(_flowArrowGroup);
        if (typeof SmartFlowLabels3D !== 'undefined') { SmartFlowLabels3D.init(coreInstance, engineInstance); setTimeout(function() { SmartFlowLabels3D.refreshAllLabels(); SmartFlowLabels3D.refreshAllDimensions(); }, 800); }
        if (typeof _core.on === 'function') _core.on('modelChanged', function() { scheduleRefresh(); });
        window.set3DView = function(type) { _engine.setView(type); };
        scheduleRefresh();
        console.log("✔ SmartFlowRender v11.0 FINAL - PBR + Plásticos/Metálicos + Válvulas + Plataformas");
    }

    return {
        init: init, fitCameraToEquipments: fitCameraToEquipments,
        refreshAllSymbols: refreshAllSymbols, refreshAllDimensions: refreshAllDimensions,
        refreshAllFlowArrows: refreshAllFlowArrows, updateSelectionHighlight: updateSelectionHighlight,
        renderFrame: renderFrame,
        getComposer: function() { return _composer; },
        getOutlinePass: function() { return _outlinePass; },
        setLabelRenderer: function(lr) { _labelRenderer = lr; }
    };
})();

window.SmartFlowRender = SmartFlowRender;
