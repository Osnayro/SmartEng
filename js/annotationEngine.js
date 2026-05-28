
// ============================================================
// SMARTFLOW ANNOTATION ENGINE v3.0 - Nivel 2
// Archivo: js/annotationEngine.js
// Etiquetado, Cotas y Dimensiones según normas ISA/ISO
// Capa 2D sobre el render 3D - No interfiere con geometría
// MEJORAS: Anticolapso avanzado, rendimiento, nuevas features
// ============================================================

const SmartFlowAnnotations = (function() {
    
    // ================================================================
    // 1. REFERENCIAS
    // ================================================================
    let _core = null;
    let _renderer3D = null;
    let _catalog = null;
    
    let _annotationCanvas = null;
    let _ctx = null;
    let _container = null;
    
    let _equipmentLabels = new Map();
    let _pipeLabels = new Map();
    let _dimensionLines = [];
    let _callouts = [];
    let _bomItems = [];
    
    let _config = {
        standard: 'ISA',  // 'ISA' o 'ISO'
        fontFamily: 'monospace',
        fontSizeTag: 11,
        fontSizeDimension: 9,
        fontSizeNote: 8,
        tagColor: '#00f2ff',
        dimensionColor: '#ffd700',
        leaderColor: '#94a3b8',
        backgroundColor: 'rgba(10, 10, 30, 0.85)',
        bomBorderColor: '#334155',
        billboardMode: true,
        minLabelDistance: 500,
        maxDimensionLines: 100,
        showBOM: false,
        bomPosition: 'bottom-right',
        dimensionUnit: 'mm',
        alternateUnit: 'in',
        dualDimension: true,
        angularTolerance: 2,
        snapToGrid: 100,
        showEquipmentTags: true,
        showPipeTags: true,
        showDimensions: true,
        showCallouts: true,
        showBOMTable: false,
        showFlowArrows: true,
        showElevationMarkers: true,
        showNorthArrow: true,
        showGrid: false,           // NUEVO: mostrar grid de referencia
        showCoordinates: false,    // NUEVO: mostrar coordenadas en cursor
        antiCollapseDistance: 25,  // NUEVO: distancia mínima entre etiquetas (px)
        maxLabelsPerFrame: 50      // NUEVO: límite de etiquetas por frame
    };
    
    let _isDirty = true;
    let _animationFrameId = null;
    let _lastCameraMatrix = null;
    let _lastCameraPosition = null;
    let _lastRenderTime = 0;
    let _renderThrottle = 33; // ms entre renders (aprox 30 fps para anotaciones)
    
    // Cache de proyecciones para optimización
    let _projectionCache = new Map();
    let _cacheTimestamp = 0;
    
    // ================================================================
    // 2. PROYECCIÓN 3D → 2D (Screen Space) con Caching
    // ================================================================
    
    function project3Dto2D(point3D, useCache = true) {
        if (!_renderer3D) return null;
        
        const camera = _renderer3D.getCamera();
        if (!camera) return null;
        
        // Cache key basada en posición y matriz de cámara
        if (useCache) {
            const cacheKey = `${point3D.x.toFixed(1)}_${point3D.y.toFixed(1)}_${point3D.z.toFixed(1)}_${_cacheTimestamp}`;
            if (_projectionCache.has(cacheKey)) {
                return _projectionCache.get(cacheKey);
            }
        }
        
        const vector = new THREE.Vector3(point3D.x, point3D.y, point3D.z);
        vector.project(camera);
        
        const canvas = _annotationCanvas;
        if (!canvas) return null;
        
        const result = {
            x: (vector.x * 0.5 + 0.5) * canvas.width,
            y: (-vector.y * 0.5 + 0.5) * canvas.height,
            z: vector.z,
            visible: vector.z < 1 && vector.z > -0.5
        };
        
        if (useCache) {
            const cacheKey = `${point3D.x.toFixed(1)}_${point3D.y.toFixed(1)}_${point3D.z.toFixed(1)}_${_cacheTimestamp}`;
            _projectionCache.set(cacheKey, result);
        }
        
        return result;
    }
    
    function invalidateCache() {
        _projectionCache.clear();
        _cacheTimestamp = Date.now();
    }
    
    function isBehindCamera(point3D) {
        const camera = _renderer3D ? _renderer3D.getCamera() : null;
        if (!camera) return true;
        
        const camPos = camera.position;
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        
        const toPoint = new THREE.Vector3(point3D.x, point3D.y, point3D.z).sub(camPos);
        return toPoint.dot(camDir) < 0;
    }
    
    // ================================================================
    // 3. GENERADORES DE ETIQUETAS (ISA/ISO)
    // ================================================================
    
    function generateEquipmentTag(eq) {
        switch (_config.standard) {
            case 'ISA':
                return {
                    mainTag: eq.tag,
                    serviceDescription: eq.servicio || eq.tipo || '',
                    format: 'ISA-5.1',
                    line1: eq.tag,
                    line2: eq.servicio || eq.tipo || '',
                    line3: eq.spec ? `Spec: ${eq.spec}` : '',
                    fontSize: _config.fontSizeTag,
                    priority: eq.tipo === 'tanque_v' ? 1 : eq.tipo === 'bomba' ? 2 : 3
                };
            case 'ISO':
                return {
                    mainTag: eq.tag,
                    unitNumber: eq.area || '',
                    equipmentCode: (eq.tipo || '').toUpperCase(),
                    format: 'ISO-10628',
                    line1: eq.tag,
                    line2: eq.tipo || '',
                    fontSize: _config.fontSizeTag,
                    priority: 2
                };
            default:
                return {
                    mainTag: eq.tag,
                    line1: eq.tag,
                    fontSize: _config.fontSizeTag,
                    priority: 3
                };
        }
    }
    
    function generateLineTag(line) {
        const materialCode = line.material === 'SS304' ? 'SS' : line.material === 'CS' ? 'CS' : (line.material || '');
        return {
            mainTag: line.tag,
            line1: line.tag,
            line2: `${line.diameter || '?'}" ${materialCode} ${line.spec || ''}`,
            line3: line.rating ? `CL ${line.rating}` : '',
            fontSize: _config.fontSizeTag - 1,
            priority: 2
        };
    }
    
    function generateDimensionText(value, unit) {
        unit = unit || _config.dimensionUnit;
        if (_config.dualDimension) {
            const altValue = unit === 'mm' ? value / 25.4 : value * 25.4;
            const altUnit = unit === 'mm' ? 'in' : 'mm';
            const mainValue = value >= 1000 ? (value / 1000).toFixed(2) : value.toFixed(0);
            const mainUnit = value >= 1000 ? 'm' : unit;
            const finalMainValue = value >= 1000 ? value / 1000 : value;
            return `${finalMainValue.toFixed(2)} ${mainUnit} [${altValue.toFixed(2)} ${altUnit}]`;
        }
        if (value >= 1000) {
            return (value / 1000).toFixed(2) + ' m';
        }
        return value.toFixed(0) + ' ' + unit;
    }
    
    // ================================================================
    // 4. DIBUJO DE ANOTACIONES (Canvas 2D Mejorado)
    // ================================================================
    
    function drawRoundedRect(x, y, width, height, radius, fillColor, strokeColor, lineWidth) {
        lineWidth = lineWidth || 1;
        _ctx.save();
        _ctx.beginPath();
        _ctx.moveTo(x + radius, y);
        _ctx.lineTo(x + width - radius, y);
        _ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        _ctx.lineTo(x + width, y + height - radius);
        _ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        _ctx.lineTo(x + radius, y + height);
        _ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        _ctx.lineTo(x, y + radius);
        _ctx.quadraticCurveTo(x, y, x + radius, y);
        _ctx.closePath();
        
        if (fillColor) {
            _ctx.fillStyle = fillColor;
            _ctx.fill();
        }
        if (strokeColor) {
            _ctx.strokeStyle = strokeColor;
            _ctx.lineWidth = lineWidth;
            _ctx.stroke();
        }
        _ctx.restore();
    }
    
    // NUEVO: Sombra para mejor legibilidad
    function drawShadow(x, y, width, height, blur = 4) {
        _ctx.shadowColor = 'rgba(0,0,0,0.5)';
        _ctx.shadowBlur = blur;
        _ctx.fillStyle = 'transparent';
        _ctx.fillRect(x, y, width, height);
        _ctx.shadowColor = 'transparent';
        _ctx.shadowBlur = 0;
    }
    
    function drawEquipmentLabel(screenPos, tagData, isSelected) {
        const padding = 6;
        const lineHeight = 14;
        const lines = [tagData.line1];
        if (tagData.line2) lines.push(tagData.line2);
        if (tagData.line3 && _config.standard === 'ISA') lines.push(tagData.line3);
        
        _ctx.font = `bold ${tagData.fontSize}px ${_config.fontFamily}`;
        let maxWidth = 0;
        lines.forEach(function(line) {
            const metrics = _ctx.measureText(line);
            if (metrics.width > maxWidth) maxWidth = metrics.width;
        });
        
        const boxWidth = maxWidth + padding * 2;
        const boxHeight = lines.length * lineHeight + padding * 2;
        
        let x = screenPos.x - boxWidth / 2;
        let y = screenPos.y - boxHeight - 15;
        
        const canvas = _annotationCanvas;
        x = Math.max(2, Math.min(x, canvas.width - boxWidth - 2));
        y = Math.max(2, Math.min(y, canvas.height - boxHeight - 2));
        
        // Sombra
        drawShadow(x - 2, y - 2, boxWidth + 4, boxHeight + 4);
        
        // Línea guía
        _ctx.strokeStyle = _config.leaderColor;
        _ctx.lineWidth = 1;
        _ctx.setLineDash([2, 2]);
        _ctx.beginPath();
        _ctx.moveTo(x + boxWidth / 2, y + boxHeight);
        _ctx.lineTo(screenPos.x, screenPos.y);
        _ctx.stroke();
        _ctx.setLineDash([]);
        
        // Punto de anclaje con efecto glow si está seleccionado
        _ctx.fillStyle = isSelected ? '#ffd700' : _config.tagColor;
        _ctx.shadowBlur = isSelected ? 8 : 0;
        _ctx.shadowColor = isSelected ? '#ffd700' : 'transparent';
        _ctx.beginPath();
        _ctx.arc(screenPos.x, screenPos.y, isSelected ? 5 : 3, 0, Math.PI * 2);
        _ctx.fill();
        _ctx.shadowBlur = 0;
        
        // Caja
        const bgColor = isSelected ? 'rgba(255, 215, 0, 0.25)' : _config.backgroundColor;
        const borderColor = isSelected ? '#ffd700' : _config.tagColor;
        drawRoundedRect(x, y, boxWidth, boxHeight, 4, bgColor, borderColor, isSelected ? 2 : 1);
        
        // Texto
        _ctx.fillStyle = isSelected ? '#ffffff' : _config.tagColor;
        _ctx.font = `bold ${tagData.fontSize}px ${_config.fontFamily}`;
        _ctx.textAlign = 'left';
        _ctx.textBaseline = 'top';
        
        lines.forEach(function(line, i) {
            _ctx.fillText(line, x + padding, y + padding + i * lineHeight);
        });
        
        return { x: x, y: y, width: boxWidth, height: boxHeight };
    }
    
    function drawPipeTag(screenPos, tagData) {
        const text = tagData.line1;
        _ctx.font = `${tagData.fontSize}px ${_config.fontFamily}`;
        const metrics = _ctx.measureText(text);
        const width = metrics.width + 10;
        const height = 16;
        
        let x = screenPos.x - width / 2;
        let y = screenPos.y - height - 8;
        
        const canvas = _annotationCanvas;
        x = Math.max(2, Math.min(x, canvas.width - width - 2));
        y = Math.max(2, Math.min(y, canvas.height - height - 2));
        
        drawShadow(x - 2, y - 2, width + 4, height + 4);
        
        drawRoundedRect(x, y, width, height, 3, _config.backgroundColor, _config.tagColor, 0.5);
        
        _ctx.fillStyle = _config.tagColor;
        _ctx.font = `${tagData.fontSize}px ${_config.fontFamily}`;
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText(text, x + width / 2, y + height / 2);
    }
    
    function drawDimensionLine(from2D, to2D, valueText, orientation) {
        const dx = to2D.x - from2D.x;
        const dy = to2D.y - from2D.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < 30) return;
        
        const offsetDist = 40;
        const perpX = -dy / dist * offsetDist;
        const perpY = dx / dist * offsetDist;
        
        const lineFromX = from2D.x + perpX;
        const lineFromY = from2D.y + perpY;
        const lineToX = to2D.x + perpX;
        const lineToY = to2D.y + perpY;
        
        // Líneas de extensión
        _ctx.strokeStyle = _config.dimensionColor;
        _ctx.lineWidth = 0.5;
        _ctx.setLineDash([2, 3]);
        
        _ctx.beginPath();
        _ctx.moveTo(from2D.x, from2D.y);
        _ctx.lineTo(lineFromX, lineFromY);
        _ctx.stroke();
        
        _ctx.beginPath();
        _ctx.moveTo(to2D.x, to2D.y);
        _ctx.lineTo(lineToX, lineToY);
        _ctx.stroke();
        
        _ctx.setLineDash([]);
        
        // Línea de cota
        _ctx.strokeStyle = _config.dimensionColor;
        _ctx.lineWidth = 1.2;
        _ctx.beginPath();
        _ctx.moveTo(lineFromX, lineFromY);
        _ctx.lineTo(lineToX, lineToY);
        _ctx.stroke();
        
        // Ticks
        drawTick(lineFromX, lineFromY, perpX, perpY, 8, _config.dimensionColor);
        drawTick(lineToX, lineToY, perpX, perpY, 8, _config.dimensionColor);
        
        // Texto con fondo
        const midX = (lineFromX + lineToX) / 2;
        const midY = (lineFromY + lineToY) / 2;
        
        _ctx.font = `${_config.fontSizeDimension}px ${_config.fontFamily}`;
        const textWidth = _ctx.measureText(valueText).width + 8;
        
        drawShadow(midX - textWidth/2 - 2, midY - 10, textWidth + 4, 20);
        
        _ctx.fillStyle = _config.backgroundColor;
        _ctx.fillRect(midX - textWidth/2, midY - 9, textWidth, 18);
        
        _ctx.fillStyle = _config.dimensionColor;
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText(valueText, midX, midY);
    }
    
    function drawTick(x, y, nx, ny, size, color) {
        _ctx.strokeStyle = color;
        _ctx.lineWidth = 1;
        _ctx.beginPath();
        _ctx.moveTo(x - nx * size * 0.5, y - ny * size * 0.5);
        _ctx.lineTo(x + nx * size * 0.5, y + ny * size * 0.5);
        _ctx.stroke();
    }
    
    function drawFlowArrow(from2D, to2D) {
        const midX = (from2D.x + to2D.x) / 2;
        const midY = (from2D.y + to2D.y) / 2;
        const dx = to2D.x - from2D.x;
        const dy = to2D.y - from2D.y;
        const len = Math.hypot(dx, dy) || 1;
        
        const arrowSize = 10;
        _ctx.fillStyle = '#00ff88';
        _ctx.strokeStyle = '#00ff88';
        _ctx.lineWidth = 1.5;
        
        _ctx.shadowBlur = 0;
        _ctx.beginPath();
        _ctx.moveTo(midX, midY);
        _ctx.lineTo(
            midX - dx/len * arrowSize - dy/len * arrowSize * 0.4,
            midY - dy/len * arrowSize + dx/len * arrowSize * 0.4
        );
        _ctx.lineTo(
            midX - dx/len * arrowSize + dy/len * arrowSize * 0.4,
            midY - dy/len * arrowSize - dx/len * arrowSize * 0.4
        );
        _ctx.closePath();
        _ctx.fill();
    }
    
    function drawNorthArrow() {
        if (!_config.showNorthArrow) return;
        
        const canvas = _annotationCanvas;
        const cx = 60;
        const cy = canvas.height - 60;
        const size = 30;
        
        drawShadow(cx - size - 5, cy - size - 5, size * 2 + 10, size * 2 + 10, 6);
        
        _ctx.strokeStyle = _config.dimensionColor;
        _ctx.lineWidth = 1.5;
        _ctx.beginPath();
        _ctx.arc(cx, cy, size, 0, Math.PI * 2);
        _ctx.stroke();
        
        _ctx.fillStyle = '#ff4444';
        _ctx.beginPath();
        _ctx.moveTo(cx, cy - size + 4);
        _ctx.lineTo(cx - 8, cy - 2);
        _ctx.lineTo(cx + 8, cy - 2);
        _ctx.closePath();
        _ctx.fill();
        
        _ctx.fillStyle = '#666666';
        _ctx.beginPath();
        _ctx.moveTo(cx, cy + size - 4);
        _ctx.lineTo(cx - 5, cy + 2);
        _ctx.lineTo(cx + 5, cy + 2);
        _ctx.closePath();
        _ctx.fill();
        
        _ctx.fillStyle = '#ffffff';
        _ctx.font = `bold 12px ${_config.fontFamily}`;
        _ctx.textAlign = 'center';
        _ctx.fillText('N', cx, cy - size - 8);
    }
    
    function drawElevationMarker(screenPos, elevation) {
        if (!_config.showElevationMarkers) return;
        
        const elText = `EL +${(elevation / 1000).toFixed(3)} m`;
        _ctx.font = `8px ${_config.fontFamily}`;
        const width = _ctx.measureText(elText).width + 10;
        
        drawShadow(screenPos.x - width/2 - 2, screenPos.y - 22, width + 4, 20);
        
        _ctx.fillStyle = 'rgba(10, 10, 35, 0.9)';
        _ctx.fillRect(screenPos.x - width/2, screenPos.y - 20, width, 16);
        
        _ctx.strokeStyle = '#22d3ee';
        _ctx.lineWidth = 0.5;
        _ctx.strokeRect(screenPos.x - width/2, screenPos.y - 20, width, 16);
        
        _ctx.fillStyle = '#22d3ee';
        _ctx.textAlign = 'center';
        _ctx.fillText(elText, screenPos.x, screenPos.y - 8);
        
        _ctx.strokeStyle = '#22d3ee';
        _ctx.beginPath();
        _ctx.arc(screenPos.x, screenPos.y, 6, 0, Math.PI * 2);
        _ctx.stroke();
        _ctx.beginPath();
        _ctx.moveTo(screenPos.x - 4, screenPos.y);
        _ctx.lineTo(screenPos.x + 4, screenPos.y);
        _ctx.moveTo(screenPos.x, screenPos.y - 4);
        _ctx.lineTo(screenPos.x, screenPos.y + 4);
        _ctx.stroke();
    }
    
    function drawReferenceGrid() {
        if (!_config.showGrid) return;
        
        const canvas = _annotationCanvas;
        const step = 50;
        
        _ctx.strokeStyle = 'rgba(100, 100, 150, 0.15)';
        _ctx.lineWidth = 0.5;
        
        for (let x = 0; x < canvas.width; x += step) {
            _ctx.beginPath();
            _ctx.moveTo(x, 0);
            _ctx.lineTo(x, canvas.height);
            _ctx.stroke();
        }
        
        for (let y = 0; y < canvas.height; y += step) {
            _ctx.beginPath();
            _ctx.moveTo(0, y);
            _ctx.lineTo(canvas.width, y);
            _ctx.stroke();
        }
    }
    
    // ================================================================
    // 5. RECOLECCIÓN DE DATOS (Optimizada)
    // ================================================================
    
    function collectAnnotations() {
        if (!_core) return;
        
        _equipmentLabels.clear();
        _pipeLabels.clear();
        _dimensionLines = [];
        _callouts = [];
        
        const db = _core.getDb();
        
        // Equipos
        (db.equipos || []).forEach(function(eq) {
            if (eq.tipo === 'plataforma') return; // No etiquetar plataformas
            
            const tagData = generateEquipmentTag(eq);
            const position3D = {
                x: eq.posX || 0,
                y: (eq.posY || 0) + ((eq.altura || 1500) / 2) + 300,
                z: eq.posZ || 0
            };
            _equipmentLabels.set(eq.tag, { position3D: position3D, tagData: tagData, equipment: eq });
        });
        
        // Tuberías
        (db.lines || []).forEach(function(line) {
            const pts = _core.getLinePoints(line) || line._cachedPoints || [];
            if (pts.length < 2) return;
            
            const midIdx = Math.floor(pts.length / 2);
            const midPoint = pts[midIdx];
            
            const tagData = generateLineTag(line);
            _pipeLabels.set(line.tag, {
                position3D: midPoint,
                tagData: tagData,
                line: line
            });
            
            // Cotas
            if (_config.showDimensions) {
                for (let i = 1; i < pts.length; i++) {
                    const dist = Math.hypot(
                        pts[i].x - pts[i-1].x,
                        pts[i].y - pts[i-1].y,
                        pts[i].z - pts[i-1].z
                    );
                    
                    if (dist > 200) {
                        _dimensionLines.push({
                            from: pts[i-1],
                            to: pts[i],
                            value: dist,
                            unit: _config.dimensionUnit,
                            text: generateDimensionText(dist, _config.dimensionUnit),
                            orientation: Math.abs(pts[i].y - pts[i-1].y) > Math.abs(pts[i].x - pts[i-1].x) ? 'vertical' : 'horizontal',
                            line: line
                        });
                    }
                }
            }
            
            // Puntos de elevación
            if (_config.showElevationMarkers) {
                for (let i = 1; i < pts.length; i++) {
                    if (Math.abs(pts[i].y - pts[i-1].y) > 500) {
                        _callouts.push({
                            position3D: pts[i],
                            text: 'EL +' + (pts[i].y/1000).toFixed(3) + 'm',
                            type: 'elevation'
                        });
                    }
                }
            }
        });
    }
    
    // ================================================================
    // 6. RENDER LOOP CON THROTTLE Y CACHING
    // ================================================================
    
    function shouldRender() {
        if (_isDirty) return true;
        
        const camera = _renderer3D ? _renderer3D.getCamera() : null;
        if (!camera) return false;
        
        const currentPos = camera.position.clone();
        if (_lastCameraPosition && !currentPos.equals(_lastCameraPosition)) {
            _lastCameraPosition = currentPos;
            return true;
        }
        
        const now = Date.now();
        if (now - _lastRenderTime < _renderThrottle) return false;
        
        return false;
    }
    
    function renderAnnotations() {
        if (!_ctx || !_annotationCanvas) return;
        
        const now = Date.now();
        if (!shouldRender() && !_isDirty) return;
        
        _lastRenderTime = now;
        invalidateCache();
        
        const canvas = _annotationCanvas;
        _ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Grid de referencia
        drawReferenceGrid();
        
        collectAnnotations();
        
        // Recolectar todas las etiquetas con prioridad
        const allLabels = [];
        
        if (_config.showEquipmentTags) {
            _equipmentLabels.forEach(function(data, tag) {
                const screenPos = project3Dto2D(data.position3D);
                if (screenPos && screenPos.visible && !isBehindCamera(data.position3D)) {
                    allLabels.push({ 
                        data: data, 
                        screenPos: screenPos, 
                        tag: tag, 
                        type: 'equipment',
                        priority: data.tagData.priority || 3
                    });
                }
            });
        }
        
        if (_config.showPipeTags) {
            _pipeLabels.forEach(function(data, tag) {
                const screenPos = project3Dto2D(data.position3D);
                if (screenPos && screenPos.visible && !isBehindCamera(data.position3D)) {
                    allLabels.push({ 
                        data: data, 
                        screenPos: screenPos, 
                        tag: tag, 
                        type: 'pipe',
                        priority: data.tagData.priority || 2
                    });
                }
            });
        }
        
        // Ordenar por prioridad y profundidad
        allLabels.sort(function(a, b) { 
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.screenPos.z - b.screenPos.z; 
        });
        
        // Anti-colapso avanzado
        const placedBoxes = [];
        const filteredLabels = [];
        const minDistance = _config.antiCollapseDistance;
        
        allLabels.forEach(function(label) {
            const boxWidth = label.type === 'equipment' ? 140 : 80;
            const boxHeight = label.type === 'equipment' ? 50 : 20;
            let collides = false;
            
            for (let i = 0; i < placedBoxes.length; i++) {
                const box = placedBoxes[i];
                const dx = Math.abs(label.screenPos.x - box.x);
                const dy = Math.abs(label.screenPos.y - box.y);
                if (dx < minDistance && dy < minDistance) {
                    collides = true;
                    break;
                }
            }
            
            if (!collides) {
                filteredLabels.push(label);
                placedBoxes.push({ x: label.screenPos.x, y: label.screenPos.y });
            }
        });
        
        // Limitar número de etiquetas por frame
        const labelsToDraw = filteredLabels.slice(0, _config.maxLabelsPerFrame);
        
        // Cotas
        if (_config.showDimensions) {
            const dimsToDraw = _dimensionLines.slice(0, _config.maxDimensionLines);
            dimsToDraw.forEach(function(dim) {
                const from2D = project3Dto2D(dim.from);
                const to2D = project3Dto2D(dim.to);
                if (from2D && to2D && from2D.visible && to2D.visible) {
                    drawDimensionLine(from2D, to2D, dim.text, dim.orientation);
                }
            });
        }
        
        // Flechas de flujo
        if (_config.showFlowArrows && _core) {
            const db = _core.getDb();
            (db.lines || []).forEach(function(line) {
                const pts = _core.getLinePoints(line) || [];
                for (let i = 0; i < pts.length - 1; i++) {
                    const from2D = project3Dto2D(pts[i]);
                    const to2D = project3Dto2D(pts[i + 1]);
                    if (from2D && to2D && from2D.visible && to2D.visible) {
                        drawFlowArrow(from2D, to2D);
                    }
                }
            });
        }
        
        // Marcadores de elevación
        if (_config.showElevationMarkers) {
            _callouts.forEach(function(callout) {
                const screenPos = project3Dto2D(callout.position3D);
                if (screenPos && screenPos.visible) {
                    drawElevationMarker(screenPos, callout.position3D.y);
                }
            });
        }
        
        // Etiquetas de equipos
        labelsToDraw.forEach(function(label) {
            if (label.type === 'equipment') {
                const selected = _renderer3D ? _renderer3D.getSelected() : null;
                const isSelected = selected && selected.obj && selected.obj.tag === label.tag;
                drawEquipmentLabel(label.screenPos, label.data.tagData, isSelected);
            }
        });
        
        // Etiquetas de tuberías
        labelsToDraw.forEach(function(label) {
            if (label.type === 'pipe') {
                drawPipeTag(label.screenPos, label.data.tagData);
            }
        });
        
        // Flecha Norte
        drawNorthArrow();
        
        _isDirty = false;
    }
    
    function startAnnotationLoop() {
        function loop() {
            renderAnnotations();
            _animationFrameId = requestAnimationFrame(loop);
        }
        loop();
    }
    
    function stopAnnotationLoop() {
        if (_animationFrameId) {
            cancelAnimationFrame(_animationFrameId);
            _animationFrameId = null;
        }
    }
    
    // ================================================================
    // 7. INICIALIZACIÓN
    // ================================================================
    
    function init(container, coreInstance, renderer3DInstance, catalogInstance, config) {
        _container = container;
        _core = coreInstance;
        _renderer3D = renderer3DInstance;
        _catalog = catalogInstance;
        
        if (config && typeof config === 'object') {
            for (const key in config) {
                if (config.hasOwnProperty(key) && _config.hasOwnProperty(key)) {
                    _config[key] = config[key];
                }
            }
        }
        
        // Eliminar canvas anterior si existe
        const existingCanvas = document.getElementById('annotation-layer');
        if (existingCanvas) existingCanvas.remove();
        
        _annotationCanvas = document.createElement('canvas');
        _annotationCanvas.id = 'annotation-layer';
        _annotationCanvas.style.cssText = [
            'position: absolute;',
            'top: 0;',
            'left: 0;',
            'pointer-events: none;',
            'z-index: 10;'
        ].join('');
        
        function resize() {
            if (_annotationCanvas && container) {
                _annotationCanvas.width = container.clientWidth;
                _annotationCanvas.height = container.clientHeight;
                _isDirty = true;
                invalidateCache();
            }
        }
        resize();
        window.addEventListener('resize', resize);
        
        // Observar cambios de tamaño del contenedor
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(function() {
                resize();
            });
            resizeObserver.observe(container);
        }
        
        container.appendChild(_annotationCanvas);
        _ctx = _annotationCanvas.getContext('2d');
        
        // Guardar posición inicial de cámara
        const camera = _renderer3D ? _renderer3D.getCamera() : null;
        if (camera) {
            _lastCameraPosition = camera.position.clone();
        }
        
        startAnnotationLoop();
        
        console.log('SmartFlowAnnotations v3.0 (Nivel 2) inicializado');
        return true;
    }
    
    function markDirty() {
        _isDirty = true;
    }
    
    function dispose() {
        stopAnnotationLoop();
        if (_annotationCanvas && _annotationCanvas.parentNode) {
            _annotationCanvas.parentNode.removeChild(_annotationCanvas);
        }
        _annotationCanvas = null;
        _ctx = null;
        _projectionCache.clear();
    }
    
    // ================================================================
    // 8. API PÚBLICA
    // ================================================================
    
    return {
        init: init,
        markDirty: markDirty,
        dispose: dispose,
        renderAnnotations: renderAnnotations,
        
        setConfig: function(key, value) { 
            if (_config[key] !== undefined) {
                _config[key] = value; 
                _isDirty = true; 
            }
        },
        getConfig: function() { return { ..._config }; },
        
        toggleLayer: function(layerName) {
            const key = 'show' + layerName.charAt(0).toUpperCase() + layerName.slice(1);
            if (_config[key] !== undefined) {
                _config[key] = !_config[key];
                _isDirty = true;
                return _config[key];
            }
            return false;
        },
        
        setStandard: function(standard) {
            if (standard === 'ISA' || standard === 'ISO') {
                _config.standard = standard;
                _isDirty = true;
            }
        },
        
        getCanvas: function() { return _annotationCanvas; },
        getContext: function() { return _ctx; },
        
        // NUEVO: Forzar actualización manual
        update: function() { 
            _isDirty = true; 
            renderAnnotations();
        }
    };
})();
