
// ============================================================
// SMARTFLOW RENDERER v3.7 - Motor de Renderizado Isométrico 2D
// Archivo: js/renderer.js
// Novedades v3.7:
//   - Eliminado skeyMap (ahora en SmartFlowIO)
//   - Eliminado exportPCF (ahora en SmartFlowIO)
//   - Eliminado generatePCFHeader y formatComponentPCF
//   - Conservado calculateComponentPosition (usado en renderizado)
//   - Conservado exportPDF (independiente)
// ============================================================

const SmartFlowRenderer = (function() {
    let _canvas = null;
    let _ctx = null;
    let _core = null;
    let _cam = { scale: 0.5, panX: 0, panY: 0 };
    let _currentElevation = 0;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderScheduled = false;
    let _cacheDirty = true;
    let _bomItems = [];
    let _allLinePoints = [];
    let _renderQueueCache = [];

    const COS30 = 0.86602540378;
    const SIN30 = 0.5;
    const SNAP_THRESHOLD = 15;
    let _activeSnap = null;
    let _hoveredComponent = null;
    let _hoveredComponentScreenPos = null;

    const ISO_CONFIG = {
        MATERIALS: { 'PPR': 'PP', 'CARBON_STEEL': 'CS', 'STAINLESS_STEEL': 'SS', 'POLIETILENO': 'PE', 'PVC': 'PV' },
        COLORS: { 'PP': '#10b981', 'CS': '#475569', 'SS': '#94a3b8', 'PE': '#1e293b', 'PV': '#7c3aed' }
    };

    const AnnotationManager = {
        slots: [], occupiedBounds: [],
        minZoomForDetails: 0.3, minZoomForAll: 0.5,
        reset() { this.slots = []; this.occupiedBounds = []; },
        checkCollision(box) {
            for (const other of this.occupiedBounds) {
                if (!(box.x + box.w < other.x || box.x > other.x + other.w ||
                      box.y + box.h < other.y || box.y > other.y + other.h)) return true;
            }
            return false;
        },
        findBestPosition(preferredX, preferredY, w, h, priority, maxAttempts = 8) {
            const offsets = [
                { dx: 0, dy: 0 }, { dx: 0, dy: -h - 5 }, { dx: 0, dy: h + 5 },
                { dx: w + 10, dy: 0 }, { dx: -w - 10, dy: 0 }, { dx: w + 10, dy: -h - 5 },
                { dx: -w - 10, dy: -h - 5 }, { dx: 0, dy: -2 * h - 10 }
            ];
            for (let i = 0; i < Math.min(maxAttempts, offsets.length); i++) {
                const candidate = { x: preferredX + offsets[i].dx, y: preferredY + offsets[i].dy, w, h };
                if (!this.checkCollision(candidate)) return candidate;
            }
            return { x: preferredX, y: preferredY, w, h };
        },
        register(box, priority) {
            const best = this.findBestPosition(box.x, box.y, box.w, box.h, priority);
            best.priority = priority;
            this.occupiedBounds.push(best);
            this.slots.push(best);
            return best;
        },
        isVisible(priority) {
            if (priority <= 1) return true;
            if (_cam.scale < this.minZoomForDetails && priority > 1) return false;
            if (_cam.scale < this.minZoomForAll && priority >= 4) return false;
            return true;
        }
    };

    function project(p) {
        if (!p || p.x === undefined || p.y === undefined || p.z === undefined) return { x: 0, y: 0 };
        const x = (p.x - p.z) * COS30;
        const y = (p.x + p.z) * SIN30 - p.y;
        return { x: x * _cam.scale + _cam.panX, y: y * _cam.scale + _cam.panY };
    }

    function inverseProject(screenX, screenY, planeY = _currentElevation) {
        const X = (screenX - _cam.panX) / _cam.scale;
        const Y = (screenY - _cam.panY) / _cam.scale;
        const adjY = Y + (planeY * SIN30 * 2);
        const A = X / COS30; const B = adjY / SIN30;
        return { x: (A + B) / 2, y: planeY, z: (B - A) / 2 };
    }

    function adjustColor(color, percent) {
        const num = parseInt(color.replace("#",""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt, G = (num >> 8 & 0x00FF) + amt, B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
    }

    function getMaterialGradient(ctx, p1, p2, material, diameter) {
        const proj1 = project(p1), proj2 = project(p2);
        const angle = Math.atan2(proj2.y - proj1.y, proj2.x - proj1.x) + Math.PI/2;
        const w = diameter * _cam.scale;
        const grad = ctx.createLinearGradient(
            proj1.x + Math.cos(angle)*w/2, proj1.y + Math.sin(angle)*w/2,
            proj1.x - Math.cos(angle)*w/2, proj1.y - Math.sin(angle)*w/2
        );
        const baseColor = ISO_CONFIG.COLORS[material] || '#94a3b8';
        if (material === 'PP') {
            grad.addColorStop(0, '#064e3b'); grad.addColorStop(0.25, '#6ee7b7');
            grad.addColorStop(0.5, baseColor); grad.addColorStop(1, '#065f46');
        } else {
            grad.addColorStop(0, '#1a1a1a'); grad.addColorStop(0.4, baseColor);
            grad.addColorStop(0.5, '#ffffffcc'); grad.addColorStop(0.6, baseColor);
            grad.addColorStop(1, '#000000');
        }
        return grad;
    }

    function getShortMaterial(materialName) {
        const name = materialName ? materialName.toUpperCase() : '';
        return ISO_CONFIG.MATERIALS[name] || name.substring(0,2) || 'UN';
    }

    function formatDimensionText(dist) {
        if (dist < 1000) return Math.round(dist).toString();
        return (dist / 1000).toFixed(2) + "m";
    }

    function getComponentLabel(compType) {
        if (typeof SmartFlowCatalog !== 'undefined') {
            const catComp = SmartFlowCatalog.getComponent(compType);
            if (catComp && catComp.abbr) return catComp.abbr;
        }
        const abbrMap = {
            'GATE_VALVE':'GV','GLOBE_VALVE':'GL','BUTTERFLY_VALVE':'VB','BALL_VALVE':'BA',
            'CHECK_VALVE':'CK','DIAPHRAGM_VALVE':'DV','CONTROL_VALVE':'CV',
            'PRESSURE_RELIEF':'RV','SAFETY_VALVE':'SV',
            'CONCENTRIC_REDUCER':'RC','ECCENTRIC_REDUCER':'RE',
            'WELD_NECK_FLANGE':'FL','SLIP_ON_FLANGE':'FL','BLIND_FLANGE':'FB','LAP_JOINT_FLANGE':'FL',
            'RTJ_FLANGE':'FR','ORIFICE_FLANGE':'FO',
            'PRESSURE_GAUGE':'PG','TEMPERATURE_GAUGE':'TG','FLOW_METER':'FM',
            'PRESSURE_TRANSMITTER':'PT','LEVEL_TRANSMITTER':'LT','TEMPERATURE_TRANSMITTER':'TT',
            'TEE_EQUAL':'TE','TEE_REDUCING':'TR','CROSS':'CR','CAP':'CA',
            'ELBOW_90_LR':'EL','ELBOW_90_SR':'EL','ELBOW_45':'E4',
            'ELBOW_90_PPR':'EL','ELBOW_45_PPR':'E4','ELBOW_90_HDPE':'EL','ELBOW_45_HDPE':'E4',
            'ELBOW_90_PVC':'EL','ELBOW_45_PVC':'E4','ELBOW_90_LR_SS':'EL','ELBOW_45_SS':'E4',
            'ELBOW_90_SANITARY':'EL',
            'TRANSITION':'TR','UNION':'UN','UNION_ACERO':'UN','BULKHEAD':'BH',
            'Y_STRAINER':'YS','T_STRAINER':'TS','BASKET_STRAINER':'BS','DUPLEX_STRAINER':'DS',
            'SANITARY_STRAINER':'SS',
            'LEVEL_SWITCH_RANA':'LS','LEVEL_SWITCH':'LS',
            'PIPE_SHOE':'SH','U_BOLT':'UB','GUIDE':'GD','ANCHOR':'AN',
            'HANGER':'HG','SPRING_HANGER':'SH','PIPE_CLAMP':'PC',
            'EXPANSION_JOINT':'EJ','FLEXIBLE_HOSE':'HO','METALLIC_HOSE':'HM','PTFE_HOSE':'HP',
            'NIPPLE':'NI','STUB_END':'SE','STUB_END_PPR':'SE','STUB_END_HDPE':'SE',
            'CAMLOCK':'CM','CAMLOCK_MALE':'CM','CAMLOCK_FEMALE':'CF',
            'QUICK_CONNECT':'QC',
            'STEAM_TRAP':'ST','STEAM_TRAP_THERMODYNAMIC':'ST','STEAM_TRAP_FLOAT':'ST','STEAM_TRAP_BUCKET':'ST',
            'STEAM_TRAP_SANITARY':'ST',
            'SILENCER':'SI','VENT_SILENCER':'VS',
            'FLAME_ARRESTER':'FA','DETONATION_ARRESTER':'DA',
            'VACUUM_BREAKER':'VB',
            'DRAIN_VALVE':'DV','AIR_RELEASE':'AR','AIR_RELEASE_VALVE':'AR',
            'SAMPLE_COOLER':'SC','SAMPLE_VALVE':'SV','SAMPLE_VALVE_SANITARY':'SV',
            'PISTON_SAMPLE_VALVE':'PS',
            'PLUG_VALVE':'PV','CHOKE_VALVE':'CH','CRYOGENIC_VALVE':'CV',
            'INSULATING_JOINT':'IJ','SPECTACLE_BLIND':'SB','RUPTURE_DISC':'RD',
            'SPRAY_BALL':'SB','STATIC_MIXER':'SM',
            'AIR_DIFFUSER':'AD','CHLORINE_EJECTOR':'CE','CHEMICAL_INJECTOR':'CI',
            'PRESSURE_SAFETY_VALVE':'PS','ASEPTIC_VALVE':'AV',
            'CHECK_VALVE_SANITARY':'CK','SANITARY_CHECK_VALVE':'CK',
            'SIGHT_GLASS':'SG','SIGHT_GLASS_SANITARY':'SG',
            'ROTAMETER':'RO','ROTAMETRO':'RO',
            'FLOW_METER_MAG':'FM','CORIOLIS_METER':'CM',
            'PRESSURE_GAUGE_SANITARY':'PG',
            'MAGNETIC_DRIVE_PUMP':'MP','LOOSE_FLANGE':'BL'
        };
        return abbrMap[compType] || compType?.substring(0,2)?.toUpperCase() || '??';
    }

    function isPointInCylinder(p, eq) {
        const dx = p.x - eq.posX, dz = p.z - eq.posZ;
        const radius = eq.diametro / 2;
        if (dx*dx + dz*dz > radius*radius) return false;
        const halfH = eq.altura / 2;
        return p.y >= eq.posY - halfH && p.y <= eq.posY + halfH;
    }
    function isPointInHorizontalCylinder(p, eq) {
        const dx = p.x - eq.posX; const halfL = eq.largo / 2;
        if (Math.abs(dx) > halfL) return false;
        const dy = p.y - eq.posY, dz = p.z - eq.posZ;
        const radius = eq.diametro / 2;
        return dy*dy + dz*dz <= radius*radius;
    }
    function isPointInBox(p, eq) {
        const halfL = (eq.largo || 1000) / 2, halfW = (eq.ancho || eq.diametro || 1000) / 2, halfH = (eq.altura || 1000) / 2;
        return Math.abs(p.x - eq.posX) <= halfL && Math.abs(p.y - eq.posY) <= halfH && Math.abs(p.z - eq.posZ) <= halfW;
    }
    function pointToSegmentDistance(p, a, b) {
        const ax = p.x - a.x, ay = p.y - a.y, bx = b.x - a.x, by = b.y - a.y;
        const dot = ax * bx + ay * by, len2 = bx * bx + by * by;
        if (len2 === 0) return Math.hypot(ax, ay);
        let t = Math.max(0, Math.min(1, dot / len2));
        return Math.hypot(p.x - (a.x + t * bx), p.y - (a.y + t * by));
    }

    function drawGrid(elevation = 0) {
        const step = 1000, minX = -10000, maxX = 20000, minZ = -10000, maxZ = 20000;
        _ctx.beginPath(); _ctx.strokeStyle = '#1e293b'; _ctx.lineWidth = 1; _ctx.globalAlpha = 0.15;
        for (let x = minX; x <= maxX; x += step) {
            const p1 = project({ x, y: elevation, z: minZ }), p2 = project({ x, y: elevation, z: maxZ });
            _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y);
        }
        for (let z = minZ; z <= maxZ; z += step) {
            const p1 = project({ x: minX, y: elevation, z }), p2 = project({ x: maxX, y: elevation, z });
            _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y);
        }
        _ctx.stroke(); _ctx.globalAlpha = 1.0;
    }

    function drawOrigin() {
        const o = project({ x: 0, y: _currentElevation, z: 0 });
        _ctx.beginPath(); _ctx.moveTo(o.x - 20, o.y); _ctx.lineTo(o.x + 20, o.y);
        _ctx.moveTo(o.x, o.y - 20); _ctx.lineTo(o.x, o.y + 20);
        _ctx.strokeStyle = '#ff8888'; _ctx.lineWidth = 2; _ctx.stroke();
        _ctx.fillStyle = '#ff8888'; _ctx.font = '14px monospace';
        _ctx.fillText(`ORIGEN (0,${_currentElevation/1000}m,0)`, o.x + 15, o.y - 8);
    }

    function drawTank(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const r = (eq.diametro / 2) * _cam.scale, h = eq.altura * _cam.scale;
        const topY = p.y - h/2, bottomY = p.y + h/2;
        const material = (eq.material || '').toUpperCase();
        const esPlastico = material.includes('PE') || material.includes('PPR') || material.includes('HDPE') || material.includes('POLIETILENO');
        _ctx.save(); _ctx.fillStyle = 'rgba(0,0,0,0.25)'; _ctx.beginPath();
        _ctx.ellipse(p.x + 6, bottomY + 4, r + 6, (r + 6) * 0.5, 0, 0, 2 * Math.PI); _ctx.fill(); _ctx.restore();
        if (esPlastico) {
            const baseColor = material.includes('HDPE') || material.includes('PE100') ? '#1a1a1a' : (material.includes('PPR') ? '#10b981' : '#7c3aed');
            const bodyGrad = _ctx.createLinearGradient(p.x - r, 0, p.x + r, 0);
            bodyGrad.addColorStop(0, adjustColor(baseColor, -20)); bodyGrad.addColorStop(0.3, baseColor);
            bodyGrad.addColorStop(0.7, adjustColor(baseColor, 15)); bodyGrad.addColorStop(1, adjustColor(baseColor, -15));
            _ctx.fillStyle = bodyGrad; _ctx.fillRect(p.x - r, topY, r * 2, h);
            _ctx.fillStyle = 'rgba(255,255,255,0.06)'; _ctx.fillRect(p.x - r, topY, r * 2, h * 0.6);
            _ctx.strokeStyle = adjustColor(baseColor, -10); _ctx.lineWidth = 1.5;
            for (let ny = topY + h * 0.2; ny < bottomY; ny += h * 0.2) {
                _ctx.beginPath(); _ctx.moveTo(p.x - r, ny); _ctx.lineTo(p.x + r, ny); _ctx.stroke();
            }
            _ctx.beginPath(); _ctx.ellipse(p.x, topY, r, r * 0.4, 0, 0, 2 * Math.PI);
            _ctx.fillStyle = adjustColor(baseColor, 20); _ctx.fill(); _ctx.strokeStyle = adjustColor(baseColor, -10); _ctx.stroke();
            _ctx.beginPath(); _ctx.ellipse(p.x, bottomY, r, r * 0.5, 0, 0, 2 * Math.PI);
            _ctx.fillStyle = adjustColor(baseColor, -15); _ctx.fill(); _ctx.stroke();
        } else {
            const bodyGrad = _ctx.createLinearGradient(p.x - r, 0, p.x + r, 0);
            bodyGrad.addColorStop(0, '#1e3a5f'); bodyGrad.addColorStop(0.2, '#2563eb');
            bodyGrad.addColorStop(0.5, '#3b82f6'); bodyGrad.addColorStop(0.8, '#2563eb'); bodyGrad.addColorStop(1, '#1e3a5f');
            _ctx.fillStyle = bodyGrad; _ctx.fillRect(p.x - r, topY, r * 2, h);
            _ctx.fillStyle = 'rgba(255,255,255,0.08)'; _ctx.fillRect(p.x - r * 0.3, topY, r * 0.2, h);
            _ctx.strokeStyle = '#94a3b8'; _ctx.lineWidth = 1; _ctx.globalAlpha = 0.4;
            for (let sy = topY + h * 0.25; sy < bottomY; sy += h * 0.25) {
                _ctx.beginPath(); _ctx.moveTo(p.x - r, sy); _ctx.lineTo(p.x + r, sy); _ctx.stroke();
            }
            _ctx.globalAlpha = 1;
            _ctx.beginPath(); _ctx.ellipse(p.x, topY, r, r * 0.45, 0, 0, 2 * Math.PI);
            _ctx.fillStyle = '#60a5fa'; _ctx.fill(); _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 1.5; _ctx.stroke();
            _ctx.fillStyle = '#475569'; _ctx.fillRect(p.x - 2, topY - 12 * _cam.scale, 4, 12 * _cam.scale);
            _ctx.beginPath(); _ctx.ellipse(p.x, bottomY, r + 6, (r + 6) * 0.5, 0, 0, 2 * Math.PI);
            _ctx.fillStyle = '#1e3a5f'; _ctx.fill(); _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 1; _ctx.stroke();
            _ctx.strokeStyle = '#475569'; _ctx.lineWidth = 2;
            for (let ay = topY + h * 0.3; ay < bottomY - h * 0.1; ay += h * 0.25) {
                _ctx.beginPath(); _ctx.moveTo(p.x - r - 4, ay); _ctx.lineTo(p.x + r + 4, ay); _ctx.stroke();
            }
        }
        drawIsoText(eq.tag, p.x, topY - 15 * _cam.scale, 'XY');
        drawPuertos(eq);
        if (eq.accessories) eq.accessories.forEach(acc => drawAccessory(acc, eq));
    }

    function drawBomba(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const s = 20 * _cam.scale;
        const material = (eq.material || '').toUpperCase();
        const esAcero = material.includes('ACERO') || material.includes('CS') || material.includes('STEEL');
        _ctx.save(); _ctx.fillStyle = 'rgba(0,0,0,0.25)'; _ctx.beginPath();
        _ctx.ellipse(p.x + 4, p.y + s * 0.3 + 4, s * 1.2, s * 0.5, 0, 0, 2 * Math.PI); _ctx.fill(); _ctx.restore();
        _ctx.fillStyle = esAcero ? '#4b5563' : '#374151';
        _ctx.fillRect(p.x - s * 1.5, p.y + s * 0.1, s * 3, s * 0.25);
        _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 1; _ctx.strokeRect(p.x - s * 1.5, p.y + s * 0.1, s * 3, s * 0.25);
        _ctx.fillStyle = '#c0c0c0';
        [[-1.2, -0.4], [1.2, -0.4], [1.2, 0.4], [-1.2, 0.4]].forEach(([dx, dz]) => {
            const boltPos = project({ x: eq.posX + dx * 500, y: eq.posY - 200, z: eq.posZ + dz * 500 });
            _ctx.beginPath(); _ctx.arc(boltPos.x, boltPos.y, 3, 0, 2 * Math.PI); _ctx.fill(); _ctx.strokeStyle = '#888'; _ctx.stroke();
        });
        const casingGrad = _ctx.createRadialGradient(p.x - 2, p.y - 2, 2, p.x, p.y, s * 0.8);
        casingGrad.addColorStop(0, esAcero ? '#f59e0b' : '#fbbf24'); casingGrad.addColorStop(0.6, esAcero ? '#d97706' : '#f59e0b'); casingGrad.addColorStop(1, '#92400e');
        _ctx.beginPath(); _ctx.arc(p.x, p.y, s * 0.8, 0, 2 * Math.PI); _ctx.fillStyle = casingGrad; _ctx.fill();
        _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 2; _ctx.stroke();
        _ctx.fillStyle = '#64748b'; _ctx.fillRect(p.x - s * 1.2, p.y - s * 0.2, s * 0.5, s * 0.4);
        _ctx.strokeStyle = '#fff'; _ctx.strokeRect(p.x - s * 1.2, p.y - s * 0.2, s * 0.5, s * 0.4);
        _ctx.fillStyle = '#64748b'; _ctx.fillRect(p.x - s * 0.25, p.y - s * 1.1, s * 0.5, s * 0.35);
        _ctx.strokeStyle = '#fff'; _ctx.strokeRect(p.x - s * 0.25, p.y - s * 1.1, s * 0.5, s * 0.35);
        const motorGrad = _ctx.createLinearGradient(p.x + s * 0.8, 0, p.x + s * 1.8, 0);
        motorGrad.addColorStop(0, '#4b5563'); motorGrad.addColorStop(0.5, '#6b7280'); motorGrad.addColorStop(1, '#374151');
        _ctx.fillStyle = motorGrad; _ctx.fillRect(p.x + s * 0.8, p.y - s * 0.5, s * 1.2, s * 1.0);
        _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 1.5; _ctx.strokeRect(p.x + s * 0.8, p.y - s * 0.5, s * 1.2, s * 1.0);
        _ctx.strokeStyle = '#1f2937'; _ctx.lineWidth = 1;
        for (let af = 0; af < 5; af++) {
            const finY = p.y - s * 0.3 + af * s * 0.18;
            _ctx.beginPath(); _ctx.moveTo(p.x + s * 0.8, finY); _ctx.lineTo(p.x + s * 2.0, finY); _ctx.stroke();
        }
        _ctx.strokeStyle = '#c0c0c0'; _ctx.lineWidth = 3;
        _ctx.beginPath(); _ctx.moveTo(p.x + s * 0.3, p.y); _ctx.lineTo(p.x + s * 0.8, p.y); _ctx.stroke();
        _ctx.fillStyle = '#374151'; _ctx.fillRect(p.x + s * 0.45, p.y - s * 0.15, s * 0.25, s * 0.3);
        _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 1; _ctx.strokeRect(p.x + s * 0.45, p.y - s * 0.15, s * 0.25, s * 0.3);
        _ctx.strokeStyle = '#f59e0b'; _ctx.lineWidth = 1.5; _ctx.strokeRect(p.x + s * 0.4, p.y - s * 0.2, s * 0.35, s * 0.4);
        drawIsoText(eq.tag, p.x, p.y - s * 1.5, 'XY');
        drawPuertos(eq);
    }

    function drawPlataforma(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const w = (eq.largo || 6000) * _cam.scale / 2, d = (eq.ancho || 3000) * _cam.scale / 2, h = (eq.altura || 400) * _cam.scale;
        const material = (eq.material || '').toUpperCase();
        const esConcreto = material.includes('CONCRETO') || material.includes('CEMENTO') || material.includes('HORMIGON');
        const esAcero = material.includes('ACERO') || material.includes('STEEL') || material.includes('METAL') || material.includes('CS');
        const topY = p.y - h;
        _ctx.save(); _ctx.fillStyle = 'rgba(0,0,0,0.2)'; _ctx.beginPath();
        _ctx.moveTo(p.x - w + 4, topY + h + 6); _ctx.lineTo(p.x - w + d * 0.5 + 4, topY + h - d * 0.25 + 6);
        _ctx.lineTo(p.x + d * 0.5 + 4, topY + h - d * 0.25 + 6); _ctx.lineTo(p.x + w + 4, topY + h + 6);
        _ctx.lineTo(p.x + d * 0.5 + 4, topY + h + d * 0.25 + 6); _ctx.lineTo(p.x - w + d * 0.5 + 4, topY + h + d * 0.25 + 6);
        _ctx.closePath(); _ctx.fill(); _ctx.restore();
        if (esAcero) {
            const grad = _ctx.createLinearGradient(p.x - w, topY, p.x + w, topY);
            grad.addColorStop(0, '#4b5563'); grad.addColorStop(0.3, '#9ca3af'); grad.addColorStop(0.5, '#d1d5db');
            grad.addColorStop(0.7, '#9ca3af'); grad.addColorStop(1, '#4b5563');
            _ctx.fillStyle = grad;
        } else { _ctx.fillStyle = esConcreto ? '#9ca3af' : '#6b7280'; }
        _ctx.strokeStyle = esConcreto ? '#6b7280' : '#4b5563'; _ctx.lineWidth = 1.5; _ctx.beginPath();
        _ctx.moveTo(p.x - w, topY); _ctx.lineTo(p.x - w + d * 0.5, topY - d * 0.25);
        _ctx.lineTo(p.x + d * 0.5, topY - d * 0.25); _ctx.lineTo(p.x + w, topY);
        _ctx.lineTo(p.x + d * 0.5, topY + d * 0.25); _ctx.lineTo(p.x - w + d * 0.5, topY + d * 0.25);
        _ctx.closePath(); _ctx.fill(); _ctx.stroke();
        if (esAcero && _cam.scale > 0.15) {
            _ctx.strokeStyle = '#374151'; _ctx.lineWidth = 0.5;
            const panelSize = 2000 * _cam.scale, panelesX = Math.floor(w * 2 / panelSize);
            for (let i = 1; i < panelesX; i++) {
                const offX = -w + i * panelSize;
                const p1 = project({ x: p.x + offX, y: topY, z: eq.posZ - (eq.ancho || 3000) / 2 });
                const p2 = project({ x: p.x + offX, y: topY, z: eq.posZ + (eq.ancho || 3000) / 2 });
                _ctx.beginPath(); _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y); _ctx.stroke();
            }
        }
        if (esConcreto && _cam.scale > 0.2) {
            _ctx.strokeStyle = '#4b5563'; _ctx.lineWidth = 0.8;
            for (let jx = -w + 400 * _cam.scale; jx < w - 200 * _cam.scale; jx += 500 * _cam.scale) {
                _ctx.beginPath(); _ctx.moveTo(p.x + jx, topY - d * 0.2); _ctx.lineTo(p.x + jx, topY + d * 0.2); _ctx.stroke();
            }
        }
        _ctx.strokeStyle = esConcreto ? '#6b7280' : '#4b5563'; _ctx.lineWidth = 1.5;
        const patas = [
            { x: eq.posX - (eq.largo || 6000) / 2, z: eq.posZ - (eq.ancho || 3000) / 2 },
            { x: eq.posX + (eq.largo || 6000) / 2, z: eq.posZ - (eq.ancho || 3000) / 2 },
            { x: eq.posX + (eq.largo || 6000) / 2, z: eq.posZ + (eq.ancho || 3000) / 2 },
            { x: eq.posX - (eq.largo || 6000) / 2, z: eq.posZ + (eq.ancho || 3000) / 2 }
        ];
        patas.forEach(pta => {
            const top = project({ x: pta.x, y: eq.posY - (eq.altura || 400), z: pta.z });
            const bot = project({ x: pta.x, y: eq.posY, z: pta.z });
            _ctx.beginPath(); _ctx.moveTo(top.x, top.y); _ctx.lineTo(bot.x, bot.y); _ctx.stroke();
            const ps = 6 * _cam.scale;
            _ctx.fillStyle = esConcreto ? '#78716c' : '#374151';
            _ctx.fillRect(bot.x - ps, bot.y - ps/2, ps * 2, ps); _ctx.strokeRect(bot.x - ps, bot.y - ps/2, ps * 2, ps);
        });
        if (esAcero && _cam.scale > 0.2) {
            _ctx.strokeStyle = '#374151'; _ctx.lineWidth = 1; _ctx.setLineDash([3, 3]);
            for (let si = 0; si < 2; si++) {
                const side = si === 0 ? -1 : 1;
                const top1 = project({ x: eq.posX - (eq.largo || 6000) / 2, y: eq.posY - (eq.altura || 400), z: eq.posZ + side * (eq.ancho || 3000) / 2 });
                const bot2 = project({ x: eq.posX + (eq.largo || 6000) / 2, y: eq.posY, z: eq.posZ - side * (eq.ancho || 3000) / 2 });
                _ctx.beginPath(); _ctx.moveTo(top1.x, top1.y); _ctx.lineTo(bot2.x, bot2.y); _ctx.stroke();
            }
            _ctx.setLineDash([]);
        }
        if (eq.baranda !== false && _cam.scale > 0.12) {
            _ctx.strokeStyle = esConcreto ? '#d1d5db' : '#f59e0b'; _ctx.lineWidth = 0.8;
            const esquinas = [
                { x: eq.posX - (eq.largo || 6000) / 2, z: eq.posZ - (eq.ancho || 3000) / 2 },
                { x: eq.posX + (eq.largo || 6000) / 2, z: eq.posZ - (eq.ancho || 3000) / 2 },
                { x: eq.posX + (eq.largo || 6000) / 2, z: eq.posZ + (eq.ancho || 3000) / 2 },
                { x: eq.posX - (eq.largo || 6000) / 2, z: eq.posZ + (eq.ancho || 3000) / 2 }
            ];
            const barH = 1100;
            for (let i = 0; i < esquinas.length; i++) {
                const a = esquinas[i], b = esquinas[(i + 1) % esquinas.length];
                const pa = project({ x: a.x, y: eq.posY - (eq.altura || 400), z: a.z });
                const pb = project({ x: b.x, y: eq.posY - (eq.altura || 400), z: b.z });
                const pATop = project({ x: a.x, y: eq.posY - (eq.altura || 400) - barH, z: a.z });
                const pBTop = project({ x: b.x, y: eq.posY - (eq.altura || 400) - barH, z: b.z });
                _ctx.beginPath(); _ctx.moveTo(pATop.x, pATop.y); _ctx.lineTo(pBTop.x, pBTop.y); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(pa.x, pa.y); _ctx.lineTo(pATop.x, pATop.y); _ctx.stroke();
                const pAMid = project({ x: a.x, y: eq.posY - (eq.altura || 400) - barH/2, z: a.z });
                const pBMid = project({ x: b.x, y: eq.posY - (eq.altura || 400) - barH/2, z: b.z });
                _ctx.beginPath(); _ctx.moveTo(pAMid.x, pAMid.y); _ctx.lineTo(pBMid.x, pBMid.y); _ctx.stroke();
            }
        }
        drawIsoText(eq.tag, p.x, topY - 30 * _cam.scale, 'XY');
    }

    function drawRectEquip(eq, color) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const w = (eq.largo || eq.diametro || 1000) * _cam.scale / 2, h = (eq.altura || 1000) * _cam.scale / 2;
        _ctx.save(); _ctx.fillStyle = 'rgba(0,0,0,0.2)'; _ctx.fillRect(p.x - w + 4, p.y + h + 2, w * 2, h * 0.3); _ctx.restore();
        const grad = _ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
        grad.addColorStop(0, adjustColor(color, -15)); grad.addColorStop(0.3, color);
        grad.addColorStop(0.7, adjustColor(color, 10)); grad.addColorStop(1, adjustColor(color, -10));
        _ctx.fillStyle = grad; _ctx.fillRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.strokeStyle = 'white'; _ctx.lineWidth = 1.5; _ctx.strokeRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.fillStyle = 'rgba(255,255,255,0.07)'; _ctx.fillRect(p.x - w * 0.7, p.y - h, w * 0.2, h * 2);
        if (eq.tipo === 'intercambiador' || eq.tipo === 'caldera') {
            _ctx.strokeStyle = '#94a3b8'; _ctx.lineWidth = 1; _ctx.globalAlpha = 0.5;
            for (let ty = p.y - h * 0.6; ty <= p.y + h * 0.6; ty += h * 0.3) {
                _ctx.beginPath(); _ctx.moveTo(p.x - w * 0.8, ty); _ctx.lineTo(p.x + w * 0.8, ty); _ctx.stroke();
            }
            _ctx.globalAlpha = 1;
        }
        drawIsoText(eq.tag, p.x, p.y - h - 5, 'XY');
        drawPuertos(eq);
    }

    function drawCilindroHorizontal(eq, color) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const w = (eq.largo || eq.diametro) * _cam.scale / 2, h = (eq.diametro / 2) * _cam.scale;
        const esMetal = !(eq.material || '').toUpperCase().includes('PE') && !(eq.material || '').toUpperCase().includes('PPR');
        _ctx.save(); _ctx.fillStyle = 'rgba(0,0,0,0.2)'; _ctx.fillRect(p.x - w + 4, p.y + h + 2, w * 2, h * 0.4); _ctx.restore();
        const bodyGrad = _ctx.createLinearGradient(p.x, p.y - h, p.x, p.y + h);
        bodyGrad.addColorStop(0, adjustColor(color, 15)); bodyGrad.addColorStop(0.3, color);
        bodyGrad.addColorStop(0.7, adjustColor(color, -10)); bodyGrad.addColorStop(1, adjustColor(color, -20));
        _ctx.fillStyle = bodyGrad; _ctx.fillRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.strokeStyle = 'white'; _ctx.lineWidth = 1.5; _ctx.strokeRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.beginPath(); _ctx.ellipse(p.x - w, p.y, h, h * 0.5, 0, 0, 2 * Math.PI);
        _ctx.fillStyle = adjustColor(color, 10); _ctx.fill(); _ctx.stroke();
        _ctx.beginPath(); _ctx.ellipse(p.x + w, p.y, h, h * 0.5, 0, 0, 2 * Math.PI);
        _ctx.fillStyle = adjustColor(color, 10); _ctx.fill(); _ctx.stroke();
        if (esMetal && _cam.scale > 0.2) {
            _ctx.strokeStyle = '#94a3b8'; _ctx.lineWidth = 1; _ctx.globalAlpha = 0.5;
            _ctx.beginPath(); _ctx.moveTo(p.x - w, p.y - h); _ctx.lineTo(p.x - w, p.y + h); _ctx.stroke();
            _ctx.beginPath(); _ctx.moveTo(p.x + w, p.y - h); _ctx.lineTo(p.x + w, p.y + h); _ctx.stroke();
            _ctx.globalAlpha = 1;
        }
        drawIsoText(eq.tag, p.x, p.y - h - 5, 'XY');
        drawPuertos(eq);
    }

    function drawAccessory(acc, parentEq) {
        const pos = { x: parentEq.posX + (acc.relX || 0), y: parentEq.posY + (acc.relY || 0), z: parentEq.posZ + (acc.relZ || 0) };
        const proj = project(pos);
        _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 1; _ctx.setLineDash([4, 4]); _ctx.beginPath();
        if (acc.type === 'CAGED_LADDER') { _ctx.moveTo(proj.x, proj.y); _ctx.lineTo(proj.x, proj.y - 40 * _cam.scale); }
        _ctx.stroke(); _ctx.setLineDash([]);
    }

    function drawPuertos(obj) {
        if (!obj.puertos) return;
        const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ } : (obj._cachedPoints && obj._cachedPoints.length > 0 ? obj._cachedPoints[0] : { x: 0, y: 0, z: 0 });
        obj.puertos.forEach(nz => {
            const pos = { x: posBase.x + (nz.relX || 0), y: posBase.y + (nz.relY || 0), z: posBase.z + (nz.relZ || 0) };
            const proj = project(pos);
            if (nz.orientacion) {
                const dir = nz.orientacion;
                const endPos = { x: pos.x + dir.dx * 250, y: pos.y + dir.dy * 250, z: pos.z + dir.dz * 250 };
                const projEnd = project(endPos);
                _ctx.beginPath(); _ctx.moveTo(proj.x, proj.y); _ctx.lineTo(projEnd.x, projEnd.y);
                _ctx.strokeStyle = '#ffaa00'; _ctx.lineWidth = 2; _ctx.stroke();
                const angle = Math.atan2(projEnd.y - proj.y, projEnd.x - proj.x), arrowSize = 8;
                _ctx.beginPath(); _ctx.moveTo(projEnd.x, projEnd.y);
                _ctx.lineTo(projEnd.x - arrowSize * Math.cos(angle - 0.5), projEnd.y - arrowSize * Math.sin(angle - 0.5));
                _ctx.lineTo(projEnd.x - arrowSize * Math.cos(angle + 0.5), projEnd.y - arrowSize * Math.sin(angle + 0.5));
                _ctx.closePath(); _ctx.fillStyle = '#ffaa00'; _ctx.fill();
            }
            _ctx.beginPath(); _ctx.arc(proj.x, proj.y, 6, 0, 2 * Math.PI);
            _ctx.fillStyle = nz.connectedLine ? '#4ade80' : '#ff8800'; _ctx.fill();
            _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 1; _ctx.stroke();
            drawIsoText(`${nz.id} ${nz.diametro || obj.diameter || 3}"`, proj.x - 12, proj.y - 6, 'XY');
        });
    }

    function drawNozzleTag(proj2D, nozzle, parentEq) {
        if (!AnnotationManager.isVisible(2)) return;
        const diam = nozzle.diametro || parentEq.diametro || '?';
        const elevation = nozzle.elevation || (parentEq.posY + (nozzle.relY || 0));
        const label = `${nozzle.id} ${diam}" – EL ${elevation}`;
        const plane = (nozzle.orientacion && Math.abs(nozzle.orientacion.dx) > Math.abs(nozzle.orientacion.dz)) ? 'LEFT' : 'RIGHT';
        const prefX = proj2D.x + 35, prefY = proj2D.y - 25;
        const box = AnnotationManager.register({ x: prefX, y: prefY - 10, w: 110, h: 22 }, 2);
        _ctx.save(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.strokeStyle = '#f59e0b'; _ctx.lineWidth = 1; _ctx.beginPath();
        _ctx.moveTo(proj2D.x, proj2D.y); _ctx.lineTo(box.x, box.y + 11); _ctx.stroke(); _ctx.restore();
        _ctx.save();
        if (plane === 'LEFT') _ctx.setTransform(1, 0.5, 0, 1, box.x, box.y + 11);
        else _ctx.setTransform(1, -0.5, 0, 1, box.x, box.y + 11);
        _ctx.font = 'bold 10px "Courier New", monospace'; _ctx.fillStyle = '#ffffff';
        _ctx.textAlign = 'left'; _ctx.textBaseline = 'middle'; _ctx.fillText(label, 0, 0);
        _ctx.restore(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawIsoText(text, x, y, plane = 'XY') {
        if (!text) return;
        _ctx.save();
        _ctx.font = `bold ${Math.max(12, 14 * _cam.scale)}px 'Segoe UI', monospace`;
        _ctx.textAlign = 'center'; _ctx.textBaseline = 'bottom';
        if (plane === 'XY') { _ctx.setTransform(1, 0.5, 0, 1, x, y); }
        else if (plane === 'ZY') { _ctx.setTransform(1, -0.5, 0, 1, x, y); }
        else { _ctx.setTransform(1, -0.5, 1, 0.5, x, y); }
        const tw = _ctx.measureText(text).width;
        _ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'; _ctx.fillRect(-tw/2 - 6, -16, tw + 12, 20);
        _ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)'; _ctx.lineWidth = 1; _ctx.strokeRect(-tw/2 - 6, -16, tw + 12, 20);
        if (_cam.scale < 0.3) { _ctx.globalAlpha = 0.12; }
        else if (_cam.scale < 0.7) { _ctx.globalAlpha = 0.18 + (_cam.scale - 0.3) * 1.3; }
        else { _ctx.globalAlpha = 0.65; }
        _ctx.fillStyle = '#ffffff'; _ctx.fillText(text, 0, 0);
        _ctx.globalAlpha = 1.0; _ctx.restore(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawFlowArrow(p1, p2, diameter) {
        if (!p1 || !p2) return;
        const proj1 = project(p1), proj2 = project(p2);
        const angle = Math.atan2(proj2.y - proj1.y, proj2.x - proj1.x);
        const midX = (proj1.x + proj2.x) / 2, midY = (proj1.y + proj2.y) / 2;
        _ctx.save(); _ctx.translate(midX, midY); _ctx.rotate(angle);
        const arrowSize = 12 * _cam.scale;
        _ctx.beginPath(); _ctx.moveTo(-arrowSize, -arrowSize/2); _ctx.lineTo(0, 0); _ctx.lineTo(-arrowSize, arrowSize/2);
        _ctx.fillStyle = '#00f2ff'; _ctx.shadowColor = '#00f2ff'; _ctx.shadowBlur = 8;
        _ctx.fill(); _ctx.shadowBlur = 0; _ctx.restore();
    }

    function getPointAtDistance(from, to, dist) {
        const d = Math.hypot(to.x-from.x, to.y-from.y, to.z-from.z);
        if (d === 0) return { ...from };
        const t = Math.min(dist/d, 0.5);
        return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t };
    }

    function getSegmentDirection3D(p1, p2) {
        const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
        const absX = Math.abs(dx), absY = Math.abs(dy), absZ = Math.abs(dz);
        if (absY > absX && absY > absZ) return 'Y';
        return absX >= absZ ? 'X' : 'Z';
    }

    function getPipeOrientation(p1, p2) {
        const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y), dz = Math.abs(p2.z - p1.z);
        return (dy > dx && dy > dz) ? 'vertical' : 'horizontal';
    }

    function isPointCollidingWithEquipment(point, margin = 1500) {
        if (!_core) return false;
        const db = _core.getDb(); if (!db || !db.equipos) return false;
        return db.equipos.some(eq => {
            if (eq.tipo === 'tanque_v' || eq.tipo === 'torre' || eq.tipo === 'reactor') {
                const dx = Math.abs(point.x - eq.posX), dz = Math.abs(point.z - eq.posZ);
                return (dx <= (eq.diametro/2)+margin && dz <= (eq.diametro/2)+margin);
            } else if (eq.tipo === 'tanque_h') {
                const hl = (eq.largo/2)+margin, hd = (eq.diametro/2)+margin;
                return Math.abs(point.x-eq.posX)<=hl && Math.abs(point.z-eq.posZ)<=hd;
            } else {
                const hl = ((eq.largo||1000)/2)+margin, hw = ((eq.ancho||eq.diametro||1000)/2)+margin;
                return Math.abs(point.x-eq.posX)<=hl && Math.abs(point.z-eq.posZ)<=hw;
            }
        });
    }

    function lineHasAuditError(line) {
        if (!_core) return false;
        if (line.origin && line.origin.objTag) {
            const obj = _core.findObjectByTag(line.origin.objTag);
            const nz = obj?.puertos?.find(p => p.id === line.origin.portId);
            if (nz && nz.diametro !== line.diameter) return true;
        }
        if (line.destination && line.destination.objTag) {
            const obj = _core.findObjectByTag(line.destination.objTag);
            const nz = obj?.puertos?.find(p => p.id === line.destination.portId);
            if (nz && nz.diametro !== line.diameter) return true;
        }
        return false;
    }

    function drawPipeWithElbows(line) {
        const originalPts = _core ? _core.getLinePoints(line) : (line._cachedPoints || line.points3D);
        if (!originalPts || originalPts.length < 2) return;
        const pts = originalPts.map((p) => ({ ...p }));
        if (line.origin && _core) {
            const obj = _core.findObjectByTag(line.origin.objTag);
            if (obj) {
                const puerto = obj.puertos?.find(p => p.id === line.origin.portId);
                if (puerto) {
                    const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ } : (obj._cachedPoints?.[0] || { x: 0, y: 0, z: 0 });
                    pts[0] = { x: posBase.x + (puerto.relX || 0), y: posBase.y + (puerto.relY || 0), z: posBase.z + (puerto.relZ || 0) };
                }
            }
        }
        if (line.destination && _core) {
            const obj = _core.findObjectByTag(line.destination.objTag);
            if (obj) {
                const puerto = obj.puertos?.find(p => p.id === line.destination.portId);
                if (puerto) {
                    const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ } : (obj._cachedPoints?.[0] || { x: 0, y: 0, z: 0 });
                    pts[pts.length - 1] = { x: posBase.x + (puerto.relX || 0), y: posBase.y + (puerto.relY || 0), z: posBase.z + (puerto.relZ || 0) };
                }
            }
        }
        const isPPR = line.material === 'PPR' || (line.spec && line.spec.includes('PPR'));
        const isCS = (line.material || '').toUpperCase().includes('CS') || (line.material || '').toUpperCase().includes('ACERO') || (line.spec || '').toUpperCase().includes('SCH');
        const radioBase = isPPR ? (line.diameter * 25.4 * 0.8) : (line.diameter * 25.4 * 1.5);
        const radio = Math.min(radioBase, 350);
        const baseWidth = (line.diameter || 4) * _cam.scale, mainWidth = Math.max(6, baseWidth);
        _ctx.lineCap = 'round'; _ctx.lineJoin = 'round';
        const hasAuditError = lineHasAuditError(line);
        const matShort = getShortMaterial(line.material);
        const lineLabel = line.service ? `${line.diameter}"-${line.service}` : `${line.diameter}"-${matShort}`;
        const drawPath = () => {
            _ctx.beginPath(); let first = project(pts[0]); _ctx.moveTo(first.x, first.y);
            for (let i = 1; i < pts.length - 1; i++) {
                const pPrev = pts[i-1], pCurr = pts[i], pNext = pts[i+1];
                if (pCurr.isControlPoint && i + 1 < pts.length) {
                    const cp = project(pCurr), nextP = project(pts[i+1]);
                    _ctx.quadraticCurveTo(cp.x, cp.y, nextP.x, nextP.y); i++;
                } else {
                    const pIn = getPointAtDistance(pCurr, pPrev, radio), pOut = getPointAtDistance(pCurr, pNext, radio);
                    const projIn = project(pIn), projOut = project(pOut), projCurr = project(pCurr);
                    _ctx.lineTo(projIn.x, projIn.y); _ctx.quadraticCurveTo(projCurr.x, projCurr.y, projOut.x, projOut.y);
                }
            }
            _ctx.lineTo(project(pts[pts.length-1]).x, project(pts[pts.length-1]).y);
        };
        const grad = getMaterialGradient(_ctx, pts[0], pts[pts.length-1], matShort, mainWidth*2);
        _ctx.save(); drawPath(); _ctx.shadowColor = '#00000066'; _ctx.shadowBlur = 14 * _cam.scale;
        _ctx.shadowOffsetX = 0; _ctx.shadowOffsetY = 8 * _cam.scale; _ctx.strokeStyle = '#00000044';
        _ctx.lineWidth = mainWidth + 10; _ctx.stroke(); _ctx.restore();
        drawPath(); _ctx.strokeStyle = '#0a0e17'; _ctx.lineWidth = mainWidth + 4; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = '#1e293b'; _ctx.lineWidth = mainWidth + 2; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = grad; _ctx.lineWidth = mainWidth; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = 'rgba(255,255,255,0.25)'; _ctx.lineWidth = mainWidth * 0.45; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = '#ffffff'; _ctx.lineWidth = Math.max(1.2, mainWidth * 0.12); _ctx.globalAlpha = 0.85; _ctx.stroke(); _ctx.globalAlpha = 1.0;
        if (isPPR && pts.length >= 2 && _cam.scale > 0.15) {
            const totalLen = pts.reduce((acc, p, i) => i > 0 ? acc + Math.hypot(p.x-pts[i-1].x, p.y-pts[i-1].y, p.z-pts[i-1].z) : 0, 0);
            const spacing = 1500, numRings = Math.floor(totalLen / spacing);
            for (let ri = 1; ri < numRings; ri++) {
                const targetDist = ri * spacing; let accum = 0;
                for (let si = 0; si < pts.length - 1; si++) {
                    const segLen = Math.hypot(pts[si+1].x-pts[si].x, pts[si+1].y-pts[si].y, pts[si+1].z-pts[si].z);
                    if (accum + segLen >= targetDist) {
                        const t = (targetDist - accum) / segLen;
                        const ringPos = { x: pts[si].x + (pts[si+1].x-pts[si].x)*t, y: pts[si].y + (pts[si+1].y-pts[si].y)*t, z: pts[si].z + (pts[si+1].z-pts[si].z)*t };
                        const projRing = project(ringPos);
                        _ctx.beginPath(); _ctx.arc(projRing.x, projRing.y, mainWidth * 1.1, 0, Math.PI * 2);
                        _ctx.fillStyle = '#065f46'; _ctx.fill(); _ctx.strokeStyle = '#034028'; _ctx.lineWidth = 1.5; _ctx.stroke();
                        break;
                    }
                    accum += segLen;
                }
            }
        }
        if (isCS && pts.length >= 2 && _cam.scale > 0.12) {
            const totalLen = pts.reduce((acc, p, i) => i > 0 ? acc + Math.hypot(p.x-pts[i-1].x, p.y-pts[i-1].y, p.z-pts[i-1].z) : 0, 0);
            const weldSpacing = 2000, numWelds = Math.floor(totalLen / weldSpacing);
            for (let wi = 1; wi < numWelds; wi++) {
                const targetDist = wi * weldSpacing; let accum = 0;
                for (let si = 0; si < pts.length - 1; si++) {
                    const segLen = Math.hypot(pts[si+1].x-pts[si].x, pts[si+1].y-pts[si].y, pts[si+1].z-pts[si].z);
                    if (accum + segLen >= targetDist) {
                        const t = (targetDist - accum) / segLen;
                        const weldPos = { x: pts[si].x + (pts[si+1].x-pts[si].x)*t, y: pts[si].y + (pts[si+1].y-pts[si].y)*t, z: pts[si].z + (pts[si+1].z-pts[si].z)*t };
                        const projWeld = project(weldPos);
                        _ctx.beginPath(); _ctx.arc(projWeld.x, projWeld.y, mainWidth * 1.05, 0, Math.PI * 2);
                        _ctx.strokeStyle = '#7a7a7a'; _ctx.lineWidth = 1; _ctx.globalAlpha = 0.6; _ctx.stroke(); _ctx.globalAlpha = 1;
                        break;
                    }
                    accum += segLen;
                }
            }
        }
        if (hasAuditError && pts.length >= 2) {
            const midIndex = Math.floor(pts.length / 2), alertPt = pts[midIndex], projAlert = project(alertPt);
            _ctx.save(); _ctx.translate(projAlert.x, projAlert.y - 30*_cam.scale);
            _ctx.font = `bold ${Math.max(16,20*_cam.scale)}px "Segoe UI"`; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
            _ctx.shadowColor = '#ef4444'; _ctx.shadowBlur = 10; _ctx.fillStyle = '#ef4444'; _ctx.fillText('⚠', 0, 0);
            _ctx.shadowBlur = 0; _ctx.restore();
        }
        const isSelected = _core && _core.getSelected() && _core.getSelected().obj === line;
        if (line.showDimensions !== false && !isSelected && AnnotationManager.isVisible(1)) {
            const puntosReales = pts.filter(p => !p.isControlPoint);
            for (let i = 0; i < puntosReales.length - 1; i++) {
                if (Math.hypot(puntosReales[i+1].x-puntosReales[i].x, puntosReales[i+1].y-puntosReales[i].y, puntosReales[i+1].z-puntosReales[i].z) > 100)
                    drawIsometricDimension(puntosReales[i], puntosReales[i+1], 1200);
            }
        }
        if (pts.length >= 2) drawFlowArrow(pts[0], pts[pts.length-1], line.diameter);
        if (lineLabel && pts.length >= 2 && AnnotationManager.isVisible(3)) {
            const midPt = getPointAtDistance(pts[0], pts[pts.length-1], Math.hypot(pts[pts.length-1].x-pts[0].x, pts[pts.length-1].y-pts[0].y, pts[pts.length-1].z-pts[0].z)/2);
            const projMid = project(midPt);
            drawIsoText(lineLabel, projMid.x, projMid.y - 25*_cam.scale, Math.abs(pts[1].x-pts[0].x) > Math.abs(pts[1].z-pts[0].z) ? 'XY' : 'ZY');
        }
        if (line.puertos) drawPuertos(line);
    }

    function drawPipeComponents(line) {
        if (!_core) return;
        const pts = _core.getLinePoints(line);
        if (!pts || pts.length < 2 || !line.components) return;
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) { let d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z); lengths.push(d); totalLen += d; }
        if (totalLen === 0) return;
        line.components.forEach((comp) => {
            let targetLen = totalLen * Math.min(1, Math.max(0, comp.param || 0.5));
            let currentAccum = 0, p1, p2, t = 0;
            for (let i = 0; i < lengths.length; i++) {
                if (currentAccum + lengths[i] >= targetLen || i === lengths.length - 1) { p1 = pts[i]; p2 = pts[i+1]; let segLen = lengths[i]; t = segLen > 0 ? (targetLen - currentAccum) / segLen : 0; t = Math.min(1, Math.max(0, t)); break; }
                currentAccum += lengths[i];
            }
            if (!p1 || !p2) return;
            const pos3D = { x: p1.x + (p2.x-p1.x)*t, y: p1.y + (p2.y-p1.y)*t, z: p1.z + (p2.z-p1.z)*t };
            const proj = project(pos3D), dir3D = getSegmentDirection3D(p1, p2);
            const isHovered = _hoveredComponent && _hoveredComponent.comp === comp;
            _ctx.save();
            if (isHovered) { _ctx.shadowColor = '#fbbf24'; _ctx.shadowBlur = 18; _ctx.globalAlpha = 1.0; }
            else { _ctx.shadowColor = 'transparent'; _ctx.shadowBlur = 0; _ctx.globalAlpha = 0.55; }
            drawSymbol(proj.x, proj.y, dir3D, comp);
            _ctx.restore();
            comp._screenPos = proj;
            if (AnnotationManager.isVisible(3)) {
                const globalIndex = _bomItems.length + 1;
                drawComponentTag(proj, globalIndex, comp.type, dir3D);
                comp._bomIndex = globalIndex;
                if (comp.type === 'STUB_END' || comp.type === 'STUB_END_PPR' || comp.type === 'STUB_END_HDPE') {
                    _bomItems.push({ index: globalIndex, desc: 'PORTABRIDA ' + (comp.type.includes('PPR')?'PPR':comp.type.includes('HDPE')?'HDPE':''), mat: getShortMaterial(line.material), comp: comp });
                    _bomItems.push({ index: globalIndex + 0.1, desc: 'BRIDA LOCA', mat: 'CS', comp: comp });
                } else {
                    _bomItems.push({ index: globalIndex, desc: getComponentLabel(comp.type), mat: getShortMaterial(line.material), comp: comp });
                }
            }
        });
    }

    function drawSymbol(x, y, dir3D, comp) {
        _ctx.save();
        const s = Math.max(12, 18 * _cam.scale);
        _ctx.lineWidth = 2;
        _ctx.strokeStyle = '#e2e8f0';
        _ctx.fillStyle = '#0f172a';

        if (dir3D === 'X') { _ctx.setTransform(1, 0.5, 0, 1, x, y); }
        else if (dir3D === 'Z') { _ctx.setTransform(1, -0.5, 0, 1, x, y); }
        else if (dir3D === 'Y') { _ctx.setTransform(0, 1, -1, 0, x, y); }

        switch (comp.type) {
            case 'BUTTERFLY_VALVE':
                _ctx.beginPath(); _ctx.ellipse(0, 0, s*0.9, s*0.35, 0, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(0,0); _ctx.lineTo(0, -s*1.6);
                _ctx.strokeStyle = '#ef4444'; _ctx.lineWidth = 3; _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(-s*0.8, -s*1.6); _ctx.lineTo(s*0.8, -s*1.6); _ctx.stroke();
                _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, -s*1.6, 4, 0, Math.PI*2); _ctx.fill();
                break;
            case 'BALL_VALVE': case 'VALVE_BALL':
                const ballGrad = _ctx.createRadialGradient(-s*0.15, -s*0.15, s*0.05, 0, 0, s*0.65);
                ballGrad.addColorStop(0, '#ffffff'); ballGrad.addColorStop(0.6, '#94a3b8'); ballGrad.addColorStop(1, '#1e293b');
                _ctx.beginPath(); _ctx.arc(0, 0, s*0.7, 0, Math.PI*2); _ctx.fillStyle = ballGrad; _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(-s, -s*0.55); _ctx.lineTo(-s, s*0.55); _ctx.lineTo(0, 0); _ctx.closePath();
                _ctx.moveTo(s, -s*0.55); _ctx.lineTo(s, s*0.55); _ctx.lineTo(0, 0); _ctx.closePath();
                _ctx.fillStyle = '#1e293b'; _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(0, -s*0.4); _ctx.lineTo(0, -s*1.3); _ctx.lineTo(s*0.7, -s*1.3);
                _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2.5; _ctx.stroke();
                _ctx.fillStyle = '#ef4444'; _ctx.beginPath(); _ctx.arc(s*0.7, -s*1.3, s*0.12, 0, Math.PI*2); _ctx.fill();
                break;
            case 'GATE_VALVE':
                _ctx.beginPath(); _ctx.moveTo(-s, -s*0.6); _ctx.lineTo(s, s*0.6); _ctx.lineTo(s, -s*0.6); _ctx.lineTo(-s, s*0.6); _ctx.closePath();
                _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(0, 0); _ctx.lineTo(0, -s*1.5);
                _ctx.moveTo(-s*0.6, -s*1.5); _ctx.lineTo(s*0.6, -s*1.5); _ctx.stroke();
                _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, -s*1.5, 4, 0, Math.PI*2); _ctx.fill();
                break;
            case 'GLOBE_VALVE':
                _ctx.beginPath(); _ctx.ellipse(0, 0, s*0.9, s*0.6, 0, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                _ctx.fillStyle = '#1e293b'; _ctx.fillRect(-s*0.35, -s*1.3, s*0.7, s*0.6);
                _ctx.strokeRect(-s*0.35, -s*1.3, s*0.7, s*0.6);
                break;
            case 'CHECK_VALVE': case 'CHECK_VALVE_SANITARY': case 'SANITARY_CHECK_VALVE':
                _ctx.strokeRect(-s, -s*0.5, s*2, s*1.0);
                _ctx.fillStyle = '#4ade80'; _ctx.beginPath();
                _ctx.moveTo(-s*0.5, 0); _ctx.lineTo(s*0.3, -s*0.35); _ctx.lineTo(s*0.3, s*0.35); _ctx.closePath();
                _ctx.fill(); _ctx.stroke();
                break;
            case 'CONTROL_VALVE':
                _ctx.fillRect(-s*0.8, -s*0.5, s*1.6, s*1.0); _ctx.strokeRect(-s*0.8, -s*0.5, s*1.6, s*1.0);
                _ctx.fillStyle = '#2563eb'; _ctx.fillRect(-s*0.4, -s*1.4, s*0.8, s*0.9);
                _ctx.strokeRect(-s*0.4, -s*1.4, s*0.8, s*0.9);
                break;
            case 'DIAPHRAGM_VALVE': case 'ASEPTIC_VALVE':
                _ctx.fillRect(-s*0.9, -s*0.45, s*1.8, s*0.9); _ctx.strokeRect(-s*0.9, -s*0.45, s*1.8, s*0.9);
                _ctx.fillStyle = '#1e293b'; _ctx.fillRect(-s*0.3, -s*1.2, s*0.6, s*0.55);
                _ctx.strokeRect(-s*0.3, -s*1.2, s*0.6, s*0.55);
                break;
            case 'PRESSURE_RELIEF': case 'SAFETY_VALVE': case 'PRESSURE_SAFETY_VALVE':
                _ctx.fillStyle = '#7f1d1d'; _ctx.fillRect(-s*0.5, -s*0.8, s*1.0, s*1.6);
                _ctx.strokeStyle = '#ef4444'; _ctx.lineWidth = 2; _ctx.strokeRect(-s*0.5, -s*0.8, s*1.0, s*1.6);
                break;
            case 'DRAIN_VALVE': case 'SAMPLE_VALVE': case 'SAMPLE_VALVE_SANITARY': case 'PISTON_SAMPLE_VALVE':
                _ctx.fillRect(-s*0.4, -s*0.4, s*0.8, s*0.8); _ctx.strokeRect(-s*0.4, -s*0.4, s*0.8, s*0.8);
                _ctx.beginPath(); _ctx.moveTo(0, s*0.4); _ctx.lineTo(0, s*0.9); _ctx.stroke();
                break;
            case 'AIR_RELEASE': case 'AIR_RELEASE_VALVE':
                _ctx.beginPath(); _ctx.arc(0, 0, s*0.45, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                _ctx.fillStyle = '#0ea5e9'; _ctx.fillRect(-s*0.12, -s*0.9, s*0.24, s*0.5);
                _ctx.strokeRect(-s*0.12, -s*0.9, s*0.24, s*0.5);
                break;
            case 'PLUG_VALVE':
                _ctx.beginPath(); _ctx.arc(0, 0, s*0.7, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                _ctx.fillStyle = '#475569'; _ctx.fillRect(-s*0.15, -s*1.1, s*0.3, s*0.9);
                _ctx.strokeRect(-s*0.15, -s*1.1, s*0.3, s*0.9);
                break;
            case 'CHOKE_VALVE':
                _ctx.fillRect(-s*0.6, -s*0.5, s*1.2, s*1.0); _ctx.strokeRect(-s*0.6, -s*0.5, s*1.2, s*1.0);
                _ctx.fillStyle = '#fbbf24'; _ctx.fillRect(-s*0.2, -s*1.2, s*0.4, s*0.5);
                _ctx.strokeRect(-s*0.2, -s*1.2, s*0.4, s*0.5);
                break;
            case 'CRYOGENIC_VALVE':
                _ctx.fillRect(-s*0.8, -s*0.5, s*1.6, s*1.0); _ctx.strokeRect(-s*0.8, -s*0.5, s*1.6, s*1.0);
                _ctx.strokeStyle = '#6366f1'; _ctx.lineWidth = 1; _ctx.setLineDash([3, 2]);
                _ctx.beginPath(); _ctx.moveTo(-s*0.7, -s*0.4); _ctx.lineTo(s*0.7, -s*0.4); _ctx.stroke(); _ctx.setLineDash([]);
                break;
            case 'CONCENTRIC_REDUCER': case 'ECCENTRIC_REDUCER':
                const reducGrad = _ctx.createLinearGradient(-s, 0, s, 0);
                reducGrad.addColorStop(0, '#475569'); reducGrad.addColorStop(1, '#94a3b8');
                _ctx.beginPath(); _ctx.moveTo(-s, -s*0.5); _ctx.lineTo(s, -s*0.8); _ctx.lineTo(s, s*0.8); _ctx.lineTo(-s, s*0.5); _ctx.closePath();
                _ctx.fillStyle = reducGrad; _ctx.fill(); _ctx.stroke();
                if (comp.type === 'ECCENTRIC_REDUCER') {
                    _ctx.beginPath(); _ctx.moveTo(-s, -s*0.5); _ctx.lineTo(-s, s*0.5);
                    _ctx.strokeStyle = '#facc15'; _ctx.lineWidth = 2.5; _ctx.stroke();
                }
                break;
            case 'WELD_NECK_FLANGE': case 'RTJ_FLANGE': case 'ORIFICE_FLANGE':
                _ctx.fillRect(-s*0.3, -s*0.9, s*0.6, s*1.8); _ctx.strokeRect(-s*0.3, -s*0.9, s*0.6, s*1.8);
                for (let py = -0.7; py <= 0.7; py += 0.45) {
                    _ctx.beginPath(); _ctx.arc(-s*0.5, py*s, 2, 0, Math.PI*2); _ctx.fillStyle = '#64748b'; _ctx.fill();
                    _ctx.beginPath(); _ctx.arc(s*0.5, py*s, 2, 0, Math.PI*2); _ctx.fill();
                }
                break;
            case 'SLIP_ON_FLANGE': case 'BLIND_FLANGE': case 'LAP_JOINT_FLANGE':
                _ctx.beginPath(); _ctx.moveTo(-s*0.4, -s); _ctx.lineTo(-s*0.4, s); _ctx.moveTo(s*0.4, -s); _ctx.lineTo(s*0.4, s); _ctx.lineWidth = 1; _ctx.stroke();
                _ctx.fillRect(-s*0.7, -s*0.9, s*1.4, s*1.8); _ctx.strokeRect(-s*0.7, -s*0.9, s*1.4, s*1.8);
                if (comp.type === 'BLIND_FLANGE') { _ctx.beginPath(); _ctx.moveTo(-s*0.5,-s*0.7); _ctx.lineTo(s*0.5,s*0.7); _ctx.moveTo(s*0.5,-s*0.7); _ctx.lineTo(-s*0.5,s*0.7); _ctx.stroke(); }
                break;
            case 'TEE_EQUAL': case 'TEE_REDUCING':
                _ctx.beginPath(); _ctx.moveTo(-s*0.9, 0); _ctx.lineTo(s*0.9, 0); _ctx.moveTo(0, 0); _ctx.lineTo(0, -s*1.3);
                _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 3; _ctx.stroke();
                _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, 0, s*0.35, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                if (comp.type === 'TEE_REDUCING') { _ctx.fillStyle = '#facc15'; _ctx.beginPath(); _ctx.arc(0, -s*1.3, s*0.25, 0, Math.PI*2); _ctx.fill(); }
                break;
            case 'CROSS':
                _ctx.beginPath(); _ctx.moveTo(-s*0.9, 0); _ctx.lineTo(s*0.9, 0); _ctx.moveTo(0, -s*0.9); _ctx.lineTo(0, s*0.9);
                _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 3; _ctx.stroke();
                _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, 0, s*0.3, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                break;
            case 'ELBOW_45': case 'ELBOW_45_PPR': case 'ELBOW_45_HDPE': case 'ELBOW_45_PVC': case 'ELBOW_45_SS':
                _ctx.beginPath(); _ctx.arc(0, 0, s, 0, Math.PI/4); _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 3; _ctx.stroke();
                _ctx.fillStyle = '#ffffff'; _ctx.beginPath(); _ctx.arc(0, 0, 4, 0, Math.PI*2); _ctx.fill();
                break;
            case 'ELBOW_90_LR': case 'ELBOW_90_SR': case 'ELBOW_90_PPR': case 'ELBOW_90_HDPE': case 'ELBOW_90_PVC': case 'ELBOW_90_LR_SS': case 'ELBOW_90_SANITARY':
                const radius = (comp.type.includes('SR') && !comp.type.includes('LR')) ? s*0.8 : s*1.3;
                _ctx.beginPath(); _ctx.arc(0, 0, radius, 0, Math.PI/2); _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 3; _ctx.stroke();
                _ctx.fillStyle = '#ffffff'; _ctx.beginPath(); _ctx.arc(0, 0, 4, 0, Math.PI*2); _ctx.fill();
                break;
            case 'CAP':
                _ctx.beginPath(); _ctx.arc(0, 0, s*0.7, 0, Math.PI, true); _ctx.closePath(); _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(-s*0.7, 0); _ctx.lineTo(-s*1.1, 0); _ctx.moveTo(s*0.7, 0); _ctx.lineTo(s*1.1, 0); _ctx.stroke();
                break;
            case 'UNION': case 'UNION_ACERO':
                _ctx.fillRect(-s*0.7, -s*0.7, s*1.4, s*1.4); _ctx.strokeRect(-s*0.7, -s*0.7, s*1.4, s*1.4);
                for (let i = -0.5; i <= 0.5; i += 0.25) { _ctx.beginPath(); _ctx.moveTo(-s*0.7, i*s); _ctx.lineTo(s*0.7, i*s); _ctx.strokeStyle = '#334155'; _ctx.lineWidth = 1; _ctx.stroke(); }
                break;
            case 'STUB_END': case 'STUB_END_PPR': case 'STUB_END_HDPE':
                _ctx.fillStyle = '#10b981'; _ctx.fillRect(-s*0.25, -s*0.7, s*0.5, s*1.4);
                _ctx.strokeStyle = '#047857'; _ctx.strokeRect(-s*0.25, -s*0.7, s*0.5, s*1.4);
                _ctx.fillStyle = '#10b981'; _ctx.fillRect(-s*0.45, -s*0.85, s*0.9, s*0.3);
                _ctx.strokeRect(-s*0.45, -s*0.85, s*0.9, s*0.3);
                _ctx.strokeStyle = '#94a3b8'; _ctx.lineWidth = 2.5;
                _ctx.beginPath(); _ctx.moveTo(-s*0.55, -s*0.7); _ctx.lineTo(s*0.55, -s*0.7); _ctx.stroke();
                _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 1; _ctx.setLineDash([2, 2]);
                _ctx.beginPath(); _ctx.moveTo(-s*0.55, -s*0.65); _ctx.lineTo(s*0.55, -s*0.65); _ctx.stroke(); _ctx.setLineDash([]);
                _ctx.fillStyle = '#16a34a'; _ctx.beginPath(); _ctx.arc(0, -s*0.7, s*0.15, 0, Math.PI*2); _ctx.fill();
                break;
            case 'BULKHEAD':
                _ctx.fillStyle = '#94a3b8'; _ctx.fillRect(-s*0.7, -s*0.2, s*1.4, s*0.4);
                _ctx.strokeStyle = '#fff'; _ctx.strokeRect(-s*0.7, -s*0.2, s*1.4, s*0.4);
                _ctx.fillStyle = '#64748b'; _ctx.fillRect(-s*0.3, -s*0.8, s*0.6, s*0.6);
                _ctx.strokeRect(-s*0.3, -s*0.8, s*0.6, s*0.6);
                _ctx.fillRect(-s*0.3, s*0.2, s*0.6, s*0.6);
                _ctx.strokeRect(-s*0.3, s*0.2, s*0.6, s*0.6);
                break;
            case 'TRANSITION': case 'ADAPTADOR_MACHO_PPR_3IN': case 'ADAPTADOR_HEMBRA_PPR_3IN':
                _ctx.fillStyle = '#10b981'; _ctx.fillRect(-s*0.8, -s*0.5, s*0.8, s*1.0);
                _ctx.strokeStyle = '#047857'; _ctx.strokeRect(-s*0.8, -s*0.5, s*0.8, s*1.0);
                _ctx.fillStyle = '#94a3b8'; _ctx.fillRect(s*0.0, -s*0.5, s*0.8, s*1.0);
                _ctx.strokeStyle = '#64748b'; _ctx.strokeRect(s*0.0, -s*0.5, s*0.8, s*1.0);
                _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 1.5;
                _ctx.beginPath(); _ctx.moveTo(0, -s*0.5); _ctx.lineTo(0, s*0.5); _ctx.stroke();
                break;
            case 'NIPPLE':
                _ctx.fillRect(-s*0.9, -s*0.4, s*1.8, s*0.8); _ctx.strokeRect(-s*0.9, -s*0.4, s*1.8, s*0.8);
                for (let i = -0.6; i <= 0.6; i += 0.2) { _ctx.beginPath(); _ctx.moveTo(-s*0.9, i*s); _ctx.lineTo(s*0.9, i*s); _ctx.strokeStyle = '#475569'; _ctx.lineWidth = 1; _ctx.stroke(); }
                break;
            case 'EXPANSION_JOINT':
                _ctx.fillRect(-s*0.8, -s*0.6, s*1.6, s*1.2); _ctx.strokeRect(-s*0.8, -s*0.6, s*1.6, s*1.2);
                for (let i = -0.45; i <= 0.45; i += 0.3) { _ctx.beginPath(); _ctx.moveTo(-s*0.8, i*s); _ctx.lineTo(s*0.8, i*s); _ctx.strokeStyle = '#fbbf24'; _ctx.lineWidth = 1; _ctx.stroke(); }
                break;
            case 'Y_STRAINER':
                _ctx.beginPath(); _ctx.moveTo(-s, 0); _ctx.lineTo(0, -s*0.9); _ctx.lineTo(s, 0); _ctx.lineTo(0, s*0.4); _ctx.closePath();
                _ctx.fill(); _ctx.stroke();
                break;
            case 'T_STRAINER': case 'BASKET_STRAINER': case 'DUPLEX_STRAINER': case 'SANITARY_STRAINER':
                _ctx.fillRect(-s*0.8, -s*0.7, s*1.6, s*1.4); _ctx.strokeRect(-s*0.8, -s*0.7, s*1.6, s*1.4);
                break;
            case 'STEAM_TRAP': case 'STEAM_TRAP_THERMODYNAMIC': case 'STEAM_TRAP_FLOAT': case 'STEAM_TRAP_BUCKET': case 'STEAM_TRAP_SANITARY':
                _ctx.fillRect(-s*0.6, -s*0.5, s*1.2, s*1.0); _ctx.strokeRect(-s*0.6, -s*0.5, s*1.2, s*1.0);
                _ctx.fillStyle = '#475569'; _ctx.fillRect(-s*0.25, -s*0.9, s*0.5, s*0.35);
                _ctx.strokeRect(-s*0.25, -s*0.9, s*0.5, s*0.35);
                break;
            case 'CAMLOCK': case 'CAMLOCK_MALE': case 'CAMLOCK_FEMALE':
                _ctx.fillStyle = '#94a3b8'; _ctx.fillRect(-s*0.6, -s*0.5, s*1.2, s*1.0);
                _ctx.strokeRect(-s*0.6, -s*0.5, s*1.2, s*1.0);
                for (let a = 0; a < Math.PI*2; a += Math.PI) {
                    _ctx.fillStyle = '#64748b';
                    _ctx.fillRect(Math.cos(a)*s*0.45 - s*0.06, Math.sin(a)*s*0.45 - s*0.06, s*0.12, s*0.12);
                    _ctx.strokeRect(Math.cos(a)*s*0.45 - s*0.06, Math.sin(a)*s*0.45 - s*0.06, s*0.12, s*0.12);
                }
                break;
            case 'QUICK_CONNECT':
                _ctx.fillStyle = '#d4a800'; _ctx.fillRect(-s*0.6, -s*0.45, s*1.2, s*0.9);
                _ctx.strokeRect(-s*0.6, -s*0.45, s*1.2, s*0.9);
                break;
            case 'HOSE': case 'FLEXIBLE_HOSE': case 'METALLIC_HOSE': case 'PTFE_HOSE':
                const hoseCol = comp.type.includes('PTFE') ? '#a78bfa' : (comp.type.includes('METALLIC') ? '#94a3b8' : '#22c55e');
                _ctx.fillStyle = hoseCol; _ctx.fillRect(-s*0.8, -s*0.35, s*1.6, s*0.7);
                _ctx.strokeRect(-s*0.8, -s*0.35, s*1.6, s*0.7);
                for (let r = -0.5; r <= 0.5; r += 0.25) { _ctx.beginPath(); _ctx.moveTo(-s*0.8, r*s); _ctx.lineTo(s*0.8, r*s); _ctx.strokeStyle = '#1e293b'; _ctx.lineWidth = 1; _ctx.stroke(); }
                break;
            case 'SILENCER': case 'VENT_SILENCER':
                _ctx.fillStyle = '#64748b'; _ctx.fillRect(-s*0.5, -s*0.9, s*1.0, s*1.8);
                _ctx.strokeStyle = '#fff'; _ctx.strokeRect(-s*0.5, -s*0.9, s*1.0, s*1.8);
                for (let si = -0.7; si <= 0.7; si += 0.3) { _ctx.beginPath(); _ctx.moveTo(-s*0.5, si*s); _ctx.lineTo(s*0.5, si*s); _ctx.strokeStyle = '#334155'; _ctx.lineWidth = 1.5; _ctx.stroke(); }
                break;
            case 'FLAME_ARRESTER': case 'DETONATION_ARRESTER':
                _ctx.fillStyle = '#7f1d1d'; _ctx.fillRect(-s*0.6, -s*0.6, s*1.2, s*1.2);
                _ctx.strokeStyle = '#ef4444'; _ctx.lineWidth = 2; _ctx.strokeRect(-s*0.6, -s*0.6, s*1.2, s*1.2);
                break;
            case 'VACUUM_BREAKER':
                _ctx.fillStyle = '#0ea5e9'; _ctx.fillRect(-s*0.4, -s*0.6, s*0.8, s*1.2);
                _ctx.strokeRect(-s*0.4, -s*0.6, s*0.8, s*1.2);
                break;
            case 'SAMPLE_COOLER':
                _ctx.fillRect(-s*0.5, -s*0.7, s*1.0, s*1.4); _ctx.strokeRect(-s*0.5, -s*0.7, s*1.0, s*1.4);
                _ctx.strokeStyle = '#94a3b8'; _ctx.lineWidth = 0.8; _ctx.globalAlpha = 0.6;
                _ctx.strokeRect(-s*0.55, -s*0.5, s*1.1, s*1.0); _ctx.globalAlpha = 1;
                break;
            case 'INSULATING_JOINT':
                _ctx.fillRect(-s*0.7, -s*0.6, s*1.4, s*1.2); _ctx.strokeRect(-s*0.7, -s*0.6, s*1.4, s*1.2);
                _ctx.fillStyle = '#ef4444'; _ctx.fillRect(-s*0.1, -s*0.6, s*0.2, s*1.2);
                _ctx.strokeRect(-s*0.1, -s*0.6, s*0.2, s*1.2);
                break;
            case 'SPECTACLE_BLIND':
                _ctx.beginPath(); _ctx.arc(0, 0, s*0.7, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, 0, s*0.3, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                break;
            case 'RUPTURE_DISC':
                _ctx.beginPath(); _ctx.arc(0, 0, s*0.7, 0, Math.PI*2); _ctx.fillStyle = '#fef2f2'; _ctx.fill(); _ctx.strokeStyle = '#ef4444'; _ctx.lineWidth = 2; _ctx.stroke();
                break;
            case 'PRESSURE_GAUGE': case 'PRESSURE_GAUGE_SANITARY':
                _ctx.beginPath(); _ctx.arc(0, 0, s*0.55, 0, Math.PI*2);
                _ctx.fillStyle = '#1e293b'; _ctx.fill(); _ctx.strokeStyle = '#94a3b8'; _ctx.lineWidth = 2; _ctx.stroke();
                _ctx.fillStyle = '#f8fafc'; _ctx.beginPath(); _ctx.arc(0, 0, s*0.4, 0, Math.PI*2); _ctx.fill();
                _ctx.fillStyle = '#ef4444'; _ctx.fillRect(-s*0.02, -s*0.35, s*0.04, s*0.25);
                break;
            case 'TEMPERATURE_GAUGE':
                _ctx.fillStyle = '#c0c0c0'; _ctx.fillRect(-s*0.08, -s*0.7, s*0.16, s*0.7);
                _ctx.strokeRect(-s*0.08, -s*0.7, s*0.16, s*0.7);
                _ctx.beginPath(); _ctx.arc(0, -s*0.75, s*0.3, 0, Math.PI*2);
                _ctx.fillStyle = '#f8fafc'; _ctx.fill(); _ctx.strokeStyle = '#94a3b8'; _ctx.lineWidth = 1.5; _ctx.stroke();
                break;
            case 'FLOW_METER': case 'FLOW_METER_MAG': case 'CORIOLIS_METER':
                _ctx.fillStyle = '#94a3b8'; _ctx.fillRect(-s*0.7, -s*0.5, s*1.4, s*1.0);
                _ctx.strokeRect(-s*0.7, -s*0.5, s*1.4, s*1.0);
                _ctx.fillStyle = '#1e293b'; _ctx.fillRect(s*0.2, -s*0.8, s*0.35, s*0.4);
                _ctx.strokeRect(s*0.2, -s*0.8, s*0.35, s*0.4);
                break;
            case 'PRESSURE_TRANSMITTER': case 'LEVEL_TRANSMITTER': case 'TEMPERATURE_TRANSMITTER':
                _ctx.fillStyle = '#2563eb'; _ctx.fillRect(-s*0.5, -s*0.6, s*1.0, s*0.8);
                _ctx.strokeRect(-s*0.5, -s*0.6, s*1.0, s*0.8);
                _ctx.fillStyle = '#1e293b'; _ctx.fillRect(-s*0.15, -s*1.0, s*0.3, s*0.35);
                _ctx.strokeRect(-s*0.15, -s*1.0, s*0.3, s*0.35);
                break;
            case 'ROTAMETER': case 'ROTAMETRO':
                _ctx.fillStyle = 'rgba(135,206,235,0.3)'; _ctx.fillRect(-s*0.25, -s*0.9, s*0.5, s*1.8);
                _ctx.strokeRect(-s*0.25, -s*0.9, s*0.5, s*1.8);
                _ctx.strokeStyle = '#c0c0c0'; _ctx.strokeRect(-s*0.3, -s*0.9, s*0.6, s*1.8);
                break;
            case 'SIGHT_GLASS': case 'SIGHT_GLASS_SANITARY':
                _ctx.strokeStyle = '#94a3b8'; _ctx.lineWidth = 2.5;
                _ctx.strokeRect(-s*0.25, -s*0.7, s*0.5, s*1.4);
                _ctx.fillStyle = 'rgba(135,206,235,0.4)'; _ctx.fillRect(-s*0.2, -s*0.65, s*0.4, s*1.3);
                break;
            case 'LEVEL_SWITCH': case 'LEVEL_SWITCH_RANA':
                _ctx.fillStyle = '#f59e0b'; _ctx.fillRect(-s*0.35, -s*0.3, s*0.7, s*0.6);
                _ctx.strokeRect(-s*0.35, -s*0.3, s*0.7, s*0.6);
                _ctx.fillStyle = '#c0c0c0'; _ctx.fillRect(-s*0.06, -s*0.9, s*0.12, s*0.6);
                _ctx.strokeRect(-s*0.06, -s*0.9, s*0.12, s*0.6);
                break;
            case 'SPRAY_BALL':
                _ctx.beginPath(); _ctx.arc(0, 0, s*0.5, 0, Math.PI*2);
                _ctx.fillStyle = '#c0c0c0'; _ctx.fill(); _ctx.strokeStyle = '#94a3b8'; _ctx.stroke();
                for (let sp = 0; sp < Math.PI*2; sp += Math.PI/3) {
                    _ctx.beginPath(); _ctx.moveTo(0, 0); _ctx.lineTo(Math.cos(sp)*s*0.5, Math.sin(sp)*s*0.5); _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 0.5; _ctx.stroke();
                }
                break;
            case 'STATIC_MIXER':
                _ctx.fillRect(-s*0.6, -s*0.5, s*1.2, s*1.0); _ctx.strokeRect(-s*0.6, -s*0.5, s*1.2, s*1.0);
                _ctx.strokeStyle = '#fbbf24'; _ctx.lineWidth = 1.5;
                _ctx.beginPath(); _ctx.moveTo(-s*0.5, -s*0.4); _ctx.lineTo(s*0.5, s*0.4); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(-s*0.5, s*0.4); _ctx.lineTo(s*0.5, -s*0.4); _ctx.stroke();
                break;
            case 'PIPE_SHOE':
                _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 1.5;
                _ctx.beginPath(); _ctx.moveTo(-s*0.9, 0); _ctx.lineTo(s*0.9, 0); _ctx.stroke();
                _ctx.fillStyle = '#374151'; _ctx.fillRect(-s*0.5, s*0.1, s*1.0, s*0.4);
                _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 0.8; _ctx.strokeRect(-s*0.5, s*0.1, s*1.0, s*0.4);
                break;
            case 'U_BOLT': case 'GUIDE': case 'ANCHOR': case 'HANGER': case 'PIPE_CLAMP': case 'SPRING_HANGER':
                _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 1.5; _ctx.setLineDash([3, 3]);
                _ctx.beginPath(); _ctx.moveTo(-s*0.9, 0); _ctx.lineTo(s*0.9, 0);
                if (comp.type === 'ANCHOR') { _ctx.moveTo(-s*0.6, -s*0.5); _ctx.lineTo(-s*0.6, s*0.5); _ctx.moveTo(s*0.6, -s*0.5); _ctx.lineTo(s*0.6, s*0.5); }
                _ctx.stroke(); _ctx.setLineDash([]);
                break;
            case 'AIR_DIFFUSER': case 'CHLORINE_EJECTOR': case 'CHEMICAL_INJECTOR':
                _ctx.fillStyle = '#64748b'; _ctx.fillRect(-s*0.5, -s*0.4, s*1.0, s*0.8);
                _ctx.strokeRect(-s*0.5, -s*0.4, s*1.0, s*0.8);
                _ctx.fillStyle = '#00f2ff'; _ctx.beginPath(); _ctx.arc(0, s*0.5, s*0.2, 0, Math.PI*2); _ctx.fill(); _ctx.strokeStyle = '#fff'; _ctx.stroke();
                break;
            default:
                _ctx.fillRect(-s*0.8, -s*0.8, s*1.6, s*1.6); _ctx.strokeRect(-s*0.8, -s*0.8, s*1.6, s*1.6);
                const lbl = getComponentLabel(comp.type);
                _ctx.fillStyle = '#ffffff'; _ctx.font = `bold ${Math.max(8, s*0.7)}px Inter`; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
                _ctx.fillText(lbl, 0, 0);
        }
        _ctx.restore();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawComponentTag(proj2d, index, compType, dir3D) {
        const tagText = `${index}`;
        const leaderX = proj2d.x + 25, leaderY = proj2d.y - 25;
        _ctx.save(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.strokeStyle = '#94a3b8'; _ctx.lineWidth = 0.8; _ctx.beginPath();
        _ctx.moveTo(proj2d.x, proj2d.y); _ctx.lineTo(leaderX, leaderY); _ctx.stroke();
        _ctx.fillStyle = '#0f172a'; _ctx.strokeStyle = '#38bdf8'; _ctx.lineWidth = 1;
        const boxW = 22, boxH = 14;
        _ctx.fillRect(leaderX - boxW/2, leaderY - boxH/2, boxW, boxH);
        _ctx.strokeRect(leaderX - boxW/2, leaderY - boxH/2, boxW, boxH);
        _ctx.fillStyle = '#ffffff'; _ctx.font = 'bold 8px Inter'; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        _ctx.fillText(tagText, leaderX, leaderY);
        _ctx.restore(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawIsometricDimension(p1, p2, offset = 1200) {
        const realDist = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        if (realDist < 50) return;
        const orientation = getPipeOrientation(p1, p2);
        const finalOffset = offset || Math.max(600, Math.min(3000, realDist * 0.4));
        let candA, candB;
        if (orientation === 'horizontal') { candA = { dx: 0, dy: -finalOffset, dz: 0 }; candB = { dx: 0, dy: finalOffset, dz: 0 }; }
        else { candA = { dx: finalOffset, dy: 0, dz: 0 }; candB = { dx: -finalOffset, dy: 0, dz: 0 }; }
        const checkCollision = (offsetV) => {
            const midPoint = { x: (p1.x+p2.x)/2+offsetV.dx, y: (p1.y+p2.y)/2+offsetV.dy, z: (p1.z+p2.z)/2+offsetV.dz };
            return isPointCollidingWithEquipment(midPoint, 1200);
        };
        const finalOffsetVec = checkCollision(candA) ? candB : candA;
        const dp1 = { x: p1.x+finalOffsetVec.dx, y: p1.y+finalOffsetVec.dy, z: p1.z+finalOffsetVec.dz };
        const dp2 = { x: p2.x+finalOffsetVec.dx, y: p2.y+finalOffsetVec.dy, z: p2.z+finalOffsetVec.dz };
        const pr1 = project(p1), pr2 = project(p2), prD1 = project(dp1), prD2 = project(dp2);
        const dir3D = getSegmentDirection3D(p1, p2);
        let plane = 'RIGHT';
        if (dir3D === 'X') plane = 'LEFT';
        else if (dir3D === 'Y') plane = 'RIGHT';
        _ctx.save();
        _ctx.beginPath(); _ctx.setLineDash([4,4]); _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 1;
        _ctx.moveTo(pr1.x, pr1.y); _ctx.lineTo(prD1.x, prD1.y);
        _ctx.moveTo(pr2.x, pr2.y); _ctx.lineTo(prD2.x, prD2.y); _ctx.stroke(); _ctx.setLineDash([]);
        _ctx.beginPath(); _ctx.moveTo(prD1.x, prD1.y); _ctx.lineTo(prD2.x, prD2.y);
        _ctx.strokeStyle = '#00ffcc'; _ctx.lineWidth = 1.5; _ctx.stroke();
        _ctx.strokeStyle = '#00ffcc'; _ctx.lineWidth = 1.5;
        _ctx.beginPath(); _ctx.moveTo(prD1.x - 4, prD1.y + 4); _ctx.lineTo(prD1.x + 4, prD1.y - 4); _ctx.stroke();
        _ctx.beginPath(); _ctx.moveTo(prD2.x - 4, prD2.y + 4); _ctx.lineTo(prD2.x + 4, prD2.y - 4); _ctx.stroke();
        const midX = (prD1.x + prD2.x) / 2, midY = (prD1.y + prD2.y) / 2;
        _ctx.font = `bold ${Math.max(10, 12 * _cam.scale)}px "Courier New", monospace`;
        _ctx.fillStyle = '#ffffff'; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        if (plane === 'LEFT') { _ctx.setTransform(1, 0.5, 0, 1, midX, midY - 5); }
        else if (plane === 'RIGHT') { _ctx.setTransform(1, -0.5, 0, 1, midX, midY - 5); }
        _ctx.fillText(formatDimensionText(realDist), 0, 0);
        _ctx.restore(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawEquipmentTag2D(projectedCenter, tag, equipmentName) {
        if (!AnnotationManager.isVisible(2)) return;
        const prefX = projectedCenter.x, prefY = projectedCenter.y - 60;
        const box = AnnotationManager.register({ x: prefX + 20, y: prefY, w: 90, h: 24 }, 2);
        _ctx.save(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.strokeStyle = '#f59e0b'; _ctx.lineWidth = 1.5; _ctx.beginPath();
        _ctx.moveTo(projectedCenter.x, projectedCenter.y); _ctx.lineTo(box.x, box.y + 12); _ctx.stroke();
        _ctx.fillStyle = '#1e293b'; _ctx.fillRect(box.x, box.y, box.w, box.h);
        _ctx.strokeRect(box.x, box.y, box.w, box.h);
        _ctx.fillStyle = '#ffffff'; _ctx.font = 'bold 11px "Courier New"'; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        _ctx.fillText(tag, box.x + box.w/2, box.y + 12);
        _ctx.restore(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawSelection(element) {
        if (!element) return;
        _ctx.save(); _ctx.strokeStyle = '#facc15'; _ctx.lineWidth = 4; _ctx.shadowColor = '#facc15'; _ctx.shadowBlur = 10;
        if (element.type === 'equipment') {
            const eq = element.obj;
            if (eq.tipo === 'tanque_v' || eq.tipo === 'torre' || eq.tipo === 'reactor') {
                const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ }); const w = (eq.diametro/2)*_cam.scale, h = eq.altura*_cam.scale;
                _ctx.beginPath(); _ctx.ellipse(p.x, p.y-h/2, w+5, (w+5)*0.5, 0, 0, 2*Math.PI); _ctx.stroke();
                _ctx.beginPath(); _ctx.ellipse(p.x, p.y+h/2, w+5, (w+5)*0.5, 0, 0, 2*Math.PI); _ctx.stroke();
            } else {
                const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
                const w = ((eq.largo||eq.diametro||1000)/2)*_cam.scale+5, h = ((eq.altura||1000)/2)*_cam.scale+5;
                _ctx.strokeRect(p.x-w, p.y-h, w*2, h*2);
            }
        } else if (element.type === 'line') {
            const pts = _core.getLinePoints(element.obj);
            if (pts && pts.length >= 2) { _ctx.beginPath(); pts.forEach((p,i) => { const pr = project(p); i===0 ? _ctx.moveTo(pr.x,pr.y) : _ctx.lineTo(pr.x,pr.y); }); _ctx.stroke(); }
        }
        _ctx.restore();
    }

    function pickElement(mouseCanvas) {
        if (!_core) return null;
        const db = _core.getDb(); const equipos = db?.equipos || []; const lines = db?.lines || [];
        const worldClick = inverseProject(mouseCanvas.x, mouseCanvas.y);
        for (let i = equipos.length - 1; i >= 0; i--) {
            const eq = equipos[i]; let inside = false;
            if (eq.tipo === 'tanque_v' || eq.tipo === 'torre' || eq.tipo === 'reactor') inside = isPointInCylinder(worldClick, eq);
            else if (eq.tipo === 'tanque_h') inside = isPointInHorizontalCylinder(worldClick, eq);
            else inside = isPointInBox(worldClick, eq);
            if (inside) return { type: 'equipment', obj: eq };
        }
        for (let line of lines) {
            const pts = _core.getLinePoints(line); if (!pts || pts.length < 2) continue;
            for (let i = 0; i < pts.length - 1; i++) {
                const p1 = pts[i], p2 = pts[i+1]; const proj1 = project(p1), proj2 = project(p2);
                if (pointToSegmentDistance(mouseCanvas, proj1, proj2) < 12) return { type: 'line', obj: line };
            }
        }
        return null;
    }

    function pickComponent(mouseX, mouseY) {
        if (!_core) return null;
        const db = _core.getDb(); let closest = null, closestDist = 18;
        for (const line of db.lines || []) {
            if (!line.components) continue;
            for (const comp of line.components) {
                if (!comp._screenPos) continue;
                const dist = Math.hypot(comp._screenPos.x - mouseX, comp._screenPos.y - mouseY);
                if (dist < closestDist) { closestDist = dist; closest = comp; }
            }
        }
        return closest;
    }

    function pickPort(mouseX, mouseY) {
        const db = _core.getDb();
        for (const item of [...(db.equipos||[]), ...(db.lines||[])]) {
            if (!item.puertos) continue;
            for (const port of item.puertos) {
                const worldPos = { x: (item.posX||0)+(port.relX||0), y: (item.posY||0)+(port.relY||0), z: (item.posZ||0)+(port.relZ||0) };
                const screenPos = project(worldPos);
                if (Math.hypot(screenPos.x-mouseX, screenPos.y-mouseY) < SNAP_THRESHOLD) return { item, port, screenPos };
            }
        }
        return null;
    }

    function autoCenter(options = {}) {
        if (!_canvas || !_core) return;
        const db = _core.getDb(); const equipos = db?.equipos || []; const lines = db?.lines || [];
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || _canvas.width < 600;
        const padding = options.padding !== undefined ? options.padding : (isMobile ? 20 : 80);
        const minScale = options.minScale !== undefined ? options.minScale : (isMobile ? 0.06 : 0.12);
        const maxScale = options.maxScale !== undefined ? options.maxScale : (isMobile ? 0.5 : 0.6);
        let points = [];
        equipos.forEach(eq => {
            const r = (eq.diametro / 2) || 500;
            points.push({ x: eq.posX, y: eq.posY, z: eq.posZ });
            points.push({ x: eq.posX + r, y: eq.posY, z: eq.posZ });
            points.push({ x: eq.posX - r, y: eq.posY, z: eq.posZ });
            points.push({ x: eq.posX, y: eq.posY, z: eq.posZ + r });
            points.push({ x: eq.posX, y: eq.posY, z: eq.posZ - r });
        });
        lines.forEach(line => {
            const pts = _core.getLinePoints(line); if (!pts) return;
            pts.forEach(p => points.push(p));
        });
        if (points.length === 0) points = [{ x: -2000, y: 0, z: -2000 }, { x: 2000, y: 2000, z: 2000 }];
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(p => {
            const rx = (p.x - p.z) * COS30, ry = (p.x + p.z) * SIN30 - p.y;
            if (rx < minX) minX = rx; if (rx > maxX) maxX = rx;
            if (ry < minY) minY = ry; if (ry > maxY) maxY = ry;
        });
        const margin = (maxX - minX) * 0.15, marginY = (maxY - minY) * 0.15;
        minX -= margin; maxX += margin; minY -= marginY; maxY += marginY;
        const worldW = maxX - minX, worldH = maxY - minY;
        let sc = Math.min((_canvas.width - padding * 2) / worldW, (_canvas.height - padding * 2) / worldH, maxScale);
        sc = Math.max(minScale, sc); sc = isFinite(sc) ? sc : 0.3;
        _cam.scale = sc;
        _cam.panX = _canvas.width / 2 - ((minX + maxX) / 2) * sc;
        _cam.panY = _canvas.height / 2 - ((minY + maxY) / 2) * sc;
        _cacheDirty = true; scheduleRender();
    }

    function pan(dx, dy) { _cam.panX += dx; _cam.panY += dy; _cacheDirty = true; scheduleRender(); }

    function zoom(delta, mouseX, mouseY) {
        const zoomFactor = delta > 0 ? 1.1 : 0.9;
        const newScale = _cam.scale * zoomFactor;
        const clampedScale = Math.min(Math.max(0.05, newScale), 1.5);
        if (mouseX !== undefined && mouseY !== undefined && clampedScale !== _cam.scale) {
            _cam.panX = mouseX - (mouseX - _cam.panX) * (clampedScale / _cam.scale);
            _cam.panY = mouseY - (mouseY - _cam.panY) * (clampedScale / _cam.scale);
        }
        _cam.scale = clampedScale; _cacheDirty = true; scheduleRender();
    }

    function render() {
        if (!_ctx || !_canvas) return;
        _renderScheduled = false;
        _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
        const bgGrad = _ctx.createRadialGradient(_canvas.width/2, _canvas.height/2, _canvas.width*0.1, _canvas.width/2, _canvas.height/2, _canvas.width*0.9);
        bgGrad.addColorStop(0, '#0f172a'); bgGrad.addColorStop(1, '#020617');
        _ctx.fillStyle = bgGrad; _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
        drawGrid(_currentElevation); drawOrigin();
        if (!_core) return;
        const db = _core.getDb(); if (!db) return;
        if (_cacheDirty) {
            _renderQueueCache = [];
            (db.equipos||[]).forEach(eq => _renderQueueCache.push({ type:'EQUIPMENT', depth: eq.posX+eq.posZ+(eq.posY*0.1), data: eq }));
            (db.lines||[]).forEach(line => {
                const pts = _core.getLinePoints(line);
                if (pts && pts.length >= 2) {
                    _renderQueueCache.push({ type:'LINE', depth: pts.reduce((acc,p)=>acc+(p.x+p.z),0)/pts.length, data: line });
                }
            });
            _renderQueueCache.sort((a, b) => {
                const order = { 'PLATFORM': 0, 'EQUIPMENT': 1, 'LINE': 2 };
                const typeA = a.data?.tipo === 'plataforma' ? 'PLATFORM' : a.type;
                const typeB = b.data?.tipo === 'plataforma' ? 'PLATFORM' : b.type;
                return (order[typeA]||1) - (order[typeB]||1) || a.depth - b.depth;
            });
            _cacheDirty = false;
        }
        AnnotationManager.reset(); _bomItems = [];
        _renderQueueCache.forEach(item => {
            if (item.type==='EQUIPMENT') {
                const eq=item.data;
                switch(eq.tipo) {
                    case 'tanque_v':case 'torre':case 'reactor':drawTank(eq);break;
                    case 'bomba':case 'bomba_z':drawBomba(eq);break;
                    case 'tanque_h':drawCilindroHorizontal(eq,'#2563eb');break;
                    case 'plataforma':drawPlataforma(eq);break;
                    default:drawRectEquip(eq,'#475569');
                }
                if (eq.tag && eq.tipo !== 'plataforma') {
                    drawEquipmentTag2D(project({x:eq.posX,y:eq.posY,z:eq.posZ}), eq.tag, eq.tipo||'EQUIPO');
                }
                if (eq.puertos) eq.puertos.forEach(p => {
                    const worldPos = {x:eq.posX+(p.relX||0),y:eq.posY+(p.relY||0),z:eq.posZ+(p.relZ||0)};
                    if (p.elevation!==undefined||p.status==='open') drawNozzleTag(project(worldPos),p,eq);
                });
            } else if (item.data.isFitting) {
                drawFitting(item.data);
            } else {
                drawPipeWithElbows(item.data); drawPipeComponents(item.data);
            }
        });
        const selected = _core.getSelected();
        if (selected) { drawSelection(selected); drawPortMarkers(selected.obj); }
        if (_activeSnap) {
            _ctx.save(); _ctx.beginPath(); _ctx.strokeStyle='#10b981'; _ctx.lineWidth=2;
            _ctx.arc(_activeSnap.screenPos.x,_activeSnap.screenPos.y,8,0,Math.PI*2); _ctx.stroke();
            _ctx.fillStyle='#10b981'; _ctx.font='bold 12px Arial';
            _ctx.fillText(`${_activeSnap.item.tag}:${_activeSnap.port.id} (${_activeSnap.port.diametro}")`,_activeSnap.screenPos.x+12,_activeSnap.screenPos.y-12);
            _ctx.restore();
        }
        if (_hoveredComponent && _hoveredComponentScreenPos) drawTechnicalTooltip(_ctx, _hoveredComponent, _hoveredComponentScreenPos);
        if (_canvas.width >= 400) renderBOM();
    }

    function scheduleRender() { if (!_renderScheduled) { _renderScheduled = true; requestAnimationFrame(() => render()); } }

    function drawFitting(fitting) {
        if (!fitting || !fitting.puertos) return;
        const center = project({ x: fitting.posX, y: fitting.posY, z: fitting.posZ });
        _ctx.save(); _ctx.beginPath(); _ctx.strokeStyle = '#f59e0b'; _ctx.lineWidth = 3*_cam.scale;
        fitting.puertos.forEach(p => {
            const pProj = project({ x: fitting.posX+(p.relX||0), y: fitting.posY+(p.relY||0), z: fitting.posZ+(p.relZ||0) });
            _ctx.moveTo(center.x, center.y); _ctx.lineTo(pProj.x, pProj.y);
        });
        _ctx.stroke(); _ctx.restore();
    }

    function drawPortMarkers(item) {
        if (!item || !item.puertos) return;
        const basePos = item.posX !== undefined ? { x: item.posX, y: item.posY, z: item.posZ } : (item._cachedPoints?.[0] || { x:0,y:0,z:0 });
        item.puertos.forEach(p => {
            const pProj = project({ x: basePos.x+(p.relX||0), y: basePos.y+(p.relY||0), z: basePos.z+(p.relZ||0) });
            _ctx.beginPath(); _ctx.fillStyle = (p.status==='open') ? '#10b981' : '#64748b';
            _ctx.arc(pProj.x, pProj.y, 4*_cam.scale, 0, Math.PI*2); _ctx.fill();
        });
    }

    function drawTechnicalTooltip(ctx, comp, screenPos) {
        const catalogComp = typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog.getComponent(comp.type) : null;
        const desc = catalogComp?.nombre || comp.type || 'Componente';
        const material = catalogComp?.material || comp.material || 'N/D';
        const abbr = getComponentLabel(comp.type);
        const boxW = 210, boxH = 80;
        const x = Math.min(screenPos.x + 30, _canvas.width - boxW - 10);
        const y = Math.max(screenPos.y - 60, 10);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, boxW, boxH, 8); ctx.fill(); ctx.stroke(); }
        else { ctx.fillRect(x, y, boxW, boxH); ctx.strokeRect(x, y, boxW, boxH); }
        ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 12px Inter'; ctx.fillText(`${abbr} — ${desc}`, x + 12, y + 22);
        ctx.fillStyle = '#e2e8f0'; ctx.font = '10px Inter'; ctx.fillText(`Material: ${material}`, x + 12, y + 42);
        ctx.fillText(`Tag: ${comp.tag || 'N/A'}`, x + 12, y + 58);
        ctx.fillStyle = '#94a3b8'; ctx.fillText(`SKU: ${catalogComp?.spec || comp.type || 'N/A'}`, x + 12, y + 74);
        ctx.restore();
    }

    function renderBOM() {
        if (_bomItems.length === 0) return;
        const x = 20, padding = 15, rowHeight = 18, headerHeight = 25, tableWidth = 240;
        const tableHeight = headerHeight + (_bomItems.length * rowHeight) + padding;
        const y = _canvas.height - tableHeight - 20;
        _ctx.save(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.fillStyle = "rgba(15, 23, 42, 0.9)"; _ctx.beginPath(); _ctx.roundRect(x, y, tableWidth, tableHeight, 8); _ctx.fill();
        _ctx.strokeStyle = "#0ea5e9"; _ctx.lineWidth = 1; _ctx.stroke();
        _ctx.fillStyle = "#0ea5e9"; _ctx.font = "bold 10px 'Segoe UI', sans-serif";
        _ctx.fillText("ITEM", x+12, y+17); _ctx.fillText("DESCRIPCIÓN", x+45, y+17); _ctx.fillText("MAT", x+205, y+17);
        _ctx.beginPath(); _ctx.moveTo(x+10, y+22); _ctx.lineTo(x+tableWidth-10, y+22); _ctx.strokeStyle = "rgba(14,165,233,0.3)"; _ctx.stroke();
        _bomItems.forEach((item, i) => {
            const rowY = y + headerHeight + (i*rowHeight) + 12;
            _ctx.fillStyle = "rgba(14,165,233,0.1)"; _ctx.beginPath(); _ctx.arc(x+20, rowY-3, 7, 0, Math.PI*2); _ctx.fill();
            _ctx.fillStyle = "#f8fafc"; _ctx.font = "9px 'Roboto Mono', monospace"; _ctx.textAlign = "center"; _ctx.fillText(Math.floor(item.index), x+20, rowY);
            _ctx.textAlign = "left"; _ctx.fillText(item.desc.replace(/_/g,' ').substring(0,24), x+45, rowY);
            _ctx.fillStyle = "#94a3b8"; _ctx.fillText(item.mat, x+205, rowY);
        });
        _ctx.restore();
    }

    function exportPDF() {
        if (!_canvas) return;
        if (typeof window.jspdf === 'undefined') { _notifyUI("Error: jsPDF no disponible.", true); return; }
        const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: 'landscape' });
        const imgData = _canvas.toDataURL('image/png'); doc.addImage(imgData, 'PNG', 10, 10, 277, 150);
        doc.setFontSize(16); doc.text("SmartProject - Reporte Isometrico", 10, 175);
        doc.text(`Fecha: ${new Date().toLocaleString()}`, 10, 185);
        doc.save(`${window.currentProjectName || 'Proyecto'}_Isometrico_${Date.now()}.pdf`);
        _notifyUI("PDF generado correctamente.", false);
    }

    function calculateComponentPosition(line, param) {
        const pts = _core ? _core.getLinePoints(line) : (line._cachedPoints || line.points3D);
        if (!pts || pts.length < 2) return null;
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) { let d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z); lengths.push(d); totalLen += d; }
        if (totalLen === 0) return null;
        const targetLen = totalLen * param; let currentAccum = 0, segIndex = 0, t = 0;
        for (let i = 0; i < lengths.length; i++) { if (currentAccum + lengths[i] >= targetLen || i === lengths.length - 1) { segIndex = i; let segLen = lengths[i]; if (segLen > 0) t = (targetLen - currentAccum) / segLen; else t = 0; t = Math.min(1, Math.max(0, t)); break; } currentAccum += lengths[i]; }
        const p1 = pts[segIndex], p2 = pts[segIndex + 1];
        const compPos = { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t, z: p1.z + (p2.z - p1.z) * t };
        const dirVec = { dx: p2.x - p1.x, dy: p2.y - p1.y, dz: p2.z - p1.z }; const len = Math.hypot(dirVec.dx, dirVec.dy, dirVec.dz) || 1;
        return { p1: compPos, p2: compPos, dir: { dx: dirVec.dx/len, dy: dirVec.dy/len, dz: dirVec.dz/len } };
    }

    function init(canvasElement, coreInstance, notifyFn) {
        _canvas = canvasElement; _ctx = _canvas.getContext('2d'); _core = coreInstance;
        _notifyUI = notifyFn || ((msg, isErr) => console.log(msg));
        _currentElevation = 0; resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', () => { setTimeout(resizeCanvas, 100); });
        if (_core && _core.on) _core.on('modelChanged', () => { _cacheDirty = true; scheduleRender(); });
        _canvas.addEventListener('mousemove', (e) => {
            const rect = _canvas.getBoundingClientRect(), mX = e.clientX - rect.left, mY = e.clientY - rect.top;
            const snapped = pickPort(mX, mY);
            if (snapped) { _activeSnap = snapped; _canvas.style.cursor = 'crosshair'; _hoveredComponent = null; _hoveredComponentScreenPos = null; }
            else { _activeSnap = null; const hovered = pickComponent(mX, mY);
                if (hovered) { _hoveredComponent = { comp: hovered }; _hoveredComponentScreenPos = hovered._screenPos || {x:mX, y:mY}; _canvas.style.cursor = 'pointer'; }
                else { _hoveredComponent = null; _hoveredComponentScreenPos = null; _canvas.style.cursor = pickElement({x:mX,y:mY}) ? 'pointer' : 'default'; }
            }
            scheduleRender();
        });
        _canvas.addEventListener('click', (e) => {
            if (e.ctrlKey && _activeSnap) {
                const input = document.getElementById('commandText');
                if (input) { input.value = `${input.value.trim()} ${_activeSnap.item.tag} ${_activeSnap.port.id}`.trim(); input.focus(); _notifyUI(`Seleccionado: ${_activeSnap.item.tag} puerto ${_activeSnap.port.id}`); }
            }
        });
        _canvas.addEventListener('wheel', (e) => { e.preventDefault(); const rect = _canvas.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top); });
        let lastTouchDist = 0;
        _canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY; const dist = Math.hypot(dx, dy); if (lastTouchDist) { const midX = (e.touches[0].clientX + e.touches[1].clientX)/2 - _canvas.getBoundingClientRect().left, midY = (e.touches[0].clientY + e.touches[1].clientY)/2 - _canvas.getBoundingClientRect().top; zoom(dist > lastTouchDist ? 1 : -1, midX, midY); } lastTouchDist = dist; }
        });
        _canvas.addEventListener('touchend', () => { lastTouchDist = 0; });
        autoCenter(); scheduleRender();
    }

    function resizeCanvas() {
        if (!_canvas) return;
        const container = _canvas.parentElement, dpr = window.devicePixelRatio || 1;
        if (container) { _canvas.width = container.clientWidth * dpr; _canvas.height = container.clientHeight * dpr; _canvas.style.width = container.clientWidth + 'px'; _canvas.style.height = container.clientHeight + 'px'; _ctx.scale(dpr, dpr); }
        _cacheDirty = true; autoCenter();
    }

    function setElevation(level) { _currentElevation = level; scheduleRender(); }

    // API PÚBLICA (sin exportPCF)
    window.SmartFlowRenderer = { 
        init, render: scheduleRender, autoCenter, pan, zoom, project, inverseProject, 
        setElevation, resizeCanvas, exportPDF, 
        calculateComponentPosition,
        getCam: () => _cam, pickElement, 
        getActiveSnap: () => _activeSnap 
    };
    return window.SmartFlowRenderer;
})();
