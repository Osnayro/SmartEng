
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

    // ═══════════════════════════════════════════════════════
    // CONFIGURACIÓN MEJORADA DE MATERIALES Y NORMAS
    // ═══════════════════════════════════════════════════════
    const ISO_CONFIG = {
        MATERIALS: { 
            'PPR': 'PP', 'CARBON_STEEL': 'CS', 'STAINLESS_STEEL': 'SS', 
            'POLIETILENO': 'PE', 'PVC': 'PV', 'HDPE': 'PE', 'CPVC': 'CP',
            'FRP': 'FR', 'PTFE_LINED': 'PT', 'GLASS_LINED': 'GL',
            'DUPLEX': 'DX', 'HASTELLOY': 'HY', 'ALLOY20': 'A2'
        },
        COLORS: { 
            'PP': '#10b981', 'CS': '#475569', 'SS': '#94a3b8', 'PE': '#1e293b', 
            'PV': '#7c3aed', 'CP': '#fb923c', 'FR': '#8b5cf6', 'PT': '#a78bfa',
            'GL': '#f0f9ff', 'DX': '#cbd5e1', 'HY': '#f59e0b', 'A2': '#fbbf24'
        },
        PIPE_SCHEDULES: {
            'SCH40': 1.0, 'SCH80': 1.25, 'SCH160': 1.5,
            'STD': 1.0, 'XS': 1.25, 'XXS': 1.5
        },
        INSULATION_COLORS: {
            'HOT': '#ff4444', 'COLD': '#4488ff', 'PERSONNEL': '#44ff44',
            'NONE': null
        },
        WELD_SYMBOLS: {
            'BUTT': '⊟', 'SOCKET': '⊡', 'THREADED': '⊠'
        }
    };

    // ═══════════════════════════════════════════════════════
    // SISTEMA DE ANOTACIONES MEJORADO
    // ═══════════════════════════════════════════════════════
    const AnnotationManager = {
        slots: [],
        occupiedBounds: [],
        minZoomForDetails: 0.3,
        minZoomForAll: 0.5,

        reset() {
            this.slots = [];
            this.occupiedBounds = [];
        },

        checkCollision(box) {
            for (const other of this.occupiedBounds) {
                if (!(box.x + box.w < other.x || box.x > other.x + other.w ||
                      box.y + box.h < other.y || box.y > other.y + other.h)) {
                    return true;
                }
            }
            return false;
        },

        findBestPosition(preferredX, preferredY, w, h, priority, maxAttempts = 8) {
            const offsets = [
                { dx: 0, dy: 0 },
                { dx: 0, dy: -h - 5 },
                { dx: 0, dy: h + 5 },
                { dx: w + 10, dy: 0 },
                { dx: -w - 10, dy: 0 },
                { dx: w + 10, dy: -h - 5 },
                { dx: -w - 10, dy: -h - 5 },
                { dx: 0, dy: -2 * h - 10 }
            ];
            for (let i = 0; i < Math.min(maxAttempts, offsets.length); i++) {
                const candidate = {
                    x: preferredX + offsets[i].dx,
                    y: preferredY + offsets[i].dy,
                    w, h
                };
                if (!this.checkCollision(candidate)) {
                    return candidate;
                }
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

    // ═══════════════════════════════════════════════════════
    // UTILIDADES DE PROYECCIÓN
    // ═══════════════════════════════════════════════════════
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
        const A = X / COS30;
        const B = adjY / SIN30;
        return { x: (A + B) / 2, y: planeY, z: (B - A) / 2 };
    }

    function adjustColor(color, percent) {
        const num = parseInt(color.replace("#",""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt, G = (num >> 8 & 0x00FF) + amt, B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
    }

    // ═══════════════════════════════════════════════════════
    // GRADIENTES Y TEXTURAS MEJORADOS
    // ═══════════════════════════════════════════════════════
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
            grad.addColorStop(0, '#064e3b');
            grad.addColorStop(0.2, '#6ee7b7');
            grad.addColorStop(0.5, baseColor);
            grad.addColorStop(0.8, '#34d399');
            grad.addColorStop(1, '#065f46');
        } else if (material === 'SS' || material === 'DX') {
            grad.addColorStop(0, '#1a1a1a');
            grad.addColorStop(0.25, '#c0c0c0');
            grad.addColorStop(0.5, '#ffffff');
            grad.addColorStop(0.75, '#c0c0c0');
            grad.addColorStop(1, '#1a1a1a');
        } else {
            grad.addColorStop(0, '#1a1a1a');
            grad.addColorStop(0.3, adjustColor(baseColor, -30));
            grad.addColorStop(0.5, '#ffffffcc');
            grad.addColorStop(0.7, adjustColor(baseColor, 20));
            grad.addColorStop(1, '#000000');
        }
        return grad;
    }

    function getShortMaterial(materialName) {
        const name = materialName ? materialName.toUpperCase() : '';
        for (const [key, val] of Object.entries(ISO_CONFIG.MATERIALS)) {
            if (name.includes(key)) return val;
        }
        return name.substring(0,2) || 'UN';
    }

    function formatDimensionText(dist) {
        if (dist < 1000) return Math.round(dist).toString() + ' mm';
        return (dist / 1000).toFixed(2) + ' m';
    }

    function getComponentLabel(compType) {
        if (typeof SmartFlowCatalog !== 'undefined') {
            const catComp = SmartFlowCatalog.getComponent(compType);
            if (catComp && catComp.abbr) return catComp.abbr;
        }
        const fallback = {
            'GATE_VALVE':'GV','GLOBE_VALVE':'GL','BUTTERFLY_VALVE':'VB','BALL_VALVE':'BA',
            'CHECK_VALVE':'CK','DIAPHRAGM_VALVE':'DV','CONTROL_VALVE':'CV',
            'CONCENTRIC_REDUCER':'RC','ECCENTRIC_REDUCER':'RE',
            'WELD_NECK_FLANGE':'FL','SLIP_ON_FLANGE':'FL','BLIND_FLANGE':'FB','LAP_JOINT_FLANGE':'FL',
            'PRESSURE_GAUGE':'PG','TEMPERATURE_GAUGE':'TG','FLOW_METER':'FM',
            'TEE_EQUAL':'TE','TEE_REDUCING':'TR','CROSS':'CR','CAP':'CA',
            'ELBOW_90_LR':'EL','ELBOW_90_SR':'EL','ELBOW_45':'E4',
            'TRANSITION':'TR','UNION':'UN','BULKHEAD':'BH','Y_STRAINER':'YS',
            'LEVEL_SWITCH_RANA':'LS','PIPE_SHOE':'SH','U_BOLT':'UB','GUIDE':'GD','ANCHOR':'AN',
            'HANGER':'HG','PIPE_CLAMP':'PC','EXPANSION_JOINT':'EJ','FLEXIBLE_HOSE':'HO',
            'NIPPLE':'NI','STUB_END':'SE','CAMLOCK':'CM','QUICK_CONNECT':'QC',
            'STEAM_TRAP':'ST','SILENCER':'SI','FLAME_ARRESTER':'FA','VACUUM_BREAKER':'VB',
            'DRAIN_VALVE':'DV','AIR_RELEASE':'AR','SAMPLE_COOLER':'SC','SAMPLE_VALVE':'SV',
            'PLUG_VALVE':'PV','CHOKE_VALVE':'CH','CRYOGENIC_VALVE':'CV','ASEPTIC_VALVE':'AV'
        };
        return fallback[compType] || compType?.substring(0,2) || '??';
    }

    function getScheduleFactor(spec) {
        if (!spec) return 1.0;
        const upper = spec.toUpperCase();
        for (const [key, val] of Object.entries(ISO_CONFIG.PIPE_SCHEDULES)) {
            if (upper.includes(key)) return val;
        }
        return 1.0;
    }

    // ═══════════════════════════════════════════════════════
    // DIBUJO DE GRID Y ORIGEN
    // ═══════════════════════════════════════════════════════
    function drawGrid(elevation = 0) {
        const step = 1000;
        const minX = -10000, maxX = 20000, minZ = -10000, maxZ = 20000;
        _ctx.beginPath();
        _ctx.strokeStyle = '#1e293b';
        _ctx.lineWidth = 1;
        _ctx.globalAlpha = 0.12;
        
        for (let x = minX; x <= maxX; x += step) {
            const p1 = project({ x, y: elevation, z: minZ });
            const p2 = project({ x, y: elevation, z: maxZ });
            _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y);
        }
        for (let z = minZ; z <= maxZ; z += step) {
            const p1 = project({ x: minX, y: elevation, z });
            const p2 = project({ x: maxX, y: elevation, z });
            _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y);
        }
        _ctx.stroke();
        
        // Líneas principales cada 5000mm
        _ctx.strokeStyle = '#334155';
        _ctx.lineWidth = 1.5;
        _ctx.globalAlpha = 0.2;
        _ctx.beginPath();
        for (let x = 0; x <= maxX; x += 5000) {
            for (let sign = -1; sign <= 1; sign += 2) {
                const sx = x * sign;
                const p1 = project({ x: sx, y: elevation, z: minZ });
                const p2 = project({ x: sx, y: elevation, z: maxZ });
                _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y);
            }
        }
        _ctx.stroke();
        _ctx.globalAlpha = 1.0;
    }

    function drawOrigin() {
        const o = project({ x: 0, y: _currentElevation, z: 0 });
        _ctx.beginPath();
        _ctx.moveTo(o.x - 25, o.y); _ctx.lineTo(o.x + 25, o.y);
        _ctx.moveTo(o.x, o.y - 25); _ctx.lineTo(o.x, o.y + 25);
        _ctx.strokeStyle = '#ff8888'; _ctx.lineWidth = 2; _ctx.stroke();
        
        // Etiqueta de origen con formato de ingeniería
        _ctx.fillStyle = '#ff8888'; _ctx.font = 'bold 12px monospace';
        _ctx.fillText(`ORIGEN (0, ${(_currentElevation/1000).toFixed(1)}m, 0)`, o.x + 20, o.y - 10);
        
        // Flecha Norte
        const northAngle = -Math.PI / 6;
        const northLen = 40;
        const nx = o.x + Math.cos(northAngle) * northLen;
        const ny = o.y + Math.sin(northAngle) * northLen;
        _ctx.beginPath();
        _ctx.moveTo(o.x, o.y);
        _ctx.lineTo(nx, ny);
        _ctx.strokeStyle = '#ff4444';
        _ctx.lineWidth = 3;
        _ctx.stroke();
        _ctx.fillStyle = '#ff4444';
        _ctx.font = 'bold 14px monospace';
        _ctx.fillText('N', nx + 5, ny - 5);
    }

    // ═══════════════════════════════════════════════════════
    // DIBUJO DE EQUIPOS MEJORADO
    // ═══════════════════════════════════════════════════════
    
    function drawTank(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const w = (eq.diametro / 2) * _cam.scale;
        const h = eq.altura * _cam.scale;
        const topY = p.y - h/2;
        const bottomY = p.y + h/2;
        const specColor = getSpecColor(eq);

        // Sombra del tanque
        _ctx.save();
        _ctx.fillStyle = 'rgba(0,0,0,0.2)';
        _ctx.beginPath();
        _ctx.ellipse(p.x + 8, bottomY + 8, w, w*0.5, 0, 0, 2*Math.PI);
        _ctx.fill();
        _ctx.restore();

        // Cuerpo con gradiente metálico
        _ctx.beginPath();
        _ctx.ellipse(p.x, bottomY, w, w*0.5, 0, 0, 2*Math.PI);
        const grad = _ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
        grad.addColorStop(0, adjustColor(specColor, -40));
        grad.addColorStop(0.25, adjustColor(specColor, -15));
        grad.addColorStop(0.5, specColor);
        grad.addColorStop(0.75, adjustColor(specColor, 15));
        grad.addColorStop(1, adjustColor(specColor, -30));
        _ctx.fillStyle = grad;
        _ctx.fill();
        _ctx.strokeStyle = '#ffffff44';
        _ctx.lineWidth = 1.5;
        _ctx.stroke();

        // Pared del tanque
        _ctx.fillStyle = adjustColor(specColor, -10);
        _ctx.fillRect(p.x - w, topY, w, h);
        _ctx.fillStyle = specColor;
        _ctx.fillRect(p.x, topY, w, h);
        
        // Línea de soldadura vertical
        _ctx.strokeStyle = '#ffffff33';
        _ctx.lineWidth = 1;
        _ctx.setLineDash([8, 12]);
        _ctx.beginPath();
        _ctx.moveTo(p.x, topY + 10);
        _ctx.lineTo(p.x, bottomY - 10);
        _ctx.stroke();
        _ctx.setLineDash([]);

        // Indicador de nivel (si hay líquido)
        if (eq.nivel && eq.nivel > 0) {
            const nivelY = bottomY - (eq.nivel / eq.altura) * h;
            _ctx.fillStyle = 'rgba(0, 242, 255, 0.15)';
            _ctx.fillRect(p.x - w + 2, nivelY, w - 2, bottomY - nivelY - 2);
            _ctx.strokeStyle = '#00f2ff';
            _ctx.lineWidth = 1;
            _ctx.setLineDash([4, 4]);
            _ctx.beginPath();
            _ctx.moveTo(p.x - w + 5, nivelY);
            _ctx.lineTo(p.x + w - 5, nivelY);
            _ctx.stroke();
            _ctx.setLineDash([]);
        }

        // Techo
        _ctx.beginPath();
        _ctx.ellipse(p.x, topY, w, w*0.5, 0, 0, 2*Math.PI);
        _ctx.fillStyle = adjustColor(specColor, 15);
        _ctx.fill();
        _ctx.strokeStyle = '#ffffff66';
        _ctx.stroke();

        // Etiqueta con formato ISA
        drawEquipmentTag(p.x, topY - 15, eq);
        drawPuertos(eq);
    }

    function getSpecColor(eq) {
        if (eq.spec && typeof SmartFlowCatalog !== 'undefined') {
            const spec = SmartFlowCatalog.getSpec(eq.spec);
            if (spec && spec.color) {
                return '#' + spec.color.toString(16).padStart(6, '0');
            }
        }
        switch(eq.tipo) {
            case 'tanque_v': case 'torre': case 'reactor': return '#2563eb';
            case 'tanque_h': return '#1d4ed8';
            case 'bomba': return '#f39c12';
            default: return '#475569';
        }
    }

    function drawEquipmentTag(x, y, eq) {
        if (!AnnotationManager.isVisible(2)) return;
        
        const tagText = eq.tag || '?';
        const specText = eq.spec ? `[${eq.spec}]` : '';
        const diamText = eq.diametro ? `Ø${eq.diametro}mm` : '';
        
        _ctx.save();
        _ctx.font = `bold ${Math.max(11, 13 * _cam.scale)}px 'Segoe UI', monospace`;
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'bottom';
        _ctx.setTransform(1, 0.5, 0, 1, x, y);
        
        const lines = [tagText];
        if (specText) lines.push(specText);
        if (diamText && _cam.scale > 0.3) lines.push(diamText);
        
        const lineHeight = 16;
        const totalHeight = lines.length * lineHeight + 12;
        let maxWidth = 0;
        lines.forEach(l => { const w = _ctx.measureText(l).width; if (w > maxWidth) maxWidth = w; });
        const boxW = maxWidth + 16;
        
        _ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        _ctx.fillRect(-boxW/2, -totalHeight, boxW, totalHeight);
        _ctx.strokeStyle = '#f59e0b';
        _ctx.lineWidth = 1.5;
        _ctx.strokeRect(-boxW/2, -totalHeight, boxW, totalHeight);
        
        _ctx.fillStyle = '#ffffff';
        lines.forEach((line, i) => {
            _ctx.fillText(line, 0, -totalHeight + 14 + i * lineHeight);
        });
        
        _ctx.restore();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawBomba(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const rad = 18 * _cam.scale;
        const specColor = getSpecColor(eq);
        
        // Sombra
        _ctx.fillStyle = 'rgba(0,0,0,0.25)';
        _ctx.beginPath();
        _ctx.arc(p.x + 4, p.y + 4, rad, 0, 2*Math.PI);
        _ctx.fill();
        
        // Cuerpo
        const grad = _ctx.createRadialGradient(p.x-3, p.y-3, 2, p.x, p.y, rad);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, specColor);
        grad.addColorStop(0.7, adjustColor(specColor, -20));
        grad.addColorStop(1, '#1a1a1a');
        _ctx.fillStyle = grad;
        _ctx.beginPath();
        _ctx.arc(p.x, p.y, rad, 0, 2*Math.PI);
        _ctx.fill();
        _ctx.strokeStyle = '#ffffff66';
        _ctx.lineWidth = 2;
        _ctx.stroke();
        
        // Eje del motor
        _ctx.beginPath();
        _ctx.moveTo(p.x - rad, p.y);
        _ctx.lineTo(p.x + rad, p.y);
        _ctx.strokeStyle = '#ffffff88';
        _ctx.lineWidth = 2;
        _ctx.stroke();
        
        // Flecha de rotación
        const arrowAngle = Date.now() * 0.001 % (Math.PI * 2);
        _ctx.beginPath();
        _ctx.arc(p.x, p.y, rad * 0.6, arrowAngle, arrowAngle + Math.PI/3);
        _ctx.strokeStyle = '#fbbf24';
        _ctx.lineWidth = 2;
        _ctx.setLineDash([4, 3]);
        _ctx.stroke();
        _ctx.setLineDash([]);
        
        drawEquipmentTag(p.x, p.y - rad - 15, eq);
        drawPuertos(eq);
    }

    function drawColector(eq) {
        const pIzq = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const pDer = project({ x: eq.posX + eq.largo, y: eq.posY, z: eq.posZ });
        const specColor = getSpecColor(eq);
        const diam = Math.max(4, (eq.diametro || 4) * _cam.scale * 1.5);
        
        // Sombra
        _ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        _ctx.lineWidth = diam + 6;
        _ctx.beginPath();
        _ctx.moveTo(pIzq.x + 4, pIzq.y + 4);
        _ctx.lineTo(pDer.x + 4, pDer.y + 4);
        _ctx.stroke();
        
        // Cuerpo con gradiente
        const grad = _ctx.createLinearGradient(pIzq.x, pIzq.y, pDer.x, pDer.y);
        grad.addColorStop(0, adjustColor(specColor, -20));
        grad.addColorStop(0.3, specColor);
        grad.addColorStop(0.5, '#ffffffcc');
        grad.addColorStop(0.7, specColor);
        grad.addColorStop(1, adjustColor(specColor, -10));
        _ctx.strokeStyle = grad;
        _ctx.lineWidth = diam;
        _ctx.lineCap = 'round';
        _ctx.beginPath();
        _ctx.moveTo(pIzq.x, pIzq.y);
        _ctx.lineTo(pDer.x, pDer.y);
        _ctx.stroke();
        
        // Brillo
        _ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        _ctx.lineWidth = diam * 0.3;
        _ctx.beginPath();
        _ctx.moveTo(pIzq.x, pIzq.y - diam * 0.2);
        _ctx.lineTo(pDer.x, pDer.y - diam * 0.2);
        _ctx.stroke();
        
        drawEquipmentTag((pIzq.x + pDer.x)/2, pIzq.y - diam - 10, eq);
        drawPuertos(eq);
    }

    function drawRectEquip(eq, color) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const w = (eq.largo || eq.diametro || 1000) * _cam.scale / 2;
        const h = (eq.altura || 1000) * _cam.scale / 2;
        const specColor = color || getSpecColor(eq);
        
        // Sombra
        _ctx.fillStyle = 'rgba(0,0,0,0.25)';
        _ctx.fillRect(p.x - w + 5, p.y - h + 5, w*2, h*2);
        
        // Cuerpo con gradiente
        const grad = _ctx.createLinearGradient(p.x - w, p.y - h, p.x + w, p.y + h);
        grad.addColorStop(0, adjustColor(specColor, -30));
        grad.addColorStop(0.4, specColor);
        grad.addColorStop(0.6, adjustColor(specColor, 15));
        grad.addColorStop(1, adjustColor(specColor, -20));
        _ctx.fillStyle = grad;
        _ctx.fillRect(p.x - w, p.y - h, w*2, h*2);
        
        // Borde
        _ctx.strokeStyle = '#ffffff66';
        _ctx.lineWidth = 2;
        _ctx.strokeRect(p.x - w, p.y - h, w*2, h*2);
        
        // Líneas de panel (detalle de fabricación)
        if (_cam.scale > 0.2) {
            _ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            _ctx.lineWidth = 0.5;
            for (let px = p.x - w + 100; px < p.x + w; px += 300) {
                _ctx.beginPath();
                _ctx.moveTo(px, p.y - h);
                _ctx.lineTo(px, p.y + h);
                _ctx.stroke();
            }
        }
        
        drawEquipmentTag(p.x, p.y - h - 10, eq);
        drawPuertos(eq);
    }

    function drawCilindroHorizontal(eq, color) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const w = (eq.largo || eq.diametro) * _cam.scale / 2;
        const h = (eq.diametro / 2) * _cam.scale;
        const specColor = color || getSpecColor(eq);
        
        // Sombra
        _ctx.fillStyle = 'rgba(0,0,0,0.2)';
        _ctx.fillRect(p.x - w + 4, p.y - h + 4, w*2, h*2);
        
        // Cuerpo
        const grad = _ctx.createLinearGradient(p.x - w, p.y, p.x + w, p.y);
        grad.addColorStop(0, adjustColor(specColor, -30));
        grad.addColorStop(0.3, specColor);
        grad.addColorStop(0.5, '#ffffffcc');
        grad.addColorStop(0.7, specColor);
        grad.addColorStop(1, adjustColor(specColor, -15));
        _ctx.fillStyle = grad;
        _ctx.fillRect(p.x - w, p.y - h, w*2, h*2);
        _ctx.strokeStyle = '#ffffff66';
        _ctx.lineWidth = 1.5;
        _ctx.strokeRect(p.x - w, p.y - h, w*2, h*2);
        
        // Cabezales
        _ctx.beginPath();
        _ctx.ellipse(p.x - w, p.y, h, h*0.5, 0, 0, 2*Math.PI);
        _ctx.fillStyle = adjustColor(specColor, -15);
        _ctx.fill();
        _ctx.stroke();
        
        _ctx.beginPath();
        _ctx.ellipse(p.x + w, p.y, h, h*0.5, 0, 0, 2*Math.PI);
        _ctx.fillStyle = adjustColor(specColor, 15);
        _ctx.fill();
        _ctx.stroke();
        
        drawEquipmentTag(p.x, p.y - h - 10, eq);
        drawPuertos(eq);
    }

    function drawPlataforma(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const w = (eq.largo || 6000) * _cam.scale / 2;
        const d = (eq.ancho || 3000) * _cam.scale / 2;
        const h = (eq.altura || 400) * _cam.scale;
        const material = (eq.material || '').toUpperCase();
        const esConcreto = material.includes('CONCRETO') || material.includes('CEMENTO');
        const esAcero = material.includes('ACERO') || material.includes('STEEL') || material.includes('METAL');
        const topY = p.y - h;

        // Sombra
        _ctx.fillStyle = 'rgba(0,0,0,0.2)';
        _ctx.beginPath();
        _ctx.moveTo(p.x - w + 4, topY + 4);
        _ctx.lineTo(p.x - w + d * 0.5 + 4, topY - d * 0.25 + 4);
        _ctx.lineTo(p.x + d * 0.5 + 4, topY - d * 0.25 + 4);
        _ctx.lineTo(p.x + w + 4, topY + 4);
        _ctx.lineTo(p.x + d * 0.5 + 4, topY + d * 0.25 + 4);
        _ctx.lineTo(p.x - w + d * 0.5 + 4, topY + d * 0.25 + 4);
        _ctx.closePath();
        _ctx.fill();

        // Plancha con textura de rejilla
        if (esAcero) {
            const grad = _ctx.createLinearGradient(p.x - w, topY, p.x + w, topY);
            grad.addColorStop(0, '#4b5563');
            grad.addColorStop(0.3, '#9ca3af');
            grad.addColorStop(0.5, '#d1d5db');
            grad.addColorStop(0.7, '#9ca3af');
            grad.addColorStop(1, '#4b5563');
            _ctx.fillStyle = grad;
        } else {
            _ctx.fillStyle = esConcreto ? '#9ca3af' : '#6b7280';
        }
        
        _ctx.strokeStyle = esConcreto ? '#6b7280' : '#4b5563';
        _ctx.lineWidth = 2;
        _ctx.beginPath();
        _ctx.moveTo(p.x - w, topY);
        _ctx.lineTo(p.x - w + d * 0.5, topY - d * 0.25);
        _ctx.lineTo(p.x + d * 0.5, topY - d * 0.25);
        _ctx.lineTo(p.x + w, topY);
        _ctx.lineTo(p.x + d * 0.5, topY + d * 0.25);
        _ctx.lineTo(p.x - w + d * 0.5, topY + d * 0.25);
        _ctx.closePath();
        _ctx.fill();
        _ctx.stroke();

        // Textura de rejilla (patrón de rombos)
        if (esAcero && _cam.scale > 0.15) {
            _ctx.strokeStyle = '#374151';
            _ctx.lineWidth = 0.5;
            const panelSize = 400 * _cam.scale;
            const largoTotal = w * 2;
            const panelesX = Math.floor(largoTotal / panelSize);
            for (let i = 1; i < panelesX; i++) {
                const offsetX = -w + i * panelSize;
                const p1 = { x: p.x + offsetX, y: topY, z: eq.posZ - (eq.ancho || 3000) / 2 };
                const p2 = { x: p.x + offsetX, y: topY, z: eq.posZ + (eq.ancho || 3000) / 2 };
                const proj1 = project(p1);
                const proj2 = project(p2);
                _ctx.beginPath();
                _ctx.moveTo(proj1.x, proj1.y);
                _ctx.lineTo(proj2.x, proj2.y);
                _ctx.stroke();
            }
        }

        // Columnas con detalle
        const patas = [
            { x: eq.posX - (eq.largo || 6000) / 2, z: eq.posZ - (eq.ancho || 3000) / 2 },
            { x: eq.posX + (eq.largo || 6000) / 2, z: eq.posZ - (eq.ancho || 3000) / 2 },
            { x: eq.posX + (eq.largo || 6000) / 2, z: eq.posZ + (eq.ancho || 3000) / 2 },
            { x: eq.posX - (eq.largo || 6000) / 2, z: eq.posZ + (eq.ancho || 3000) / 2 }
        ];
        patas.forEach(pta => {
            const top = project({ x: pta.x, y: eq.posY - (eq.altura || 400), z: pta.z });
            const bot = project({ x: pta.x, y: eq.posY, z: pta.z });
            
            // Sombra de columna
            _ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            _ctx.lineWidth = 8;
            _ctx.beginPath();
            _ctx.moveTo(top.x + 3, top.y + 3);
            _ctx.lineTo(bot.x + 3, bot.y + 3);
            _ctx.stroke();
            
            // Columna
            _ctx.strokeStyle = esAcero ? '#6b7280' : '#9ca3af';
            _ctx.lineWidth = 5;
            _ctx.beginPath();
            _ctx.moveTo(top.x, top.y);
            _ctx.lineTo(bot.x, bot.y);
            _ctx.stroke();
            
            // Placa base
            const baseW = 20 * _cam.scale;
            _ctx.fillStyle = '#555555';
            _ctx.fillRect(bot.x - baseW, bot.y - 3, baseW * 2, 6);
        });

        // Barandas
        if (eq.baranda) {
            _ctx.strokeStyle = '#fbbf24';
            _ctx.lineWidth = 1.5;
            const esquinas = [
                { x: eq.posX - (eq.largo || 6000) / 2, z: eq.posZ - (eq.ancho || 3000) / 2 },
                { x: eq.posX + (eq.largo || 6000) / 2, z: eq.posZ - (eq.ancho || 3000) / 2 },
                { x: eq.posX + (eq.largo || 6000) / 2, z: eq.posZ + (eq.ancho || 3000) / 2 },
                { x: eq.posX - (eq.largo || 6000) / 2, z: eq.posZ + (eq.ancho || 3000) / 2 }
            ];
            const barandaH = 1100;
            for (let i = 0; i < esquinas.length; i++) {
                const a = esquinas[i];
                const b = esquinas[(i + 1) % esquinas.length];
                const projATop = project({ x: a.x, y: eq.posY - (eq.altura || 400) - barandaH, z: a.z });
                const projBTop = project({ x: b.x, y: eq.posY - (eq.altura || 400) - barandaH, z: b.z });
                _ctx.beginPath();
                _ctx.moveTo(projATop.x, projATop.y);
                _ctx.lineTo(projBTop.x, projBTop.y);
                _ctx.stroke();
                
                // Postes verticales
                const projA = project({ x: a.x, y: eq.posY - (eq.altura || 400), z: a.z });
                _ctx.beginPath();
                _ctx.moveTo(projA.x, projA.y);
                _ctx.lineTo(projATop.x, projATop.y);
                _ctx.stroke();
            }
        }

        drawEquipmentTag(p.x, topY - 35, eq);
    }

    // ═══════════════════════════════════════════════════════
    // TUBERÍAS MEJORADAS CON SCHEDULE Y DETALLES
    // ═══════════════════════════════════════════════════════
    
    function drawPipeWithElbows(line) {
        const originalPts = _core ? _core.getLinePoints(line) : (line._cachedPoints || line.points3D);
        if (!originalPts || originalPts.length < 2) return;
        const pts = originalPts.map((p, idx) => ({ ...p }));
        
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
        const scheduleFactor = getScheduleFactor(line.spec);
        const radioBase = isPPR ? (line.diameter * 25.4 * 0.8) : (line.diameter * 25.4 * 1.5 * scheduleFactor);
        const radio = Math.min(radioBase, 350);
        const baseWidth = (line.diameter || 4) * _cam.scale * scheduleFactor;
        const mainWidth = Math.max(5, baseWidth);
        _ctx.lineCap = 'round'; _ctx.lineJoin = 'round';
        const hasAuditError = lineHasAuditError(line);
        const matShort = getShortMaterial(line.material);
        const lineLabel = line.service ? `${line.diameter}"-${line.service}` : `${line.diameter}"-${matShort}`;

        const drawPath = () => {
            _ctx.beginPath();
            let first = project(pts[0]); _ctx.moveTo(first.x, first.y);
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

        // Sombra
        _ctx.save(); drawPath();
        _ctx.shadowColor = '#00000066'; _ctx.shadowBlur = 14 * _cam.scale;
        _ctx.shadowOffsetX = 0; _ctx.shadowOffsetY = 8 * _cam.scale;
        _ctx.strokeStyle = '#00000044'; _ctx.lineWidth = mainWidth + 12; _ctx.stroke(); _ctx.restore();

        // Capas de la tubería
        drawPath(); _ctx.strokeStyle = '#0a0e17'; _ctx.lineWidth = mainWidth + 6; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = '#1e293b'; _ctx.lineWidth = mainWidth + 3; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = grad; _ctx.lineWidth = mainWidth; _ctx.stroke();
        
        // Brillo especular
        drawPath(); _ctx.strokeStyle = 'rgba(255,255,255,0.25)'; _ctx.lineWidth = mainWidth * 0.45; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = '#ffffff'; _ctx.lineWidth = Math.max(1.2, mainWidth * 0.12); _ctx.globalAlpha = 0.85; _ctx.stroke(); _ctx.globalAlpha = 1.0;

        // Aislamiento térmico (si aplica)
        if (line.insulation) {
            drawPath();
            const insulColor = ISO_CONFIG.INSULATION_COLORS[line.insulation] || '#ffaa00';
            _ctx.strokeStyle = insulColor;
            _ctx.lineWidth = mainWidth + 8;
            _ctx.globalAlpha = 0.2;
            _ctx.setLineDash([10, 5]);
            _ctx.stroke();
            _ctx.setLineDash([]);
            _ctx.globalAlpha = 1.0;
        }

        // Soldaduras en tubería metálica (cada 6m)
        if (!isPPR && _cam.scale > 0.15) {
            let accumDist = 0;
            for (let i = 0; i < pts.length - 1; i++) {
                const segLen = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                while (accumDist + segLen > 6000) {
                    const t = (6000 - accumDist) / segLen;
                    if (t > 0.05 && t < 0.95) {
                        const weldPos = {
                            x: pts[i].x + (pts[i+1].x - pts[i].x) * t,
                            y: pts[i].y + (pts[i+1].y - pts[i].y) * t,
                            z: pts[i].z + (pts[i+1].z - pts[i].z) * t
                        };
                        const projWeld = project(weldPos);
                        _ctx.fillStyle = '#fbbf24';
                        _ctx.beginPath();
                        _ctx.arc(projWeld.x, projWeld.y, mainWidth * 0.6, 0, Math.PI * 2);
                        _ctx.fill();
                        _ctx.fillStyle = '#ffffff';
                        _ctx.font = `${Math.max(6, mainWidth * 0.4)}px monospace`;
                        _ctx.textAlign = 'center';
                        _ctx.fillText('W', projWeld.x, projWeld.y + 3);
                    }
                    accumDist -= 6000;
                }
                accumDist += segLen;
            }
        }

        // Componentes en línea
        if (isPPR && line.components && line.components.length > 0) {
            line.components.forEach(comp => {
                try {
                    if (comp.param === undefined || comp.param === null) return;
                    let targetLen = 0;
                    for (let i = 0; i < pts.length - 1; i++) targetLen += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
                    if (targetLen === 0) return;
                    const compPos = getPointAtDistance(pts[0], pts[pts.length-1], targetLen * comp.param);
                    if (!compPos) return;
                    const projComp = project(compPos);
                    _ctx.beginPath();
                    _ctx.arc(projComp.x, projComp.y, mainWidth * 0.9, 0, Math.PI*2);
                    _ctx.fillStyle = '#065f46'; _ctx.fill();
                    _ctx.strokeStyle = '#034028'; _ctx.lineWidth = 1.5; _ctx.stroke();
                } catch (e) {}
            });
        }

        // Alerta de auditoría
        if (hasAuditError && pts.length >= 2) {
            const midIndex = Math.floor(pts.length / 2);
            const alertPt = pts[midIndex];
            const projAlert = project(alertPt);
            _ctx.save(); _ctx.translate(projAlert.x, projAlert.y - 30*_cam.scale);
            _ctx.font = `bold ${Math.max(16,20*_cam.scale)}px "Segoe UI"`; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
            _ctx.shadowColor = '#ef4444'; _ctx.shadowBlur = 10; _ctx.fillStyle = '#ef4444';
            _ctx.fillText('⚠', 0, 0); _ctx.shadowBlur = 0; _ctx.restore();
        }

        // Cotas (dimensiones)
        if (line.showDimensions !== false && !isSelected(line) && AnnotationManager.isVisible(1)) {
            const puntosReales = pts.filter(p => !p.isControlPoint);
            for (let i = 0; i < puntosReales.length - 1; i++) {
                const p1 = puntosReales[i], p2 = puntosReales[i+1];
                if (Math.hypot(p2.x-p1.x, p2.y-p1.y, p2.z-p1.z) > 100) {
                    drawIsometricDimension(p1, p2, 1200);
                }
            }
        }

        // Flecha de flujo
        if (pts.length >= 2) drawFlowArrow(pts[0], pts[pts.length-1], line.diameter);
        
        // Etiqueta de línea con formato ingenieril
        if (lineLabel && pts.length >= 2 && AnnotationManager.isVisible(3)) {
            const midPt = getPointAtDistance(pts[0], pts[pts.length-1], 
                Math.hypot(pts[pts.length-1].x-pts[0].x, pts[pts.length-1].y-pts[0].y, pts[pts.length-1].z-pts[0].z)/2);
            const projMid = project(midPt);
            const plane = Math.abs(pts[1].x-pts[0].x) > Math.abs(pts[1].z-pts[0].z) ? 'XY' : 'ZY';
            
            _ctx.save();
            _ctx.font = `bold ${Math.max(9, 11*_cam.scale)}px monospace`;
            _ctx.textAlign = 'center';
            _ctx.textBaseline = 'bottom';
            if (plane === 'XY') _ctx.setTransform(1, 0.5, 0, 1, projMid.x, projMid.y - 20*_cam.scale);
            else _ctx.setTransform(1, -0.5, 0, 1, projMid.x, projMid.y - 20*_cam.scale);
            
            const fullLabel = `${line.diameter}" ${matShort} ${line.spec || ''}`;
            const tw = _ctx.measureText(fullLabel).width;
            _ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
            _ctx.fillRect(-tw/2 - 6, -12, tw + 12, 20);
            _ctx.strokeStyle = '#00f2ff66';
            _ctx.strokeRect(-tw/2 - 6, -12, tw + 12, 20);
            _ctx.fillStyle = '#00f2ff';
            _ctx.fillText(fullLabel, 0, 0);
            _ctx.restore();
            _ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        
        if (line.puertos) drawPuertos(line);
    }

    function isSelected(line) {
        return _core && _core.getSelected() && _core.getSelected().obj === line;
    }

    // ═══════════════════════════════════════════════════════
    // COTAS Y DIMENSIONES MEJORADAS (ISO 129)
    // ═══════════════════════════════════════════════════════
    
    function drawIsometricDimension(p1, p2, offset = 1200) {
        const realDist = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        if (realDist < 50) return;
        const dynamicOffset = Math.max(600, Math.min(3000, realDist * 0.4));
        const finalOffset = offset || dynamicOffset;
        const orientation = getPipeOrientation(p1, p2);
        
        let candA, candB;
        if (orientation === 'horizontal') { 
            candA = { dx: 0, dy: -finalOffset, dz: 0 }; 
            candB = { dx: 0, dy: finalOffset, dz: 0 }; 
        } else { 
            candA = { dx: finalOffset, dy: 0, dz: 0 }; 
            candB = { dx: -finalOffset, dy: 0, dz: 0 }; 
        }
        
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
        
        // Líneas de extensión (witness lines)
        _ctx.beginPath(); _ctx.setLineDash([4,4]); _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 0.8;
        _ctx.moveTo(pr1.x, pr1.y); _ctx.lineTo(prD1.x, prD1.y);
        _ctx.moveTo(pr2.x, pr2.y); _ctx.lineTo(prD2.x, prD2.y); _ctx.stroke(); _ctx.setLineDash([]);

        // Línea de cota
        _ctx.beginPath(); _ctx.moveTo(prD1.x, prD1.y); _ctx.lineTo(prD2.x, prD2.y);
        _ctx.strokeStyle = '#00ffcc'; _ctx.lineWidth = 1.5; _ctx.stroke();

        // Ticks de cota (marcas a 45°)
        _ctx.strokeStyle = '#00ffcc'; _ctx.lineWidth = 1.5;
        const tickSize = 8;
        _ctx.beginPath(); 
        _ctx.moveTo(prD1.x - tickSize, prD1.y + tickSize); _ctx.lineTo(prD1.x + tickSize, prD1.y - tickSize); 
        _ctx.stroke();
        _ctx.beginPath(); 
        _ctx.moveTo(prD2.x - tickSize, prD2.y + tickSize); _ctx.lineTo(prD2.x + tickSize, prD2.y - tickSize); 
        _ctx.stroke();

        // Texto de cota centrado
        const midX = (prD1.x + prD2.x) / 2, midY = (prD1.y + prD2.y) / 2;
        const dimText = formatDimensionText(realDist);
        _ctx.font = `bold ${Math.max(10, 12 * _cam.scale)}px "Courier New", monospace`;
        _ctx.fillStyle = '#ffffff';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';

        // Fondo del texto
        const textW = _ctx.measureText(dimText).width + 8;
        _ctx.fillStyle = 'rgba(10, 15, 30, 0.9)';
        _ctx.fillRect(midX - textW/2, midY - 9, textW, 18);
        _ctx.strokeStyle = '#00ffcc';
        _ctx.lineWidth = 1;
        _ctx.strokeRect(midX - textW/2, midY - 9, textW, 18);
        
        _ctx.fillStyle = '#00ffcc';
        if (plane === 'LEFT') {
            _ctx.setTransform(1, 0.5, 0, 1, midX, midY);
        } else if (plane === 'RIGHT') {
            _ctx.setTransform(1, -0.5, 0, 1, midX, midY);
        }
        _ctx.fillText(dimText, 0, 0);
        _ctx.restore();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // ═══════════════════════════════════════════════════════
    // FUNCIONES AUXILIARES (MANTENIDAS DEL ORIGINAL)
    // ═══════════════════════════════════════════════════════

    function drawFlowArrow(p1, p2, diameter) {
        if (!p1 || !p2) return;
        const proj1 = project(p1), proj2 = project(p2);
        const angle = Math.atan2(proj2.y - proj1.y, proj2.x - proj1.x);
        const midX = (proj1.x + proj2.x) / 2, midY = (proj1.y + proj2.y) / 2;
        _ctx.save(); _ctx.translate(midX, midY); _ctx.rotate(angle);
        const arrowSize = 12 * _cam.scale;
        _ctx.beginPath();
        _ctx.moveTo(-arrowSize, -arrowSize/2); _ctx.lineTo(0, 0); _ctx.lineTo(-arrowSize, arrowSize/2);
        _ctx.fillStyle = '#00f2ff'; _ctx.shadowColor = '#00f2ff'; _ctx.shadowBlur = 8;
        _ctx.fill(); _ctx.shadowBlur = 0; _ctx.restore();
    }

    function drawPuertos(obj) {
        if (!obj.puertos) return;
        const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ } : 
                       (obj._cachedPoints && obj._cachedPoints.length > 0 ? obj._cachedPoints[0] : { x: 0, y: 0, z: 0 });
        obj.puertos.forEach(nz => {
            const pos = { 
                x: posBase.x + (nz.relX || nz.relPos?.x || 0), 
                y: posBase.y + (nz.relY || nz.relPos?.y || 0), 
                z: posBase.z + (nz.relZ || nz.relPos?.z || 0) 
            };
            const proj = project(pos);
            
            if (nz.orientacion) {
                const dir = nz.orientacion;
                const endPos = { x: pos.x + dir.dx * 250, y: pos.y + dir.dy * 250, z: pos.z + dir.dz * 250 };
                const projEnd = project(endPos);
                _ctx.beginPath(); _ctx.moveTo(proj.x, proj.y); _ctx.lineTo(projEnd.x, projEnd.y);
                _ctx.strokeStyle = '#ffaa00'; _ctx.lineWidth = 2; _ctx.stroke();
                
                const arrowAngle = Math.atan2(projEnd.y - proj.y, projEnd.x - proj.x);
                const arrowSize = 8;
                _ctx.beginPath();
                _ctx.moveTo(projEnd.x, projEnd.y);
                _ctx.lineTo(projEnd.x - arrowSize * Math.cos(arrowAngle - 0.5), projEnd.y - arrowSize * Math.sin(arrowAngle - 0.5));
                _ctx.lineTo(projEnd.x - arrowSize * Math.cos(arrowAngle + 0.5), projEnd.y - arrowSize * Math.sin(arrowAngle + 0.5));
                _ctx.closePath(); _ctx.fillStyle = '#ffaa00'; _ctx.fill();
            }
            
            _ctx.beginPath(); _ctx.arc(proj.x, proj.y, 6, 0, 2*Math.PI);
            _ctx.fillStyle = nz.connectedLine ? '#4ade80' : '#ff8800'; _ctx.fill();
            _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 1; _ctx.stroke();
            
            const label = `${nz.id} ${nz.diametro || obj.diameter || 3}"`;
            _ctx.font = `bold ${Math.max(8, 10*_cam.scale)}px monospace`;
            _ctx.fillStyle = '#ffffff';
            _ctx.fillText(label, proj.x + 10, proj.y - 6);
        });
    }

    function drawPipeComponents(line) {
        if (!_core) return;
        const pts = _core.getLinePoints(line);
        if (!pts || pts.length < 2 || !line.components) return;
        
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            let d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d); totalLen += d;
        }
        if (totalLen === 0) return;
        
        line.components.forEach((comp, idx) => {
            let targetLen = totalLen * Math.min(1, Math.max(0, comp.param || 0.5));
            let currentAccum = 0, p1, p2, t = 0;
            for (let i = 0; i < lengths.length; i++) {
                if (currentAccum + lengths[i] >= targetLen || i === lengths.length - 1) {
                    p1 = pts[i]; p2 = pts[i+1];
                    let segLen = lengths[i]; t = segLen > 0 ? (targetLen - currentAccum) / segLen : 0;
                    t = Math.min(1, Math.max(0, t)); break;
                }
                currentAccum += lengths[i];
            }
            if (!p1 || !p2) return;
            const pos3D = { x: p1.x + (p2.x-p1.x)*t, y: p1.y + (p2.y-p1.y)*t, z: p1.z + (p2.z-p1.z)*t };
            const proj = project(pos3D);
            const dir3D = getSegmentDirection3D(p1, p2);
            const isHovered = _hoveredComponent && _hoveredComponent.comp === comp;
            
            _ctx.save();
            if (isHovered) {
                _ctx.shadowColor = '#fbbf24'; _ctx.shadowBlur = 18;
                _ctx.globalAlpha = 1.0;
            } else {
                _ctx.shadowColor = 'transparent'; _ctx.shadowBlur = 0;
                _ctx.globalAlpha = 0.7;
            }
            drawSymbol(proj.x, proj.y, dir3D, comp);
            _ctx.restore();
            
            comp._screenPos = proj;
            if (AnnotationManager.isVisible(3)) {
                const globalIndex = _bomItems.length + 1;
                drawComponentTag(proj, globalIndex, comp.type, dir3D);
                comp._bomIndex = globalIndex;
                _bomItems.push({
                    index: globalIndex,
                    desc: getComponentLabel(comp.type),
                    mat: getShortMaterial(line.material),
                    comp: comp
                });
            }
        });
    }

    function drawSymbol(x, y, dir3D, comp) {
        _ctx.save();
        const s = Math.max(10, 16 * _cam.scale);
        _ctx.lineWidth = 1.8;
        _ctx.strokeStyle = '#e2e8f0';
        _ctx.fillStyle = '#0f172a';

        if (dir3D === 'X') { _ctx.setTransform(1, 0.5, 0, 1, x, y); }
        else if (dir3D === 'Z') { _ctx.setTransform(1, -0.5, 0, 1, x, y); }
        else if (dir3D === 'Y') { _ctx.setTransform(0, 1, -1, 0, x, y); }

        switch (comp.type) {
            case 'BUTTERFLY_VALVE':
                _ctx.beginPath(); _ctx.ellipse(0, 0, s*0.9, s*0.3, 0, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(0,0); _ctx.lineTo(0, -s*1.6);
                _ctx.strokeStyle = '#ef4444'; _ctx.lineWidth = 2.5; _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(-s*0.8, -s*1.6); _ctx.lineTo(s*0.8, -s*1.6); _ctx.stroke();
                _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, -s*1.6, 3, 0, Math.PI*2); _ctx.fill();
                break;
            case 'BALL_VALVE': case 'VALVE_BALL':
                const ballGrad = _ctx.createRadialGradient(-s*0.15, -s*0.15, s*0.05, 0, 0, s*0.65);
                ballGrad.addColorStop(0, '#ffffff'); ballGrad.addColorStop(0.6, '#94a3b8'); ballGrad.addColorStop(1, '#1e293b');
                _ctx.beginPath(); _ctx.arc(0, 0, s*0.65, 0, Math.PI*2); _ctx.fillStyle = ballGrad; _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(-s, -s*0.55); _ctx.lineTo(-s, s*0.55); _ctx.lineTo(0, 0); _ctx.closePath();
                _ctx.moveTo(s, -s*0.55); _ctx.lineTo(s, s*0.55); _ctx.lineTo(0, 0); _ctx.closePath();
                _ctx.fillStyle = '#1e293b'; _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(0, -s*0.35); _ctx.lineTo(0, -s*1.3); _ctx.lineTo(s*0.7, -s*1.3);
                _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2; _ctx.stroke();
                break;
            case 'GATE_VALVE':
                _ctx.beginPath(); _ctx.moveTo(-s, -s*0.6); _ctx.lineTo(s, s*0.6); _ctx.lineTo(s, -s*0.6); _ctx.lineTo(-s, s*0.6); _ctx.closePath();
                _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(0, 0); _ctx.lineTo(0, -s*1.4);
                _ctx.moveTo(-s*0.6, -s*1.4); _ctx.lineTo(s*0.6, -s*1.4); _ctx.stroke();
                _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, -s*1.4, 3.5, 0, Math.PI*2); _ctx.fill();
                break;
            case 'GLOBE_VALVE':
                _ctx.beginPath(); _ctx.ellipse(0, 0, s*0.9, s*0.55, 0, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(0, -s*0.55); _ctx.lineTo(0, s*0.55); _ctx.strokeStyle = '#e2e8f0'; _ctx.stroke();
                _ctx.fillStyle = '#1e293b'; _ctx.fillRect(-s*0.35, -s*1.2, s*0.7, s*0.55);
                _ctx.strokeRect(-s*0.35, -s*1.2, s*0.7, s*0.55);
                _ctx.beginPath(); _ctx.moveTo(-s*0.2, -s*1.2); _ctx.lineTo(s*0.2, -s*1.2); _ctx.stroke();
                break;
            case 'CHECK_VALVE':
                _ctx.strokeRect(-s, -s*0.45, s*2, s*0.9);
                _ctx.fillStyle = '#4ade80'; _ctx.beginPath();
                _ctx.moveTo(-s*0.5, 0); _ctx.lineTo(s*0.3, -s*0.3); _ctx.lineTo(s*0.3, s*0.3); _ctx.closePath();
                _ctx.fill(); _ctx.stroke();
                _ctx.setLineDash([2,2]); _ctx.beginPath(); _ctx.moveTo(-s, 0); _ctx.lineTo(-s*0.5, 0); _ctx.stroke(); _ctx.setLineDash([]);
                break;
            case 'CONCENTRIC_REDUCER': case 'ECCENTRIC_REDUCER':
                const reducGrad = _ctx.createLinearGradient(-s, 0, s, 0);
                reducGrad.addColorStop(0, '#475569'); reducGrad.addColorStop(1, '#94a3b8');
                _ctx.beginPath(); _ctx.moveTo(-s, -s*0.5); _ctx.lineTo(s, -s*0.8); _ctx.lineTo(s, s*0.8); _ctx.lineTo(-s, s*0.5); _ctx.closePath();
                _ctx.fillStyle = reducGrad; _ctx.fill(); _ctx.stroke();
                if (comp.type === 'ECCENTRIC_REDUCER') {
                    _ctx.beginPath(); _ctx.moveTo(-s, -s*0.5); _ctx.lineTo(-s, s*0.5); _ctx.strokeStyle = '#facc15'; _ctx.lineWidth = 2; _ctx.stroke();
                }
                break;
            case 'WELD_NECK_FLANGE':
                _ctx.fillRect(-s*0.3, -s*0.9, s*0.6, s*1.8); _ctx.strokeRect(-s*0.3, -s*0.9, s*0.6, s*1.8);
                for (let py = -0.7; py <= 0.7; py += 0.45) {
                    _ctx.beginPath(); _ctx.arc(-s*0.5, py*s, 1.5, 0, Math.PI*2); _ctx.fillStyle = '#64748b'; _ctx.fill();
                    _ctx.beginPath(); _ctx.arc(s*0.5, py*s, 1.5, 0, Math.PI*2); _ctx.fill();
                }
                break;
            case 'SLIP_ON_FLANGE': case 'BLIND_FLANGE': case 'LAP_JOINT_FLANGE':
                _ctx.beginPath(); _ctx.moveTo(-s*0.4, -s); _ctx.lineTo(-s*0.4, s); _ctx.moveTo(s*0.4, -s); _ctx.lineTo(s*0.4, s); _ctx.lineWidth = 1; _ctx.stroke();
                _ctx.fillRect(-s*0.7, -s*0.9, s*1.4, s*1.8); _ctx.strokeRect(-s*0.7, -s*0.9, s*1.4, s*1.8);
                if (comp.type === 'BLIND_FLANGE') { 
                    _ctx.beginPath(); _ctx.moveTo(-s*0.5,-s*0.7); _ctx.lineTo(s*0.5,s*0.7); 
                    _ctx.moveTo(s*0.5,-s*0.7); _ctx.lineTo(-s*0.5,s*0.7); _ctx.stroke(); 
                }
                break;
            case 'TEE_EQUAL': case 'TEE_REDUCING':
                _ctx.beginPath(); _ctx.moveTo(-s*0.9, 0); _ctx.lineTo(s*0.9, 0); _ctx.moveTo(0, 0); _ctx.lineTo(0, -s*1.3);
                _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2.5; _ctx.stroke();
                _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, 0, s*0.3, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                if (comp.type === 'TEE_REDUCING') { _ctx.fillStyle = '#facc15'; _ctx.beginPath(); _ctx.arc(0, -s*1.3, s*0.25, 0, Math.PI*2); _ctx.fill(); }
                break;
            case 'ELBOW_45':
                _ctx.beginPath(); _ctx.arc(0, 0, s, 0, Math.PI/4); _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2.5; _ctx.stroke();
                _ctx.fillStyle = '#ffffff'; _ctx.beginPath(); _ctx.arc(0, 0, 3, 0, Math.PI*2); _ctx.fill();
                break;
            case 'ELBOW_90_LR': case 'ELBOW_90_SR':
                const r = comp.type === 'ELBOW_90_LR' ? s*1.3 : s*0.8;
                _ctx.beginPath(); _ctx.arc(0, 0, r, 0, Math.PI/2); _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2.5; _ctx.stroke();
                _ctx.fillStyle = '#ffffff'; _ctx.beginPath(); _ctx.arc(0, 0, 3, 0, Math.PI*2); _ctx.fill();
                break;
            case 'CAP':
                _ctx.beginPath(); _ctx.arc(0, 0, s*0.7, 0, Math.PI, true); _ctx.closePath(); _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(-s*0.7, 0); _ctx.lineTo(-s*1.1, 0); _ctx.moveTo(s*0.7, 0); _ctx.lineTo(s*1.1, 0); _ctx.stroke();
                break;
            case 'UNION': case 'UNION_ACERO':
                _ctx.fillRect(-s*0.7, -s*0.7, s*1.4, s*1.4); _ctx.strokeRect(-s*0.7, -s*0.7, s*1.4, s*1.4);
                for (let i = -0.5; i <= 0.5; i += 0.25) { _ctx.beginPath(); _ctx.moveTo(-s*0.7, i*s); _ctx.lineTo(s*0.7, i*s); _ctx.strokeStyle = '#334155'; _ctx.lineWidth = 1; _ctx.stroke(); }
                break;
            case 'BULKHEAD':
                _ctx.beginPath(); _ctx.moveTo(-s*0.25, -s*1.3); _ctx.lineTo(-s*0.25, s*1.3); _ctx.lineWidth = 5; _ctx.strokeStyle = '#94a3b8'; _ctx.stroke();
                _ctx.lineWidth = 1.8; _ctx.strokeStyle = '#e2e8f0'; _ctx.strokeRect(-s*1.1, -s*0.6, s*2.2, s*1.2);
                break;
            case 'TRANSITION': case 'ADAPTADOR_MACHO_PPR_3IN': case 'ADAPTADOR_HEMBRA_PPR_3IN':
                _ctx.beginPath(); _ctx.moveTo(-s, -s*0.6); _ctx.lineTo(s*0.2, -s*0.8); _ctx.lineTo(s*0.2, s*0.8); _ctx.lineTo(-s, s*0.6); _ctx.closePath();
                _ctx.fillStyle = '#1e293b'; _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(s*0.2, -s*0.6); _ctx.lineTo(s*0.9, -s*0.6); _ctx.lineTo(s*0.9, s*0.6); _ctx.lineTo(s*0.2, s*0.6);
                _ctx.fillStyle = '#475569'; _ctx.fill(); _ctx.stroke();
                break;
            case 'NIPPLE':
                _ctx.fillRect(-s*0.9, -s*0.45, s*1.8, s*0.9); _ctx.strokeRect(-s*0.9, -s*0.45, s*1.8, s*0.9);
                for (let i = -0.3; i <= 0.3; i += 0.2) { _ctx.beginPath(); _ctx.moveTo(-s*0.9, i*s); _ctx.lineTo(s*0.9, i*s); _ctx.strokeStyle = '#475569'; _ctx.lineWidth = 1; _ctx.stroke(); }
                break;
            case 'EXPANSION_JOINT':
                _ctx.fillRect(-s*0.8, -s*0.7, s*1.6, s*1.4); _ctx.strokeRect(-s*0.8, -s*0.7, s*1.6, s*1.4);
                for (let i = -0.55; i <= 0.55; i += 0.35) { _ctx.beginPath(); _ctx.moveTo(-s*0.8, i*s); _ctx.lineTo(s*0.8, i*s); _ctx.strokeStyle = '#fbbf24'; _ctx.lineWidth = 1; _ctx.stroke(); }
                break;
            case 'Y_STRAINER':
                _ctx.beginPath(); _ctx.moveTo(-s, 0); _ctx.lineTo(0, -s*0.9); _ctx.lineTo(s, 0); _ctx.lineTo(0, s*0.4); _ctx.closePath();
                _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(-s, 0); _ctx.lineTo(s, 0); _ctx.strokeStyle = '#4ade80'; _ctx.lineWidth = 2; _ctx.stroke();
                break;
            case 'PIPE_SHOE': case 'U_BOLT': case 'GUIDE': case 'ANCHOR': case 'HANGER': case 'PIPE_CLAMP': case 'SPRING_HANGER':
                _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 1.2; _ctx.setLineDash([3, 3]);
                _ctx.beginPath(); _ctx.moveTo(-s*0.9, 0); _ctx.lineTo(s*0.9, 0);
                if (comp.type === 'ANCHOR') { _ctx.moveTo(-s*0.6, -s*0.5); _ctx.lineTo(-s*0.6, s*0.5); _ctx.moveTo(s*0.6, -s*0.5); _ctx.lineTo(s*0.6, s*0.5); }
                _ctx.stroke(); _ctx.setLineDash([]);
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
        const leaderX = proj2d.x + 25;
        const leaderY = proj2d.y - 25;
        _ctx.save();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.strokeStyle = '#94a3b8';
        _ctx.lineWidth = 0.8;
        _ctx.beginPath();
        _ctx.moveTo(proj2d.x, proj2d.y);
        _ctx.lineTo(leaderX, leaderY);
        _ctx.stroke();
        _ctx.fillStyle = '#0f172a';
        _ctx.strokeStyle = '#38bdf8';
        _ctx.lineWidth = 1;
        const boxW = 22, boxH = 14;
        _ctx.fillRect(leaderX - boxW/2, leaderY - boxH/2, boxW, boxH);
        _ctx.strokeRect(leaderX - boxW/2, leaderY - boxH/2, boxW, boxH);
        _ctx.fillStyle = '#ffffff';
        _ctx.font = 'bold 8px Inter';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText(tagText, leaderX, leaderY);
        _ctx.restore();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawSelection(element) {
        if (!element) return;
        _ctx.save();
        _ctx.strokeStyle = '#facc15'; _ctx.lineWidth = 4; _ctx.shadowColor = '#facc15'; _ctx.shadowBlur = 12;
        if (element.type === 'equipment') {
            const eq = element.obj;
            if (eq.tipo === 'colector') {
                const pIzq = project({ x: eq.posX, y: eq.posY, z: eq.posZ }), pDer = project({ x: eq.posX + eq.largo, y: eq.posY, z: eq.posZ });
                _ctx.beginPath(); _ctx.moveTo(pIzq.x, pIzq.y); _ctx.lineTo(pDer.x, pDer.y); _ctx.stroke();
            } else if (eq.tipo === 'tanque_v' || eq.tipo === 'torre' || eq.tipo === 'reactor') {
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
            if (pts && pts.length >= 2) { 
                _ctx.beginPath(); 
                pts.forEach((p,i) => { const pr = project(p); i===0 ? _ctx.moveTo(pr.x,pr.y) : _ctx.lineTo(pr.x,pr.y); }); 
                _ctx.stroke(); 
            }
        }
        _ctx.restore();
    }

    // ═══════════════════════════════════════════════════════
    // FUNCIONES DE PICKING, PROYECCIÓN Y UTILIDAD
    // ═══════════════════════════════════════════════════════

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
                const radius = (eq.diametro / 2) + margin;
                return (dx <= radius && dz <= radius);
            } else if (eq.tipo === 'tanque_h') {
                const halfL = (eq.largo / 2) + margin, halfD = (eq.diametro / 2) + margin;
                const dx = Math.abs(point.x - eq.posX), dz = Math.abs(point.z - eq.posZ);
                return (dx <= halfL && dz <= halfD);
            } else {
                const halfL = ((eq.largo || 1000) / 2) + margin, halfW = ((eq.ancho || eq.diametro || 1000) / 2) + margin;
                const dx = Math.abs(point.x - eq.posX), dz = Math.abs(point.z - eq.posZ);
                return (dx <= halfL && dz <= halfW);
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

    function isPointInCylinder(p, eq) { const dx = p.x - eq.posX, dz = p.z - eq.posZ; const radius = eq.diametro / 2; if (dx*dx + dz*dz > radius*radius) return false; const halfH = eq.altura / 2; return p.y >= eq.posY - halfH && p.y <= eq.posY + halfH; }
    function isPointInHorizontalCylinder(p, eq) { const dx = p.x - eq.posX; const halfL = eq.largo / 2; if (Math.abs(dx) > halfL) return false; const dy = p.y - eq.posY, dz = p.z - eq.posZ; const radius = eq.diametro / 2; return dy*dy + dz*dz <= radius*radius; }
    function isPointInBox(p, eq) { const halfL = (eq.largo || 1000) / 2, halfW = (eq.ancho || eq.diametro || 1000) / 2, halfH = (eq.altura || 1000) / 2; return Math.abs(p.x - eq.posX) <= halfL && Math.abs(p.y - eq.posY) <= halfH && Math.abs(p.z - eq.posZ) <= halfW; }

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

    function pointToSegmentDistance(p, a, b) { const ax = p.x - a.x, ay = p.y - a.y; const bx = b.x - a.x, by = b.y - a.y; const dot = ax * bx + ay * by; const len2 = bx * bx + by * by; if (len2 === 0) return Math.hypot(ax, ay); let t = Math.max(0, Math.min(1, dot / len2)); const projX = a.x + t * bx, projY = a.y + t * by; return Math.hypot(p.x - projX, p.y - projY); }

    function pickComponent(mouseX, mouseY) {
        if (!_core) return null;
        const db = _core.getDb();
        let closest = null, closestDist = 18;
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
        const db = _core.getDb();
        const equipos = db?.equipos || [];
        const lines = db?.lines || [];
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || _canvas.width < 600;
        const padding = options.padding !== undefined ? options.padding : (isMobile ? 20 : 80);
        const minScale = options.minScale !== undefined ? options.minScale : (isMobile ? 0.06 : 0.12);
        const maxScale = options.maxScale !== undefined ? options.maxScale : (isMobile ? 0.5 : 0.6);
        const preferHorizontal = options.preferHorizontal !== undefined ? options.preferHorizontal : true;

        let points = [];
        equipos.forEach(eq => {
            const r = (eq.diametro / 2) || 500;
            points.push({ x: eq.posX, y: eq.posY, z: eq.posZ });
            points.push({ x: eq.posX + r, y: eq.posY, z: eq.posZ });
            points.push({ x: eq.posX - r, y: eq.posY, z: eq.posZ });
            points.push({ x: eq.posX, y: eq.posY, z: eq.posZ + r });
            points.push({ x: eq.posX, y: eq.posY, z: eq.posZ - r });
            if (eq.tipo === 'tanque_h') {
                const hl = eq.largo / 2;
                points.push({ x: eq.posX + hl, y: eq.posY, z: eq.posZ });
                points.push({ x: eq.posX - hl, y: eq.posY, z: eq.posZ });
            }
        });

        let centroid = { x: 0, y: 0, z: 0 };
        if (equipos.length > 0) {
            equipos.forEach(eq => { centroid.x += eq.posX; centroid.y += eq.posY; centroid.z += eq.posZ; });
            centroid.x /= equipos.length; centroid.y /= equipos.length; centroid.z /= equipos.length;
        }

        lines.forEach(line => {
            const pts = _core.getLinePoints(line);
            if (!pts) return;
            pts.forEach(p => {
                if (equipos.length === 0) points.push(p);
                else {
                    const dist = Math.hypot(p.x - centroid.x, p.y - centroid.y, p.z - centroid.z);
                    if (dist < 15000) points.push(p);
                }
            });
        });

        if (points.length === 0) points = [{ x: -2000, y: 0, z: -2000 }, { x: 2000, y: 2000, z: 2000 }];

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(p => {
            const rx = (p.x - p.z) * COS30;
            const ry = (p.x + p.z) * SIN30 - p.y;
            if (rx < minX) minX = rx;
            if (rx > maxX) maxX = rx;
            if (ry < minY) minY = ry;
            if (ry > maxY) maxY = ry;
        });

        const margin = (maxX - minX) * 0.15;
        const marginY = (maxY - minY) * 0.15;
        minX -= margin; maxX += margin;
        minY -= marginY; maxY += marginY;

        const worldW = maxX - minX;
        const worldH = maxY - minY;

        let sc = Math.min((_canvas.width - padding * 2) / worldW, (_canvas.height - padding * 2) / worldH, maxScale);
        if (preferHorizontal && worldW > worldH) {
            sc = Math.min((_canvas.width - padding * 2) / worldW, maxScale);
        }
        sc = Math.max(minScale, sc);
        sc = isFinite(sc) ? sc : 0.3;

        _cam.scale = sc;
        _cam.panX = _canvas.width / 2 - ((minX + maxX) / 2) * sc;
        _cam.panY = _canvas.height / 2 - ((minY + maxY) / 2) * sc;

        if (_canvas.height > _canvas.width && isMobile) {
            _cam.panY -= _canvas.height * 0.08;
        }

        _cacheDirty = true;
        scheduleRender();
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
        _cam.scale = clampedScale;
        _cacheDirty = true;
        scheduleRender();
    }

    function render() {
        if (!_ctx || !_canvas) return;
        _renderScheduled = false;
        _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
        
        const bgGrad = _ctx.createRadialGradient(_canvas.width/2, _canvas.height/2, _canvas.width*0.1, _canvas.width/2, _canvas.height/2, _canvas.width*0.9);
        bgGrad.addColorStop(0, '#0f172a'); bgGrad.addColorStop(1, '#020617');
        _ctx.fillStyle = bgGrad; _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
        
        drawGrid(_currentElevation);
        drawOrigin();
        if (!_core) return;
        const db = _core.getDb(); if (!db) return;

        if (_cacheDirty) {
            _renderQueueCache = [];
            (db.equipos||[]).forEach(eq => _renderQueueCache.push({ type:'EQUIPMENT', depth: eq.posX+eq.posZ+(eq.posY*0.1), data: eq }));
            (db.lines||[]).forEach(line => {
                const pts = _core.getLinePoints(line);
                if (pts && pts.length >= 2) {
                    const avgDepth = pts.reduce((acc,p) => acc+(p.x+p.z), 0)/pts.length;
                    _renderQueueCache.push({ type:'LINE', depth: avgDepth, data: line });
                    _allLinePoints.push({ tag:line.tag, pts });
                }
            });
            _renderQueueCache.sort((a, b) => {
                const order = { 'PLATFORM': 0, 'EQUIPMENT': 1, 'LINE': 2 };
                const typeA = a.data?.tipo === 'plataforma' ? 'PLATFORM' : a.type;
                const typeB = b.data?.tipo === 'plataforma' ? 'PLATFORM' : b.type;
                const orderDiff = (order[typeA] || 1) - (order[typeB] || 1);
                if (orderDiff !== 0) return orderDiff;
                return a.depth - b.depth;
            });
            _cacheDirty = false;
        }

        AnnotationManager.reset();
        _bomItems = []; _allLinePoints = [];

        _renderQueueCache.forEach(item => {
            if (item.type==='EQUIPMENT') {
                const eq=item.data;
                switch(eq.tipo) {
                    case 'tanque_v':case 'torre':case 'reactor':drawTank(eq);break;
                    case 'bomba':drawBomba(eq);break;
                    case 'colector':drawColector(eq);break;
                    case 'tanque_h':drawCilindroHorizontal(eq,'#2563eb');break;
                    case 'plataforma':drawPlataforma(eq);break;
                    default:drawRectEquip(eq,'#475569');
                }
                if (eq.puertos) {
                    eq.puertos.forEach(p => {
                        const worldPos = { x: eq.posX + (p.relX||0), y: eq.posY + (p.relY||0), z: eq.posZ + (p.relZ||0) };
                        const proj = project(worldPos);
                        if (p.elevation !== undefined || p.status === 'open') {
                            drawNozzleTag(proj, p, eq);
                        }
                    });
                }
            } else if (item.data.isFitting) {
                drawFitting(item.data);
            } else {
                drawPipeWithElbows(item.data);
                drawPipeComponents(item.data);
            }
        });

        const selected = _core.getSelected();
        if (selected) {
            drawSelection(selected);
            drawPortMarkers(selected.obj);
        }
        
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

    function scheduleRender() {
        if (!_renderScheduled) {
            _renderScheduled = true;
            requestAnimationFrame(() => render());
        }
    }

    function drawFitting(fitting) {
        if (!fitting || !fitting.puertos) return;
        const center = project({ x: fitting.posX, y: fitting.posY, z: fitting.posZ });
        _ctx.save(); _ctx.beginPath(); _ctx.strokeStyle = '#f59e0b'; _ctx.lineWidth = 3*_cam.scale; _ctx.lineCap = 'round';
        fitting.puertos.forEach(p => {
            const pProj = project({ x: fitting.posX+(p.relX||0), y: fitting.posY+(p.relY||0), z: fitting.posZ+(p.relZ||0) });
            _ctx.moveTo(center.x, center.y); _ctx.lineTo(pProj.x, pProj.y); _ctx.strokeRect(pProj.x-2, pProj.y-2, 4, 4);
        });
        _ctx.stroke(); _ctx.fillStyle = '#f59e0b'; _ctx.font = `bold ${10*_cam.scale}px Arial`;
        _ctx.fillText(fitting.tipo || fitting.tag || '', center.x+10, center.y-10); _ctx.restore();
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

    function drawNozzleTag(proj2D, nozzle, parentEq) {
        if (!AnnotationManager.isVisible(2)) return;
        const diam = nozzle.diametro || parentEq.diametro || '?';
        const elevation = nozzle.elevation || (parentEq.posY + (nozzle.relY || 0));
        const label = `${nozzle.id} ${diam}" – EL ${elevation}`;
        const plane = (nozzle.orientacion && Math.abs(nozzle.orientacion.dx) > Math.abs(nozzle.orientacion.dz)) ? 'LEFT' : 'RIGHT';
        const prefX = proj2D.x + 35;
        const prefY = proj2D.y - 25;
        const box = AnnotationManager.register({ x: prefX, y: prefY - 10, w: 110, h: 22 }, 2);

        _ctx.save();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.strokeStyle = '#f59e0b';
        _ctx.lineWidth = 1;
        _ctx.beginPath();
        _ctx.moveTo(proj2D.x, proj2D.y);
        _ctx.lineTo(box.x, box.y + 11);
        _ctx.stroke();
        _ctx.restore();

        _ctx.save();
        if (plane === 'LEFT') _ctx.setTransform(1, 0.5, 0, 1, box.x, box.y + 11);
        else _ctx.setTransform(1, -0.5, 0, 1, box.x, box.y + 11);
        _ctx.font = 'bold 10px "Courier New", monospace';
        _ctx.fillStyle = '#ffffff';
        _ctx.textAlign = 'left';
        _ctx.textBaseline = 'middle';
        _ctx.fillText(label, 0, 0);
        _ctx.restore();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawTechnicalTooltip(ctx, comp, screenPos) {
        const catalogComp = typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog.getComponent(comp.type) : null;
        const desc = catalogComp?.nombre || comp.type || 'Componente';
        const material = catalogComp?.material || comp.material || 'N/D';
        const abbr = getComponentLabel(comp.type);
        const boxW = 210, boxH = 80;
        const x = Math.min(screenPos.x + 30, _canvas.width - boxW - 10);
        const y = Math.max(screenPos.y - 60, 10);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
        if (ctx.roundRect) {
            ctx.beginPath(); ctx.roundRect(x, y, boxW, boxH, 8); ctx.fill(); ctx.stroke();
        } else {
            ctx.fillRect(x, y, boxW, boxH); ctx.strokeRect(x, y, boxW, boxH);
        }
        ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 12px Inter'; ctx.fillText(`${abbr} — ${desc}`, x + 12, y + 22);
        ctx.fillStyle = '#e2e8f0'; ctx.font = '10px Inter'; ctx.fillText(`Material: ${material}`, x + 12, y + 42);
        ctx.fillText(`Tag: ${comp.tag || 'N/A'}`, x + 12, y + 58);
        ctx.fillStyle = '#94a3b8'; ctx.fillText(`SKU: ${catalogComp?.spec || comp.type || 'N/A'}`, x + 12, y + 74);
        ctx.restore();
    }

    function renderBOM() {
        if (_bomItems.length === 0) return;
        const x = 20, padding = 15, rowHeight = 18, headerHeight = 25, tableWidth = 260;
        const tableHeight = headerHeight + (_bomItems.length * rowHeight) + padding;
        const y = _canvas.height - tableHeight - 20;
        _ctx.save(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.fillStyle = "rgba(15, 23, 42, 0.92)"; _ctx.beginPath(); _ctx.roundRect(x, y, tableWidth, tableHeight, 8); _ctx.fill();
        _ctx.strokeStyle = "#0ea5e9"; _ctx.lineWidth = 1.5; _ctx.stroke();
        _ctx.fillStyle = "#0ea5e9"; _ctx.font = "bold 10px 'Segoe UI', sans-serif";
        _ctx.fillText("ITEM", x+12, y+17); _ctx.fillText("DESCRIPCIÓN", x+50, y+17); _ctx.fillText("MAT", x+220, y+17);
        _ctx.beginPath(); _ctx.moveTo(x+10, y+22); _ctx.lineTo(x+tableWidth-10, y+22); _ctx.strokeStyle = "rgba(14,165,233,0.3)"; _ctx.stroke();
        _bomItems.forEach((item, i) => {
            const rowY = y + headerHeight + (i*rowHeight) + 12;
            _ctx.fillStyle = "rgba(14,165,233,0.1)"; _ctx.beginPath(); _ctx.arc(x+20, rowY-3, 8, 0, Math.PI*2); _ctx.fill();
            _ctx.fillStyle = "#f8fafc"; _ctx.font = "9px 'Roboto Mono', monospace"; _ctx.textAlign = "center"; _ctx.fillText(item.index, x+20, rowY);
            _ctx.textAlign = "left"; _ctx.fillText(item.desc.replace(/_/g,' ').substring(0,28), x+50, rowY);
            _ctx.fillStyle = "#94a3b8"; _ctx.fillText(item.mat, x+220, rowY);
        });
        _ctx.restore();
    }

    // ═══════════════════════════════════════════════════════
    // EXPORTACIONES
    // ═══════════════════════════════════════════════════════

    function exportPDF() {
        if (!_canvas) return;
        if (typeof window.jspdf === 'undefined') { _notifyUI("Error: jsPDF no disponible.", true); return; }
        const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: 'landscape' });
        const imgData = _canvas.toDataURL('image/png'); doc.addImage(imgData, 'PNG', 10, 10, 277, 150);
        doc.setFontSize(16); doc.text("SmartEngp - Reporte Isométrico", 10, 175);
        doc.setFontSize(10); doc.text(`Proyecto: ${window.currentProjectName || 'N/D'} | Fecha: ${new Date().toLocaleString()}`, 10, 185);
        doc.save(`${window.currentProjectName || 'Proyecto'}_Isometrico_${Date.now()}.pdf`);
        _notifyUI("PDF generado correctamente.", false);
    }

    function exportPCF() {
        if (!_core) { _notifyUI("Error: Core no inicializado.", true); return; }
        const db = _core.getDb(); const lines = db?.lines || [];
        if (lines.length === 0) { _notifyUI("No hay líneas para exportar.", true); return; }
        let pcfContent = "";
        db.equipos?.forEach(eq => { if (!eq.puertos) return; eq.puertos.forEach(nz => { const pos = { x: eq.posX + (nz.relX || 0), y: eq.posY + (nz.relY || 0), z: eq.posZ + (nz.relZ || 0) }; const dir = nz.orientacion || { dx: 0, dy: 0, dz: 1 }; pcfContent += `NOZZLE\n    COMPONENT-IDENTIFIER ${eq.tag}-${nz.id}\n    END-POINT           ${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}  ${(nz.diametro*25.4).toFixed(2)}\n    DIRECTION           ${dir.dx.toFixed(3)} ${dir.dy.toFixed(3)} ${dir.dz.toFixed(3)}\n    SKEY                NOZZ\n    ITEM-DESCRIPTION    Boquilla ${nz.id} ${nz.diametro}"\n\n`; }); });
        lines.forEach(line => { const pts = _core.getLinePoints(line); if (!pts || pts.length < 2) return; const diamMM = (line.diameter || 4) * 25.4; pcfContent += generatePCFHeader(line) + "\n";
            for (let i = 0; i < pts.length - 1; i++) { const p1 = pts[i], p2 = pts[i+1]; if (!p1.isControlPoint && !p2.isControlPoint) { const dirVec = { dx: p2.x - p1.x, dy: p2.y - p1.y, dz: p2.z - p1.z }; const len = Math.hypot(dirVec.dx, dirVec.dy, dirVec.dz) || 1; const dir = { dx: dirVec.dx/len, dy: dirVec.dy/len, dz: dirVec.dz/len }; pcfContent += "PIPE\n    END-POINT           " + p1.x.toFixed(2) + " " + p1.y.toFixed(2) + " " + p1.z.toFixed(2) + "  " + diamMM.toFixed(2) + "\n    END-POINT           " + p2.x.toFixed(2) + " " + p2.y.toFixed(2) + " " + p2.z.toFixed(2) + "  " + diamMM.toFixed(2) + "\n    ENTRY               " + dir.dx.toFixed(3) + " " + dir.dy.toFixed(3) + " " + dir.dz.toFixed(3) + "\n    EXIT                " + dir.dx.toFixed(3) + " " + dir.dy.toFixed(3) + " " + dir.dz.toFixed(3) + "\n    ITEM-CODE           PIPE-" + (line.material || 'PPR') + "-" + line.diameter + "IN\n    SKEY                PIPE\n    FABRICATION-ITEM\n"; } }
            if (line.components && line.components.length > 0) { line.components.forEach(comp => { const pos = calculateComponentPosition(line, comp.param || 0.5); if (pos) pcfContent += formatComponentPCF(comp, pos, diamMM, pos.dir) + "\n"; }); }
            pcfContent += "\n";
        });
        const blob = new Blob([pcfContent], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        const projectName = window.currentProjectName || 'Proyecto'; const timestamp = new Date().toISOString().slice(0,19).replace(/:/g, '-');
        a.download = `${projectName}_PCF_${timestamp}.pcf`; a.click();
        _notifyUI("Archivo PCF exportado correctamente.", false);
    }

    const skeyMap = {
        'GATE_VALVE': 'VAGF', 'GLOBE_VALVE': 'VGLF', 'BUTTERFLY_VALVE': 'VBAF', 'BALL_VALVE': 'VBAL',
        'VALVE_BALL': 'VBAL', 'CHECK_VALVE': 'VCFF', 'DIAPHRAGM_VALVE': 'VDIA', 'CONTROL_VALVE': 'VCON',
        'PRESSURE_RELIEF': 'VPRV', 'SAFETY_VALVE': 'VSFT', 'WELD_NECK_FLANGE': 'FLWN', 'SLIP_ON_FLANGE': 'FLSO',
        'BLIND_FLANGE': 'FLBL', 'LAP_JOINT_FLANGE': 'FLLJ', 'ELBOW_90_LR': 'ELBW', 'ELBOW_90_SR': 'ELBS',
        'ELBOW_45': 'ELL4', 'CONCENTRIC_REDUCER': 'RECN', 'ECCENTRIC_REDUCER': 'REEC', 'TEE_EQUAL': 'TEE',
        'TEE_REDUCING': 'TEER', 'CROSS': 'CROS', 'CAP': 'CAPF', 'PIPE_SHOE': 'SHOE', 'U_BOLT': 'UBOL',
        'GUIDE': 'GUID', 'ANCHOR': 'ANCH', 'TRANSITION': 'TRAN', 'UNION': 'UNIO', 'BULKHEAD': 'BULK',
        'Y_STRAINER': 'STRY', 'PRESSURE_GAUGE': 'INPG', 'TEMPERATURE_GAUGE': 'INTG', 'FLOW_METER': 'INFM',
        'LEVEL_SWITCH_RANA': 'INSLS', 'PLUG_VALVE': 'VAPL', 'CHOKE_VALVE': 'VACH', 'CRYOGENIC_VALVE': 'VACR'
    };

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

    function generatePCFHeader(line) {
        const db = _core.getDb(); const projectName = window.currentProjectName || db?.projectName || 'ACQ-PROJECT';
        return [`ISOGEN-FILES PCF.STYLE`, `UNITS-BORMM             MM`, `UNITS-COOR              MM`, `UNITS-WEIGHT            KG`, `PIPELINE-REFERENCE      ${line.tag}`, `REVISION                ${line.revision || '0'}`, `PROJECT-IDENTIFIER      ${projectName}`, `ATTRIBUTE1              ${line.service || 'PROCESS'}`, `ATTRIBUTE2              ${line.spec || 'UNSPECIFIED'}`, `END-POSITION-CHECK      OFF`].join('\n');
    }

    function formatComponentPCF(comp, pos, diameterMM, dirVec) {
        const skey = skeyMap[comp.type] || 'MISC';
        let lines = [`${comp.type}`, `    END-POINT           ${pos.p1.x.toFixed(2)} ${pos.p1.y.toFixed(2)} ${pos.p1.z.toFixed(2)}  ${diameterMM.toFixed(2)}`, `    END-POINT           ${pos.p2.x.toFixed(2)} ${pos.p2.y.toFixed(2)} ${pos.p2.z.toFixed(2)}  ${diameterMM.toFixed(2)}`, `    SKEY                ${skey}`, `    ITEM-CODE           ${comp.itemCode || comp.type}`, `    ITEM-DESCRIPTION    ${comp.description || comp.nombre || comp.type}`];
        if (dirVec) { lines.push(`    ENTRY               ${dirVec.dx.toFixed(3)} ${dirVec.dy.toFixed(3)} ${dirVec.dz.toFixed(3)}`); lines.push(`    EXIT                ${dirVec.dx.toFixed(3)} ${dirVec.dy.toFixed(3)} ${dirVec.dz.toFixed(3)}`); }
        lines.push(`    FABRICATION-ITEM`); return lines.join('\n');
    }

    // ═══════════════════════════════════════════════════════
    // INICIALIZACIÓN Y API PÚBLICA
    // ═══════════════════════════════════════════════════════

    function init(canvasElement, coreInstance, notifyFn) {
        _canvas = canvasElement;
        _ctx = _canvas.getContext('2d');
        _core = coreInstance;
        _notifyUI = notifyFn || ((msg, isErr) => console.log(msg));
        _currentElevation = 0;
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', () => { setTimeout(resizeCanvas, 100); });
        if (_core && _core.on) {
            _core.on('modelChanged', () => {
                _cacheDirty = true;
                scheduleRender();
            });
        }
        _canvas.addEventListener('mousemove', (e) => {
            const rect = _canvas.getBoundingClientRect();
            const mX = e.clientX - rect.left, mY = e.clientY - rect.top;
            const snapped = pickPort(mX, mY);
            if (snapped) { _activeSnap = snapped; _canvas.style.cursor = 'crosshair'; _hoveredComponent = null; _hoveredComponentScreenPos = null; }
            else {
                _activeSnap = null;
                const hovered = pickComponent(mX, mY);
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
        _canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const rect = _canvas.getBoundingClientRect();
                const mX = e.touches[0].clientX - rect.left, mY = e.touches[0].clientY - rect.top;
                const touched = pickComponent(mX, mY);
                if (touched) { _hoveredComponent = { comp: touched }; _hoveredComponentScreenPos = touched._screenPos || {x:mX, y:mY}; scheduleRender(); }
            }
        });
        _canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = _canvas.getBoundingClientRect();
            const mX = e.clientX - rect.left;
            const mY = e.clientY - rect.top;
            zoom(e.deltaY < 0 ? 1 : -1, mX, mY);
        });
        let lastTouchDist = 0;
        _canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                if (lastTouchDist) {
                    const delta = dist - lastTouchDist;
                    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - _canvas.getBoundingClientRect().left;
                    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - _canvas.getBoundingClientRect().top;
                    zoom(delta > 0 ? 1 : -1, midX, midY);
                }
                lastTouchDist = dist;
            }
        });
        _canvas.addEventListener('touchend', () => { lastTouchDist = 0; });
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || _canvas.width < 600;
        autoCenter(isMobile ? { padding: 20, minScale: 0.06, maxScale: 0.5 } : {});
        scheduleRender();
    }

    function resizeCanvas() {
        if (!_canvas) return;
        const container = _canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        if (container) {
            _canvas.width = container.clientWidth * dpr;
            _canvas.height = container.clientHeight * dpr;
            _canvas.style.width = container.clientWidth + 'px';
            _canvas.style.height = container.clientHeight + 'px';
            _ctx.scale(dpr, dpr);
        }
        _cacheDirty = true;
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || _canvas.width < 600;
        autoCenter(isMobile ? { padding: 20, minScale: 0.06, maxScale: 0.5 } : {});
    }

    function setElevation(level) { _currentElevation = level; scheduleRender(); }

    window.SmartFlowRenderer = {
        init, render: scheduleRender, autoCenter, pan, zoom,
        project, inverseProject,
        setElevation, resizeCanvas,
        exportPDF, exportPCF,
        getCam: () => _cam,
        pickElement,
        getActiveSnap: () => _activeSnap,
        calculateComponentPosition
    };
    return window.SmartFlowRenderer;
})();
