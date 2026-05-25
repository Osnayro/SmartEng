
// ============================================================
// SMARTFLOW ANNOTATION ENGINE v2.0
// Archivo: js/annotationEngine.js
// Etiquetado, Cotas y Dimensiones según normas ISA/ISO
// Capa 2D sobre el render 3D - No interfiere con geometría
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
    let _bomTable = null;
    
    let _config = {
        standard: 'ISA',
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
        showNorthArrow: true
    };
    
    let _isDirty = true;
    let _animationFrameId = null;
    let _lastCameraMatrix = null;
    
    // ================================================================
    // 2. PROYECCIÓN 3D → 2D (Screen Space)
    // ================================================================
    
    function project3Dto2D(point3D) {
        if (!_renderer3D) return null;
        
        const camera = _renderer3D.getCamera();
        if (!camera) return null;
        
        const vector = new THREE.Vector3(point3D.x, point3D.y, point3D.z);
        vector.project(camera);
        
        const canvas = _annotationCanvas;
        if (!canvas) return null;
        
        return {
            x: (vector.x * 0.5 + 0.5) * canvas.width,
            y: (-vector.y * 0.5 + 0.5) * canvas.height,
            z: vector.z,
            visible: vector.z < 1
        };
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
    // 3. GENERADORES DE ETIQUETAS
    // ================================================================
    
    function generateEquipmentTag(eq) {
        switch (_config.standard) {
            case 'ISA':
                return {
                    mainTag: eq.tag,
                    serviceDescription: eq.servicio || eq.tipo || '',
                    format: 'ISA-5.1',
                    line1: eq.tag,
                    line2: eq.servicio || '',
                    fontSize: _config.fontSizeTag
                };
            case 'ISO':
                return {
                    mainTag: eq.tag,
                    unitNumber: eq.area || '',
                    equipmentCode: (eq.tipo || '').toUpperCase(),
                    format: 'ISO-10628',
                    line1: eq.tag,
                    fontSize: _config.fontSizeTag
                };
            default:
                return {
                    mainTag: eq.tag,
                    line1: eq.tag,
                    fontSize: _config.fontSizeTag
                };
        }
    }
    
    function generateLineTag(line) {
        return {
            mainTag: line.tag,
            line1: line.tag,
            line2: (line.diameter || '?') + '" ' + (line.spec || '') + ' ' + (line.material || ''),
            fontSize: _config.fontSizeTag - 1
        };
    }
    
    function generateDimensionText(value, unit) {
        unit = unit || _config.dimensionUnit;
        if (_config.dualDimension) {
            const altValue = unit === 'mm' ? value / 25.4 : value * 25.4;
            const altUnit = unit === 'mm' ? 'in' : 'mm';
            return value.toFixed(0) + ' ' + unit + ' [' + altValue.toFixed(2) + ' ' + altUnit + ']';
        }
        return value.toFixed(0) + ' ' + unit;
    }
    
    // ================================================================
    // 4. DIBUJO DE ANOTACIONES (Canvas 2D)
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
    
    function drawEquipmentLabel(screenPos, tagData, isSelected) {
        const padding = 6;
        const lineHeight = 14;
        const lines = [tagData.line1];
        if (tagData.line2) lines.push(tagData.line2);
        
        _ctx.font = 'bold ' + tagData.fontSize + 'px ' + _config.fontFamily;
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
        
        // Línea guía
        _ctx.strokeStyle = _config.leaderColor;
        _ctx.lineWidth = 1;
        _ctx.setLineDash([2, 2]);
        _ctx.beginPath();
        _ctx.moveTo(x + boxWidth / 2, y + boxHeight);
        _ctx.lineTo(screenPos.x, screenPos.y);
        _ctx.stroke();
        _ctx.setLineDash([]);
        
        // Punto de anclaje
        _ctx.fillStyle = isSelected ? '#ffd700' : _config.tagColor;
        _ctx.beginPath();
        _ctx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
        _ctx.fill();
        
        // Caja
        const bgColor = isSelected ? 'rgba(255, 215, 0, 0.2)' : _config.backgroundColor;
        const borderColor = isSelected ? '#ffd700' : _config.tagColor;
        drawRoundedRect(x, y, boxWidth, boxHeight, 4, bgColor, borderColor, isSelected ? 2 : 1);
        
        // Texto
        _ctx.fillStyle = isSelected ? '#ffffff' : _config.tagColor;
        _ctx.font = 'bold ' + tagData.fontSize + 'px ' + _config.fontFamily;
        _ctx.textAlign = 'left';
        _ctx.textBaseline = 'top';
        
        lines.forEach(function(line, i) {
            _ctx.fillText(line, x + padding, y + padding + i * lineHeight);
        });
        
        return { x: x, y: y, width: boxWidth, height: boxHeight };
    }
    
    function drawPipeTag(screenPos, tagData) {
        const text = tagData.line1;
        _ctx.font = tagData.fontSize + 'px ' + _config.fontFamily;
        const metrics = _ctx.measureText(text);
        const width = metrics.width + 8;
        const height = 14;
        
        const x = screenPos.x - width / 2;
        const y = screenPos.y - height - 8;
        
        drawRoundedRect(x, y, width, height, 3, _config.backgroundColor, _config.tagColor, 0.5);
        
        _ctx.fillStyle = _config.tagColor;
        _ctx.font = tagData.fontSize + 'px ' + _config.fontFamily;
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText(text, screenPos.x, y + height / 2);
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
        _ctx.setLineDash([]);
        
        _ctx.beginPath();
        _ctx.moveTo(from2D.x, from2D.y);
        _ctx.lineTo(lineFromX, lineFromY);
        _ctx.stroke();
        
        _ctx.beginPath();
        _ctx.moveTo(to2D.x, to2D.y);
        _ctx.lineTo(lineToX, lineToY);
        _ctx.stroke();
        
        // Línea de cota
        _ctx.strokeStyle = _config.dimensionColor;
        _ctx.lineWidth = 1;
        _ctx.beginPath();
        _ctx.moveTo(lineFromX, lineFromY);
        _ctx.lineTo(lineToX, lineToY);
        _ctx.stroke();
        
        // Ticks
        drawTick(lineFromX, lineFromY, perpX, perpY, 8, _config.dimensionColor);
        drawTick(lineToX, lineToY, perpX, perpY, 8, _config.dimensionColor);
        
        // Texto
        const midX = (lineFromX + lineToX) / 2;
        const midY = (lineFromY + lineToY) / 2;
        
        _ctx.fillStyle = _config.backgroundColor;
        const textWidth = _ctx.measureText(valueText).width + 6;
        _ctx.fillRect(midX - textWidth/2, midY - 8, textWidth, 16);
        
        _ctx.fillStyle = _config.dimensionColor;
        _ctx.font = _config.fontSizeDimension + 'px ' + _config.fontFamily;
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
        
        _ctx.beginPath();
        _ctx.moveTo(midX, midY);
        _ctx.lineTo(
            midX - dx/len * arrowSize - dy/len * arrowSize * 0.5,
            midY - dy/len * arrowSize + dx/len * arrowSize * 0.5
        );
        _ctx.lineTo(
            midX - dx/len * arrowSize + dy/len * arrowSize * 0.5,
            midY - dy/len * arrowSize - dx/len * arrowSize * 0.5
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
        _ctx.font = 'bold 12px ' + _config.fontFamily;
        _ctx.textAlign = 'center';
        _ctx.fillText('N', cx, cy - size - 8);
    }
    
    function drawElevationMarker(screenPos, elevation) {
        if (!_config.showElevationMarkers) return;
        
        const elText = 'EL +' + (elevation / 1000).toFixed(3) + ' m';
        _ctx.font = '8px ' + _config.fontFamily;
        const width = _ctx.measureText(elText).width + 10;
        
        _ctx.fillStyle = 'rgba(10, 10, 35, 0.85)';
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
    
    // ================================================================
    // 5. RECOLECCIÓN DE DATOS
    // ================================================================
    
    function collectAnnotations() {
        if (!_core) return;
        
        _equipmentLabels.clear();
        _pipeLabels.clear();
        _dimensionLines = [];
        _callouts = [];
        
        const db = _core.getDb();
        
        (db.equipos || []).forEach(function(eq) {
            const tagData = generateEquipmentTag(eq);
            const position3D = {
                x: eq.posX || 0,
                y: (eq.posY || 0) + (eq.altura || 1500) / 2 + 300,
                z: eq.posZ || 0
            };
            _equipmentLabels.set(eq.tag, { position3D: position3D, tagData: tagData, equipment: eq });
        });
        
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
            
            if (_config.showDimensions) {
                for (let i = 1; i < pts.length; i++) {
                    const dist = Math.hypot(
                        pts[i].x - pts[i-1].x,
                        pts[i].y - pts[i-1].y,
                        pts[i].z - pts[i-1].z
                    );
                    
                    if (dist > 100) {
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
    // 6. RENDER LOOP DE ANOTACIONES
    // ================================================================
    
    function renderAnnotations() {
        if (!_ctx || !_annotationCanvas) return;
        
        const canvas = _annotationCanvas;
        _ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const camera = _renderer3D ? _renderer3D.getCamera() : null;
        if (camera) {
            const currentMatrix = camera.matrixWorldInverse.clone();
            if (_lastCameraMatrix && currentMatrix.equals(_lastCameraMatrix) && !_isDirty) {
                return;
            }
            _lastCameraMatrix = currentMatrix;
        }
        _isDirty = false;
        
        collectAnnotations();
        
        const allLabels = [];
        
        if (_config.showEquipmentTags) {
            _equipmentLabels.forEach(function(data, tag) {
                const screenPos = project3Dto2D(data.position3D);
                if (screenPos && screenPos.visible && !isBehindCamera(data.position3D)) {
                    allLabels.push({ data: data, screenPos: screenPos, tag: tag, type: 'equipment' });
                }
            });
        }
        
        if (_config.showPipeTags) {
            _pipeLabels.forEach(function(data, tag) {
                const screenPos = project3Dto2D(data.position3D);
                if (screenPos && screenPos.visible && !isBehindCamera(data.position3D)) {
                    allLabels.push({ data: data, screenPos: screenPos, tag: tag, type: 'pipe' });
                }
            });
        }
        
        allLabels.sort(function(a, b) { return a.screenPos.z - b.screenPos.z; });
        
        const placedBoxes = [];
        const filteredLabels = [];
        
        allLabels.forEach(function(label) {
            const boxW = 120, boxH = 30;
            let overlaps = false;
            
            for (let i = 0; i < placedBoxes.length; i++) {
                const box = placedBoxes[i];
                if (Math.abs(label.screenPos.x - box.x) < boxW &&
                    Math.abs(label.screenPos.y - box.y) < boxH) {
                    overlaps = true;
                    break;
                }
            }
            
            if (!overlaps) {
                filteredLabels.push(label);
                placedBoxes.push({ x: label.screenPos.x, y: label.screenPos.y });
            }
        });
        
        // Dibujar cotas
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
        filteredLabels.forEach(function(label) {
            if (label.type === 'equipment') {
                const selected = _renderer3D ? _renderer3D.getSelected() : null;
                const isSelected = selected && selected.obj && selected.obj.tag === label.tag;
                drawEquipmentLabel(label.screenPos, label.data.tagData, isSelected);
            }
        });
        
        // Etiquetas de tuberías
        filteredLabels.forEach(function(label) {
            if (label.type === 'pipe') {
                drawPipeTag(label.screenPos, label.data.tagData);
            }
        });
        
        // Flecha Norte
        drawNorthArrow();
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
            }
        }
        resize();
        window.addEventListener('resize', resize);
        
        container.appendChild(_annotationCanvas);
        _ctx = _annotationCanvas.getContext('2d');
        
        startAnnotationLoop();
        
        console.log('SmartFlowAnnotations v2.0 inicializado - Capa 2D activa');
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
            _config[key] = value; 
            _isDirty = true; 
        },
        getConfig: function() { return _config; },
        
        toggleLayer: function(layerName) {
            const key = 'show' + layerName.charAt(0).toUpperCase() + layerName.slice(1);
            if (_config[key] !== undefined) {
                _config[key] = !_config[key];
                _isDirty = true;
            }
        },
        
        setStandard: function(standard) {
            _config.standard = standard;
            _isDirty = true;
        },
        
        getCanvas: function() { return _annotationCanvas; },
        getContext: function() { return _ctx; }
    };
})();
