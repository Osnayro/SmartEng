
// ============================================================
// SMARTFLOW LABELS 3D v3.5 - Etiquetado y Acotamiento Inteligente
// Archivo: js/smartlabel.js
// Novedades v3.5: DPR-aware + Anti-colisión + LOD + Tooltips hover
// ============================================================

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const SmartFlowLabels3D = (function() {
    let _core = null;
    let _engine = null;
    let _labelRenderer = null;
    let _camera = null;
    let _scene = null;
    
    const _labelGroup = new THREE.Group();
    const _dimensionGroup3D = new THREE.Group();
    
    const _equipmentLabels = new Map();
    const _lineLabels = new Map();
    const _componentLabels = new Map();
    const _dimensionLines = new Map();
    
    let _sharedDimLineMat = null;
    let _sharedDimExtMat = null;
    let _sharedDimTickMat = null;
    let _sharedAnchorMat = null;
    let _sharedAnchorGeo = null;
    
    let _raycaster = null;
    
    const EQUIPMENT_LABEL_OFFSET = 0.5;
    const LINE_LABEL_OFFSET = 0.15;
    const DIMENSION_OFFSET = 0.3;
    const MIN_SEGMENT_LENGTH = 0.1;
    
    // Sistema de Colisiones
    const COLLISION = {
        GRID_CELL_SIZE: 0.6,
        REPULSION_STRENGTH: 0.4,
        REPULSION_RADIUS: 1.2,
        GEOMETRY_MARGIN: 0.3,
        MAX_REPULSION_ITERATIONS: 5
    };
    
    let _spatialGrid = new Map();
    let _allLabelPositions = [];
    
    const LOD = {
        EQUIPMENT_NEAR: 8,
        EQUIPMENT_MEDIUM: 25,
        EQUIPMENT_FAR: 60,
        EQUIPMENT_HIDE: 100,
        LINE_NEAR: 6,
        LINE_MEDIUM: 20,
        LINE_FAR: 50,
        LINE_HIDE: 80,
        COMPONENT_NEAR: 4,
        COMPONENT_MEDIUM: 10,
        COMPONENT_HIDE: 20,
        DIMENSION_NEAR: 8,
        DIMENSION_MEDIUM: 20,
        DIMENSION_HIDE: 40,
        FADE_RANGE: 3
    };
    
    // DPR y responsive
    let _currentDPR = 1;
    let _baseFontSize = 10;
    let _resizeObserver = null;
    let _containerElement = null;
    
    // Tooltip
    let _tooltipDiv = null;
    let _tooltipTimeout = null;
    let _activeTooltipTag = null;
    
    let _visibleStats = { equipment: 0, lines: 0, components: 0, dimensions: 0 };
    
    const COLORS = {
        equipment: '#f59e0b',
        equipmentBg: 'rgba(15, 23, 42, 0.92)',
        equipmentBorder: '#f59e0b',
        line: '#00f2ff',
        lineBg: 'rgba(15, 23, 42, 0.88)',
        lineBorder: '#0ea5e9',
        component: '#a78bfa',
        componentBg: 'rgba(15, 23, 42, 0.85)',
        componentBorder: '#8b5cf6',
        dimension: '#facc15',
        dimensionBg: 'rgba(15, 23, 42, 0.85)',
        dimensionBorder: '#facc15',
        dimensionText: '#ffffff',
        tooltipBg: 'rgba(15, 23, 42, 0.96)',
        tooltipBorder: '#f59e0b',
        tooltipText: '#e2e8f0',
        tooltipTitle: '#f59e0b',
        tooltipLabel: '#94a3b8'
    };
    
    function toMeters(mmValue) {
        return (mmValue || 0) / 1000;
    }
    
    function diameterToRadiusMeters(diameterPulgadas) {
        return ((diameterPulgadas || 4) * 25.4) / 2000;
    }
    
    // ═══════════════════════════════════════════
    // DPR-AWARE SCALING
    // ═══════════════════════════════════════════
    
    function updateDPR() {
        _currentDPR = window.devicePixelRatio || 1;
        var dprFactor = Math.min(_currentDPR, 3);
        _baseFontSize = Math.round(10 / Math.sqrt(dprFactor));
        
        if (_labelRenderer) {
            _labelRenderer.setSize(window.innerWidth, window.innerHeight);
        }
        
        updateAllLabelFontSizes();
        
        COLLISION.GRID_CELL_SIZE = 0.6 / Math.sqrt(dprFactor);
        COLLISION.REPULSION_RADIUS = 1.2 / Math.sqrt(dprFactor);
    }
    
    function updateAllLabelFontSizes() {
        _equipmentLabels.forEach(function(item) {
            if (item.element) {
                item.element.style.fontSize = (_baseFontSize + 1) + 'px';
            }
        });
        
        _lineLabels.forEach(function(item) {
            if (item.element) {
                item.element.style.fontSize = (_baseFontSize - 1) + 'px';
            }
        });
        
        _componentLabels.forEach(function(item) {
            if (item.element) {
                item.element.style.fontSize = (_baseFontSize - 2) + 'px';
            }
        });
        
        _dimensionLines.forEach(function(item) {
            if (item.textLabel && item.textLabel.element) {
                var span = item.textLabel.element.querySelector('span');
                if (span) {
                    span.style.fontSize = (_baseFontSize - 2) + 'px';
                }
            }
        });
    }
    
    // ═══════════════════════════════════════════
    // SISTEMA DE COLISIONES - GRILLA ESPACIAL
    // ═══════════════════════════════════════════
    
    function getGridKey(x, y, z) {
        var gs = COLLISION.GRID_CELL_SIZE;
        return Math.round(x / gs) + ',' + Math.round(y / gs) + ',' + Math.round(z / gs);
    }
    
    function getGridNeighbors(x, y, z) {
        var keys = [];
        var gs = COLLISION.GRID_CELL_SIZE;
        var cx = Math.round(x / gs);
        var cy = Math.round(y / gs);
        var cz = Math.round(z / gs);
        
        for (var dx = -1; dx <= 1; dx++) {
            for (var dy = -1; dy <= 1; dy++) {
                for (var dz = -1; dz <= 1; dz++) {
                    keys.push((cx + dx) + ',' + (cy + dy) + ',' + (cz + dz));
                }
            }
        }
        return keys;
    }
    
    function isPositionOccupied(x, y, z, excludeTag) {
        var neighborKeys = getGridNeighbors(x, y, z);
        
        for (var i = 0; i < neighborKeys.length; i++) {
            var occupants = _spatialGrid.get(neighborKeys[i]);
            if (occupants) {
                for (var j = 0; j < occupants.length; j++) {
                    if (occupants[j].tag !== excludeTag) {
                        var dist = Math.hypot(
                            x - occupants[j].x,
                            y - occupants[j].y,
                            z - occupants[j].z
                        );
                        if (dist < COLLISION.REPULSION_RADIUS) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
    
    function registerPosition(tag, x, y, z, type) {
        var key = getGridKey(x, y, z);
        if (!_spatialGrid.has(key)) {
            _spatialGrid.set(key, []);
        }
        _spatialGrid.get(key).push({ tag: tag, x: x, y: y, z: z, type: type });
    }
    
    function clearSpatialGrid() {
        _spatialGrid.clear();
    }
    
    // ═══════════════════════════════════════════
    // REPULSIÓN ENTRE ETIQUETAS
    // ═══════════════════════════════════════════
    
    function applyRepulsion(positions) {
        var displacements = positions.map(function() {
            return { dx: 0, dy: 0, dz: 0 };
        });
        
        for (var i = 0; i < positions.length; i++) {
            for (var j = i + 1; j < positions.length; j++) {
                var dx = positions[i].x - positions[j].x;
                var dy = positions[i].y - positions[j].y;
                var dz = positions[i].z - positions[j].z;
                var dist = Math.hypot(dx, dy, dz);
                
                if (dist < COLLISION.REPULSION_RADIUS && dist > 0.001) {
                    var force = (COLLISION.REPULSION_RADIUS - dist) / COLLISION.REPULSION_RADIUS;
                    force = force * force * COLLISION.REPULSION_STRENGTH;
                    
                    var nx = dx / dist;
                    var ny = dy / dist;
                    var nz = dz / dist;
                    
                    displacements[i].dx += nx * force;
                    displacements[i].dy += ny * force;
                    displacements[i].dz += nz * force;
                    displacements[j].dx -= nx * force;
                    displacements[j].dy -= ny * force;
                    displacements[j].dz -= nz * force;
                }
            }
        }
        
        for (var k = 0; k < positions.length; k++) {
            var maxDisplacement = COLLISION.REPULSION_RADIUS * 0.5;
            var d = Math.hypot(displacements[k].dx, displacements[k].dy, displacements[k].dz);
            if (d > maxDisplacement) {
                var scale = maxDisplacement / d;
                displacements[k].dx *= scale;
                displacements[k].dy *= scale;
                displacements[k].dz *= scale;
            }
            
            positions[k].x += displacements[k].dx;
            positions[k].y += displacements[k].dy;
            positions[k].z += displacements[k].dz;
        }
        
        return positions;
    }
    
    // ═══════════════════════════════════════════
    // MARGEN DE SEGURIDAD SOBRE GEOMETRÍA
    // ═══════════════════════════════════════════
    
    function getGeometryBoundingBoxes() {
        var boxes = [];
        if (!_scene) return boxes;
        
        _scene.traverse(function(child) {
            if (child.isMesh && child.visible && child.geometry && !child.userData.isLabelAnchor) {
                if (child.userData && (child.userData.tag || child.userData.tipo)) {
                    var bbox = new THREE.Box3().setFromObject(child);
                    bbox.expandByScalar(COLLISION.GEOMETRY_MARGIN);
                    boxes.push(bbox);
                }
            }
        });
        
        return boxes;
    }
    
    function isInsideGeometry(x, y, z) {
        var point = new THREE.Vector3(x, y, z);
        var boxes = getGeometryBoundingBoxes();
        
        for (var i = 0; i < boxes.length; i++) {
            if (boxes[i].containsPoint(point)) {
                return true;
            }
        }
        return false;
    }
    
    function pushOutOfGeometry(position, anchorPoint) {
        var pos = new THREE.Vector3(position.x, position.y, position.z);
        var anchor = new THREE.Vector3(anchorPoint.x, anchorPoint.y, anchorPoint.z);
        
        var boxes = getGeometryBoundingBoxes();
        var maxIterations = 10;
        var iteration = 0;
        
        while (isInsideGeometry(pos.x, pos.y, pos.z) && iteration < maxIterations) {
            var dir = pos.clone().sub(anchor).normalize();
            if (dir.length() < 0.01) dir.set(0, 1, 0);
            pos.add(dir.multiplyScalar(COLLISION.GEOMETRY_MARGIN * 0.5));
            iteration++;
        }
        
        if (isInsideGeometry(pos.x, pos.y, pos.z)) {
            pos.y += COLLISION.GEOMETRY_MARGIN * 2;
        }
        
        return { x: pos.x, y: pos.y, z: pos.z };
    }
    
    // ═══════════════════════════════════════════
    // RESOLUCIÓN GLOBAL DE COLISIONES
    // ═══════════════════════════════════════════
    
    function resolveAllCollisions() {
        var allPositions = [];
        var labelRefs = [];
        
        _equipmentLabels.forEach(function(item, tag) {
            if (item.label && item.label.element && item.label.element.style.display !== 'none') {
                var worldPos = new THREE.Vector3();
                item.label.getWorldPosition(worldPos);
                allPositions.push({ x: worldPos.x, y: worldPos.y, z: worldPos.z, tag: tag, type: 'equipment' });
                labelRefs.push({ item: item, originalPos: worldPos.clone() });
            }
        });
        
        _lineLabels.forEach(function(item, tag) {
            if (item.label && item.label.element && item.label.element.style.display !== 'none') {
                var worldPos = new THREE.Vector3();
                item.label.getWorldPosition(worldPos);
                allPositions.push({ x: worldPos.x, y: worldPos.y, z: worldPos.z, tag: tag, type: 'line' });
                labelRefs.push({ item: item, originalPos: worldPos.clone() });
            }
        });
        
        _componentLabels.forEach(function(item, tag) {
            if (item.label && item.label.element && item.label.element.style.display !== 'none') {
                var worldPos = new THREE.Vector3();
                item.label.getWorldPosition(worldPos);
                allPositions.push({ x: worldPos.x, y: worldPos.y, z: worldPos.z, tag: tag, type: 'component' });
                labelRefs.push({ item: item, originalPos: worldPos.clone() });
            }
        });
        
        if (allPositions.length < 2) return;
        
        var positions = allPositions.map(function(p) {
            return { x: p.x, y: p.y, z: p.z, tag: p.tag, type: p.type };
        });
        
        for (var iter = 0; iter < COLLISION.MAX_REPULSION_ITERATIONS; iter++) {
            positions = applyRepulsion(positions);
        }
        
        for (var i = 0; i < labelRefs.length; i++) {
            var orig = labelRefs[i].originalPos;
            var disp = {
                x: positions[i].x - orig.x,
                y: positions[i].y - orig.y,
                z: positions[i].z - orig.z
            };
            var dist = Math.hypot(disp.x, disp.y, disp.z);
            var maxDist = COLLISION.REPULSION_RADIUS;
            
            if (dist > maxDist) {
                var scale = maxDist / dist;
                positions[i].x = orig.x + disp.x * scale;
                positions[i].y = orig.y + disp.y * scale;
                positions[i].z = orig.z + disp.z * scale;
            }
            
            positions[i] = pushOutOfGeometry(positions[i], orig);
            
            if (labelRefs[i].item.label) {
                labelRefs[i].item.label.position.set(
                    positions[i].x,
                    positions[i].y,
                    positions[i].z
                );
            }
        }
    }
    
    // ═══════════════════════════════════════════
    // TOOLTIP
    // ═══════════════════════════════════════════
    
    function createTooltipElement() {
        if (_tooltipDiv) return;
        
        _tooltipDiv = document.createElement('div');
        _tooltipDiv.id = 'smartflow-label-tooltip';
        _tooltipDiv.style.cssText = [
            'position: fixed;',
            'background: ' + COLORS.tooltipBg + ';',
            'border: 1px solid ' + COLORS.tooltipBorder + ';',
            'border-radius: 8px;',
            'padding: 10px 14px;',
            'font-family: "Courier New", monospace;',
            'font-size: 11px;',
            'color: ' + COLORS.tooltipText + ';',
            'pointer-events: none;',
            'z-index: 10000;',
            'opacity: 0;',
            'transition: opacity 0.2s ease;',
            'box-shadow: 0 4px 16px rgba(0,0,0,0.6);',
            'backdrop-filter: blur(8px);',
            'max-width: 280px;',
            'display: none;'
        ].join(' ');
        
        document.body.appendChild(_tooltipDiv);
    }
    
    function buildTooltipContent(equipo) {
        if (!equipo) return '';
        
        var tipo = equipo.tipo || 'Equipo';
        var tipoNombre = tipo;
        
        if (typeof SmartFlowCatalog !== 'undefined') {
            var catEquip = SmartFlowCatalog.getEquipment(tipo);
            if (catEquip && catEquip.nombre) tipoNombre = catEquip.nombre;
        }
        
        var lines = [];
        lines.push('<div style="font-weight:bold;font-size:13px;color:' + COLORS.tooltipTitle + ';margin-bottom:6px;">' + equipo.tag + '</div>');
        lines.push('<div style="margin-bottom:4px;"><span style="color:' + COLORS.tooltipLabel + ';">Tipo:</span> ' + tipoNombre + '</div>');
        
        if (equipo.material) {
            lines.push('<div style="margin-bottom:4px;"><span style="color:' + COLORS.tooltipLabel + ';">Material:</span> ' + equipo.material + '</div>');
        }
        if (equipo.spec) {
            lines.push('<div style="margin-bottom:4px;"><span style="color:' + COLORS.tooltipLabel + ';">Spec:</span> ' + equipo.spec + '</div>');
        }
        
        var dims = [];
        if (equipo.diametro) dims.push('⌀' + (equipo.diametro / 1000).toFixed(1) + 'm');
        if (equipo.altura) dims.push('H:' + (equipo.altura / 1000).toFixed(1) + 'm');
        if (equipo.largo) dims.push('L:' + (equipo.largo / 1000).toFixed(1) + 'm');
        if (equipo.ancho) dims.push('W:' + (equipo.ancho / 1000).toFixed(1) + 'm');
        if (dims.length > 0) {
            lines.push('<div style="margin-bottom:4px;"><span style="color:' + COLORS.tooltipLabel + ';">Dimensiones:</span> ' + dims.join(' × ') + '</div>');
        }
        
        var posX = (equipo.posX / 1000).toFixed(2);
        var posY = (equipo.posY / 1000).toFixed(2);
        var posZ = (equipo.posZ / 1000).toFixed(2);
        lines.push('<div style="margin-bottom:4px;"><span style="color:' + COLORS.tooltipLabel + ';">Posición (m):</span> ' + posX + ', ' + posY + ', ' + posZ + '</div>');
        
        if (equipo.puertos && equipo.puertos.length > 0) {
            lines.push('<div style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;">');
            lines.push('<span style="color:' + COLORS.tooltipLabel + ';">Puertos:</span>');
            lines.push('<div style="margin-top:2px;font-size:10px;">');
            equipo.puertos.forEach(function(p) {
                var statusIcon = p.status === 'connected' ? '🔗' : '🔓';
                var diam = p.diametro ? p.diametro + '"' : '?';
                var label = p.label || p.id || '?';
                lines.push('<div style="margin-left:6px;">' + statusIcon + ' <b>' + p.id + '</b>: ' + label + ' (⌀' + diam + ')</div>');
            });
            lines.push('</div></div>');
        }
        
        if (typeof _core !== 'undefined' && _core.getAbsolutePosition) {
            var absPos = _core.getAbsolutePosition(equipo);
            if (absPos) {
                lines.push('<div style="margin-top:4px;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px;font-size:10px;">');
                lines.push('<span style="color:' + COLORS.tooltipLabel + ';">Elevación:</span> ' + absPos.elevation.toFixed(2) + 'm');
                lines.push('</div>');
            }
        }
        
        return lines.join('');
    }
    
    function showTooltip(event, equipo) {
        if (!_tooltipDiv) createTooltipElement();
        if (!_tooltipDiv || !equipo) return;
        
        if (_tooltipTimeout) clearTimeout(_tooltipTimeout);
        
        _tooltipDiv.innerHTML = buildTooltipContent(equipo);
        _tooltipDiv.style.display = 'block';
        
        var offsetX = 15;
        var offsetY = 15;
        var left = event.clientX + offsetX;
        var top = event.clientY + offsetY;
        
        var tooltipWidth = _tooltipDiv.offsetWidth || 280;
        if (left + tooltipWidth > window.innerWidth - 10) {
            left = event.clientX - tooltipWidth - offsetX;
        }
        var tooltipHeight = _tooltipDiv.offsetHeight || 200;
        if (top + tooltipHeight > window.innerHeight - 10) {
            top = event.clientY - tooltipHeight - offsetY;
        }
        
        _tooltipDiv.style.left = left + 'px';
        _tooltipDiv.style.top = top + 'px';
        _tooltipDiv.style.opacity = '1';
        
        _activeTooltipTag = equipo.tag;
    }
    
    function hideTooltip() {
        if (!_tooltipDiv) return;
        
        _tooltipTimeout = setTimeout(function() {
            if (_tooltipDiv) {
                _tooltipDiv.style.opacity = '0';
                _tooltipDiv.style.display = 'none';
            }
            _activeTooltipTag = null;
        }, 150);
    }
    
    function moveTooltip(event) {
        if (!_tooltipDiv || !_activeTooltipTag) return;
        
        var offsetX = 15;
        var offsetY = 15;
        var left = event.clientX + offsetX;
        var top = event.clientY + offsetY;
        
        var tooltipWidth = _tooltipDiv.offsetWidth || 280;
        if (left + tooltipWidth > window.innerWidth - 10) {
            left = event.clientX - tooltipWidth - offsetX;
        }
        var tooltipHeight = _tooltipDiv.offsetHeight || 200;
        if (top + tooltipHeight > window.innerHeight - 10) {
            top = event.clientY - tooltipHeight - offsetY;
        }
        
        _tooltipDiv.style.left = left + 'px';
        _tooltipDiv.style.top = top + 'px';
    }
    
    // ═══════════════════════════════════════════
    // LOD SEMÁNTICO + ZOOM INTELIGENTE
    // ═══════════════════════════════════════════
    
    function smoothstep(edge0, edge1, x) {
        var t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    }
    
    function applyLODToElement(element, distance, nearDist, mediumDist, farDist, hideDist) {
        if (!element) return;
        
        var opacity, display;
        
        if (distance > hideDist) {
            opacity = 0;
            display = 'none';
        } else if (distance > farDist) {
            opacity = 1 - smoothstep(farDist - LOD.FADE_RANGE, farDist + LOD.FADE_RANGE, distance);
            display = opacity > 0.02 ? '' : 'none';
        } else if (distance > mediumDist) {
            opacity = 0.5 + 0.5 * (1 - smoothstep(mediumDist, farDist, distance));
            display = '';
        } else if (distance > nearDist) {
            opacity = 0.8 + 0.2 * (1 - smoothstep(nearDist, mediumDist, distance));
            display = '';
        } else {
            opacity = 1;
            display = '';
        }
        
        element.style.display = display;
        element.style.opacity = opacity.toFixed(2);
    }
    
    function updateAllLabelsLOD() {
        if (!_camera) return;
        
        _visibleStats = { equipment: 0, lines: 0, components: 0, dimensions: 0 };
        var camPos = _camera.position.clone();
        
        clearSpatialGrid();
        
        _equipmentLabels.forEach(function(item, tag) {
            if (!item.label || !item.label.element) return;
            
            var worldPos = new THREE.Vector3();
            item.label.getWorldPosition(worldPos);
            var distance = camPos.distanceTo(worldPos);
            
            var isOccluded = checkOcclusion(worldPos, camPos, tag);
            
            if (isOccluded) {
                item.label.element.style.display = 'none';
                return;
            }
            
            applyLODToElement(
                item.label.element, distance,
                LOD.EQUIPMENT_NEAR, LOD.EQUIPMENT_MEDIUM,
                LOD.EQUIPMENT_FAR, LOD.EQUIPMENT_HIDE
            );
            
            var scale = distance < LOD.EQUIPMENT_NEAR ? 1.0 :
                        distance < LOD.EQUIPMENT_MEDIUM ? 0.9 :
                        distance < LOD.EQUIPMENT_FAR ? 0.75 : 0.6;
            
            item.label.element.style.transform = 'scale(' + scale.toFixed(2) + ')';
            
            if (item.label.element.style.display !== 'none') {
                _visibleStats.equipment++;
                registerPosition(tag, worldPos.x, worldPos.y, worldPos.z, 'equipment');
            }
        });
        
        _lineLabels.forEach(function(item, tag) {
            if (!item.label || !item.label.element) return;
            
            var worldPos = new THREE.Vector3();
            item.label.getWorldPosition(worldPos);
            var distance = camPos.distanceTo(worldPos);
            
            var isOccluded = checkOcclusionSimple(worldPos, camPos);
            
            if (isOccluded && distance > LOD.LINE_NEAR) {
                item.label.element.style.display = 'none';
                return;
            }
            
            applyLODToElement(
                item.label.element, distance,
                LOD.LINE_NEAR, LOD.LINE_MEDIUM,
                LOD.LINE_FAR, LOD.LINE_HIDE
            );
            
            if (item.label.element.style.display !== 'none') {
                _visibleStats.lines++;
                registerPosition(tag, worldPos.x, worldPos.y, worldPos.z, 'line');
            }
        });
        
        _componentLabels.forEach(function(item, tag) {
            if (!item.label || !item.label.element) return;
            
            var worldPos = new THREE.Vector3();
            item.label.getWorldPosition(worldPos);
            var distance = camPos.distanceTo(worldPos);
            
            applyLODToElement(
                item.label.element, distance,
                LOD.COMPONENT_NEAR, LOD.COMPONENT_MEDIUM,
                LOD.COMPONENT_HIDE, LOD.COMPONENT_HIDE + 5
            );
            
            if (item.label.element.style.display !== 'none') {
                _visibleStats.components++;
                registerPosition(tag, worldPos.x, worldPos.y, worldPos.z, 'component');
            }
        });
        
        _dimensionLines.forEach(function(item) {
            if (!item.textLabel || !item.textLabel.element) return;
            
            var worldPos = new THREE.Vector3();
            item.textLabel.getWorldPosition(worldPos);
            var distance = camPos.distanceTo(worldPos);
            
            applyLODToElement(
                item.textLabel.element, distance,
                LOD.DIMENSION_NEAR, LOD.DIMENSION_MEDIUM,
                LOD.DIMENSION_HIDE, LOD.DIMENSION_HIDE + 10
            );
            
            if (item.textLabel.element.style.display !== 'none') {
                _visibleStats.dimensions++;
            }
        });
        
        resolveAllCollisions();
    }
    
    function checkOcclusion(worldPos, camPos, ownerTag) {
        if (!_raycaster || !_scene) return false;
        
        var dir = worldPos.clone().sub(camPos).normalize();
        _raycaster.set(camPos, dir);
        
        var allObjects = [];
        _scene.traverse(function(child) {
            if (child.isMesh && child.visible && child.geometry && !child.userData.isLabelAnchor) {
                allObjects.push(child);
            }
        });
        
        var intersects = _raycaster.intersectObjects(allObjects, false);
        
        if (intersects.length > 0) {
            var firstHit = intersects[0].object;
            var distToTarget = camPos.distanceTo(worldPos);
            var distToFirstHit = intersects[0].distance;
            
            var isOwnerMesh = false;
            var current = firstHit;
            while (current) {
                if (current.userData && current.userData.tag === ownerTag) {
                    isOwnerMesh = true;
                    break;
                }
                current = current.parent;
            }
            
            if (!isOwnerMesh && distToFirstHit < distToTarget - 0.05) {
                return true;
            }
        }
        return false;
    }
    
    function checkOcclusionSimple(worldPos, camPos) {
        if (!_raycaster || !_scene) return false;
        
        var dir = worldPos.clone().sub(camPos).normalize();
        _raycaster.set(camPos, dir);
        
        var allObjects = [];
        _scene.traverse(function(child) {
            if (child.isMesh && child.visible && child.geometry && !child.userData.isLabelAnchor) {
                allObjects.push(child);
            }
        });
        
        var intersects = _raycaster.intersectObjects(allObjects, false);
        
        if (intersects.length > 0) {
            var distToTarget = camPos.distanceTo(worldPos);
            if (intersects[0].distance < distToTarget - 0.05) {
                return true;
            }
        }
        return false;
    }
    
    // ═══════════════════════════════════════════
    // INICIALIZACIÓN
    // ═══════════════════════════════════════════
    
    function init(coreInstance, engineInstance) {
        _core = coreInstance;
        _engine = engineInstance;
        _camera = engineInstance ? engineInstance.getCamera() : null;
        _scene = engineInstance ? engineInstance.getScene() : null;
        
        if (!_scene || !_camera) {
            console.warn('SmartFlowLabels3D: Engine no disponible');
            return false;
        }
        
        updateDPR();
        
        _sharedDimLineMat = new THREE.LineBasicMaterial({ 
            color: 0xfacc15, linewidth: 1, transparent: true, opacity: 0.8, depthTest: true
        });
        _sharedDimExtMat = new THREE.LineBasicMaterial({ 
            color: 0xfacc15, linewidth: 1, transparent: true, opacity: 0.4, depthTest: true
        });
        _sharedDimTickMat = new THREE.LineBasicMaterial({ 
            color: 0xfacc15, linewidth: 1, transparent: true, opacity: 0.8, depthTest: true
        });
        _sharedAnchorMat = new THREE.MeshBasicMaterial({ visible: false });
        _sharedAnchorGeo = new THREE.SphereGeometry(0.02, 4, 4);
        
        try {
            _labelRenderer = new CSS2DRenderer();
            _labelRenderer.setSize(window.innerWidth, window.innerHeight);
            _labelRenderer.domElement.style.position = 'absolute';
            _labelRenderer.domElement.style.top = '0px';
            _labelRenderer.domElement.style.left = '0px';
            _labelRenderer.domElement.style.pointerEvents = 'none';
            _labelRenderer.domElement.style.zIndex = '10';
            
            var container = _engine.getRenderer() ? _engine.getRenderer().domElement.parentElement : null;
            if (container) {
                container.appendChild(_labelRenderer.domElement);
                _containerElement = container;
            }
        } catch (e) {
            console.warn('SmartFlowLabels3D: CSS2DRenderer no disponible', e);
            _labelRenderer = null;
        }
        
        _labelGroup.userData = { isLabelGroup: true };
        _dimensionGroup3D.userData = { isDimensionGroup3D: true };
        _scene.add(_labelGroup);
        _scene.add(_dimensionGroup3D);
        
        createTooltipElement();
        
        if (_core && typeof _core.on === 'function') {
            _core.on('modelChanged', function() {
                setTimeout(function() {
                    refreshAllLabels();
                    refreshAllDimensions();
                }, 400);
            });
        }
        
        window.addEventListener('resize', onResize);
        
        window.matchMedia('(resolution: ' + _currentDPR + 'dppx)').addEventListener('change', function(e) {
            if (e.matches === false) {
                updateDPR();
                refreshAllLabels();
                refreshAllDimensions();
            }
        });
        
        if (_containerElement && typeof ResizeObserver !== 'undefined') {
            _resizeObserver = new ResizeObserver(function() {
                onResize();
                updateDPR();
            });
            _resizeObserver.observe(_containerElement);
        }
        
        console.log('✔ SmartFlowLabels3D v3.5 (DPR-aware + anti-colisión + LOD + tooltips)');
        return true;
    }
    
    function onResize() {
        if (_labelRenderer) {
            _labelRenderer.setSize(window.innerWidth, window.innerHeight);
        }
        
        var newDPR = window.devicePixelRatio || 1;
        if (Math.abs(newDPR - _currentDPR) > 0.1) {
            updateDPR();
            refreshAllLabels();
            refreshAllDimensions();
        }
    }
    
    // ═══════════════════════════════════════════
    // CREACIÓN DE ETIQUETAS
    // ═══════════════════════════════════════════
    
    function createEquipmentLabel(eq) {
        if (!eq || !eq.tag) return null;
        
        var posX = toMeters(eq.posX);
        var posY = toMeters(eq.posY);
        var posZ = toMeters(eq.posZ);
        
        var altura = toMeters(eq.altura || eq.diametro || 2000);
        if (eq.tipo === 'tanque_h') altura = toMeters(eq.diametro || 3000);
        if (eq.tipo && eq.tipo.includes('bomba')) altura = toMeters(eq.diametro || 800);
        if (eq.tipo === 'plataforma') altura = toMeters(eq.altura || 400);
        
        var offsetY = (altura / 2) + EQUIPMENT_LABEL_OFFSET;
        
        var anchor = new THREE.Mesh(_sharedAnchorGeo, _sharedAnchorMat);
        anchor.position.set(posX, posY + offsetY, posZ);
        anchor.userData = { tag: eq.tag, isLabelAnchor: true };
        _labelGroup.add(anchor);
        
        var div = document.createElement('div');
        div.className = 'label-3d equipment-label';
        div.style.cssText = [
            'background: ' + COLORS.equipmentBg + ';',
            'border: 1px solid ' + COLORS.equipmentBorder + ';',
            'border-radius: 6px; padding: 5px 10px;',
            'font-family: "Courier New", monospace;',
            'font-size: ' + (_baseFontSize + 1) + 'px;',
            'color: ' + COLORS.equipment + '; text-align: center;',
            'white-space: nowrap; backdrop-filter: blur(4px);',
            'box-shadow: 0 2px 8px rgba(0,0,0,0.5);',
            'pointer-events: auto; cursor: pointer; user-select: none;',
            'transform-origin: center center;',
            'font-weight: bold;',
            'transition: opacity 0.3s ease;'
        ].join(' ');
        
        div.innerHTML = '🏭 ' + eq.tag;
        
        var label = new CSS2DObject(div);
        label.position.copy(anchor.position);
        label.userData = { tag: eq.tag, isEquipmentLabel: true };
        _labelGroup.add(label);
        
        div.addEventListener('mouseenter', function(e) {
            showTooltip(e, eq);
        });
        div.addEventListener('mouseleave', function() {
            hideTooltip();
        });
        div.addEventListener('mousemove', function(e) {
            moveTooltip(e);
        });
        
        var clickHandler = function(e) {
            e.stopPropagation();
            if (_core) _core.setSelected({ obj: eq, type: 'equipment' });
        };
        div.addEventListener('click', clickHandler);
        
        _equipmentLabels.set(eq.tag, { 
            anchor: anchor, label: label, element: div, 
            handler: clickHandler, equipo: eq
        });
        return { anchor: anchor, label: label };
    }
    
    function createLineLabel(line) {
        if (!line || !line.tag) return null;
        
        var pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
        if (pts.length < 2) return null;
        
        var totalLen = 0, lengths = [];
        for (var i = 0; i < pts.length - 1; i++) {
            var d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d); totalLen += d;
        }
        if (totalLen === 0) return null;
        
        var halfLen = totalLen / 2, accum = 0, segIdx = 0, t = 0;
        for (var j = 0; j < lengths.length; j++) {
            if (accum + lengths[j] >= halfLen || j === lengths.length - 1) {
                segIdx = j;
                t = lengths[j] > 0 ? (halfLen - accum) / lengths[j] : 0;
                t = Math.min(1, Math.max(0, t));
                break;
            }
            accum += lengths[j];
        }
        
        var p1 = pts[segIdx], p2 = pts[segIdx + 1];
        
        var isVertical = Math.abs(p2.x - p1.x) < 10 && Math.abs(p2.z - p1.z) < 10;
        
        var midX = toMeters(p1.x + (p2.x - p1.x) * t) + (isVertical ? 0.2 : 0);
        var midY = toMeters(p1.y + (p2.y - p1.y) * t) + (isVertical ? 0 : LINE_LABEL_OFFSET);
        var midZ = toMeters(p1.z + (p2.z - p1.z) * t) + (isVertical ? 0.2 : 0);
        
        var diam = line.diameter || '?';
        var service = line.service || '';
        var matShort = (line.material || 'N/D').substring(0, 4);
        
        var div = document.createElement('div');
        div.className = 'label-3d';
        div.style.cssText = [
            'background: ' + COLORS.lineBg + ';',
            'border: 1px solid ' + COLORS.lineBorder + ';',
            'border-radius: 4px; padding: 3px 7px;',
            'font-family: "Courier New", monospace;',
            'font-size: ' + (_baseFontSize - 1) + 'px;',
            'color: ' + COLORS.line + '; text-align: center;',
            'white-space: nowrap; backdrop-filter: blur(4px);',
            'box-shadow: 0 1px 6px rgba(0,0,0,0.4);',
            'pointer-events: auto; cursor: pointer; user-select: none;',
            'transform-origin: center center;',
            'transition: opacity 0.3s ease;'
        ].join(' ');
        
        div.textContent = diam + '" ' + matShort + (service ? ' ' + service : '');
        
        var label = new CSS2DObject(div);
        label.position.set(midX, midY, midZ);
        label.userData = { tag: line.tag, isLineLabel: true };
        _labelGroup.add(label);
        
        var clickHandler = function(e) {
            e.stopPropagation();
            if (_core) _core.setSelected({ obj: line, type: 'line' });
        };
        div.addEventListener('click', clickHandler);
        
        _lineLabels.set(line.tag, { label: label, element: div, handler: clickHandler });
        return { label: label };
    }
    
    function createComponentLabels(line) {
        if (!line.components || !line.components.length) return;
        
        var pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
        if (pts.length < 2) return;
        
        var lengths = [], totalLen = 0;
        for (var i = 0; i < pts.length - 1; i++) {
            var d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d); totalLen += d;
        }
        if (totalLen === 0) return;
        
        line.components.forEach(function(comp) {
            var param = comp.param || 0.5;
            var targetLen = totalLen * Math.min(1, Math.max(0, param));
            var accum = 0, segIdx = 0, t = 0;
            for (var j = 0; j < lengths.length; j++) {
                if (accum + lengths[j] >= targetLen || j === lengths.length - 1) {
                    segIdx = j; t = (targetLen - accum) / (lengths[j] || 1); break;
                }
                accum += lengths[j];
            }
            var pA = pts[segIdx], pB = pts[segIdx + 1];
            var cx = toMeters(pA.x + (pB.x - pA.x) * t);
            var cy = toMeters(pA.y + (pB.y - pA.y) * t) + LINE_LABEL_OFFSET;
            var cz = toMeters(pA.z + (pB.z - pA.z) * t);
            
            var abbr = getAbbreviation(comp.type);
            
            var div = document.createElement('div');
            div.className = 'label-3d';
            div.style.cssText = [
                'background: ' + COLORS.componentBg + ';',
                'border: 1px solid ' + COLORS.componentBorder + ';',
                'border-radius: 3px; padding: 2px 5px;',
                'font-family: "Courier New", monospace;',
                'font-size: ' + (_baseFontSize - 2) + 'px;',
                'color: ' + COLORS.component + '; text-align: center;',
                'white-space: nowrap; backdrop-filter: blur(4px);',
                'pointer-events: auto; cursor: pointer; user-select: none;',
                'transform-origin: center center;',
                'transition: opacity 0.3s ease;'
            ].join(' ');
            
            div.textContent = abbr;
            
            var label = new CSS2DObject(div);
            label.position.set(cx, cy, cz);
            label.userData = { tag: comp.tag, type: comp.type, isComponentLabel: true };
            _labelGroup.add(label);
            
            _componentLabels.set(comp.tag || (line.tag + '_' + comp.type), { label: label, element: div });
        });
    }
    
    function getAbbreviation(type) {
        var t = (type || '').toUpperCase();
        if (t.includes('GATE_VALVE') || t.includes('COMPUERTA')) return 'GV';
        if (t.includes('GLOBE_VALVE')) return 'GL';
        if (t.includes('BALL_VALVE') || t.includes('BOLA')) return 'BA';
        if (t.includes('BUTTERFLY_VALVE') || t.includes('MARIPOSA')) return 'VB';
        if (t.includes('CHECK_VALVE') || t.includes('RETENCION')) return 'CK';
        if (t.includes('DIAPHRAGM_VALVE')) return 'DV';
        if (t.includes('CONTROL_VALVE')) return 'CV';
        if (t.includes('RELIEF') || t.includes('SAFETY')) return 'RV';
        if (t.includes('ELBOW_90')) return 'E9';
        if (t.includes('ELBOW_45')) return 'E4';
        if (t.includes('TEE_EQUAL')) return 'TE';
        if (t.includes('TEE_REDUCING')) return 'TR';
        if (t.includes('REDUCER') || t.includes('REDUCTOR')) return 'RE';
        if (t.includes('FLANGE') || t.includes('BRIDA')) return 'FL';
        if (t.includes('BULKHEAD') || t.includes('PASAMUROS')) return 'BH';
        if (t.includes('CAP') || t.includes('TAPON')) return 'CA';
        if (t.includes('UNION')) return 'UN';
        if (t.includes('NIPPLE') || t.includes('NIPLE')) return 'NI';
        if (t.includes('STRAINER') || t.includes('FILTRO')) return 'ST';
        if (t.includes('STEAM_TRAP')) return 'TR';
        if (t.includes('EXPANSION')) return 'EJ';
        if (t.includes('GAUGE') || t.includes('MANOMETRO')) return 'PG';
        if (t.includes('FLOW_METER') || t.includes('CAUDAL')) return 'FM';
        if (t.includes('TRANSMITTER')) return 'XT';
        if (t.includes('LEVEL_SWITCH')) return 'LS';
        if (t.includes('PIPE_SHOE') || t.includes('ZAPATA')) return 'SH';
        if (t.includes('GUIDE') || t.includes('GUIA')) return 'GD';
        if (t.includes('ANCHOR') || t.includes('ANCLAJE')) return 'AN';
        if (t.includes('HANGER') || t.includes('COLGADOR')) return 'HG';
        return '??';
    }
    
    // ═══════════════════════════════════════════
    // DIMENSIONES
    // ═══════════════════════════════════════════
    
    function createDimensionLine3D(p1, p2, labelText) {
        var pos1 = new THREE.Vector3(toMeters(p1.x), toMeters(p1.y), toMeters(p1.z));
        var pos2 = new THREE.Vector3(toMeters(p2.x), toMeters(p2.y), toMeters(p2.z));
        
        var distance = pos1.distanceTo(pos2);
        if (distance < MIN_SEGMENT_LENGTH) return null;
        
        var key = Math.round(p1.x) + ',' + Math.round(p1.y) + ',' + Math.round(p1.z) + '-' +
                  Math.round(p2.x) + ',' + Math.round(p2.y) + ',' + Math.round(p2.z);
        if (_dimensionLines.has(key)) return null;
        
        var dir = new THREE.Vector3().subVectors(pos2, pos1).normalize();
        var perpendicular = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        if (perpendicular.length() < 0.1) {
            perpendicular = new THREE.Vector3(0, 1, 0);
        }
        perpendicular.multiplyScalar(DIMENSION_OFFSET);
        
        var cota1 = new THREE.Vector3().addVectors(pos1, perpendicular);
        var cota2 = new THREE.Vector3().addVectors(pos2, perpendicular);
        
        var extGeo1 = new THREE.BufferGeometry().setFromPoints([pos1, cota1]);
        var extGeo2 = new THREE.BufferGeometry().setFromPoints([pos2, cota2]);
        
        var lineGroup = new THREE.Group();
        lineGroup.add(new THREE.Line(extGeo1, _sharedDimExtMat));
        lineGroup.add(new THREE.Line(extGeo2, _sharedDimExtMat));
        lineGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([cota1, cota2]), 
            _sharedDimLineMat
        ));
        
        var tickDir = dir.clone().multiplyScalar(0.1);
        lineGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([cota1.clone().add(tickDir), cota1.clone().sub(tickDir)]),
            _sharedDimTickMat
        ));
        lineGroup.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([cota2.clone().add(tickDir), cota2.clone().sub(tickDir)]),
            _sharedDimTickMat
        ));
        
        _dimensionGroup3D.add(lineGroup);
        
        var dimText = labelText || formatDistance(distance);
        var textDiv = document.createElement('div');
        textDiv.className = 'label-3d';
        textDiv.innerHTML = '<span style="' + [
            'background: ' + COLORS.dimensionBg + ';',
            'color: ' + COLORS.dimensionText + ';',
            'padding: 2px 6px; border-radius: 3px;',
            'font-family: "Courier New", monospace;',
            'font-size: ' + (_baseFontSize - 2) + 'px;',
            'white-space: nowrap;',
            'border: 1px solid ' + COLORS.dimensionBorder + ';',
            'transition: opacity 0.3s ease;',
            'transform-origin: center center;'
        ].join(' ') + '">' + dimText + '</span>';
        
        var midPoint = new THREE.Vector3().addVectors(cota1, cota2).multiplyScalar(0.5);
        var textLabel = new CSS2DObject(textDiv);
        textLabel.position.copy(midPoint);
        textLabel.userData = { isDimensionText: true, key: key };
        _dimensionGroup3D.add(textLabel);
        
        _dimensionLines.set(key, { textLabel: textLabel, lineGroup: lineGroup });
        return { cota1: cota1, cota2: cota2, textLabel: textLabel };
    }
    
    function formatDistance(meters) {
        if (meters >= 1) return meters.toFixed(2) + ' m';
        return (meters * 1000).toFixed(0) + ' mm';
    }
    
    function createDimensionsForLine(line) {
        var pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
        if (pts.length < 2) return;
        
        for (var i = 0; i < pts.length - 1; i++) {
            if (pts[i].isControlPoint || pts[i+1].isControlPoint) continue;
            var dist = Math.hypot(
                pts[i+1].x - pts[i].x,
                pts[i+1].y - pts[i].y,
                pts[i+1].z - pts[i].z
            );
            if (dist >= 100) {
                createDimensionLine3D(pts[i], pts[i+1]);
            }
        }
    }
    
    function createDimensionsForEquipment(eq) {
        if (!eq.puertos || eq.puertos.length < 2) return;
        
        for (var i = 0; i < eq.puertos.length; i++) {
            for (var j = i + 1; j < eq.puertos.length; j++) {
                var pA = eq.puertos[i], pB = eq.puertos[j];
                var posA = {
                    x: (eq.posX || 0) + (pA.relX || 0),
                    y: (eq.posY || 0) + (pA.relY || 0),
                    z: (eq.posZ || 0) + (pA.relZ || 0)
                };
                var posB = {
                    x: (eq.posX || 0) + (pB.relX || 0),
                    y: (eq.posY || 0) + (pB.relY || 0),
                    z: (eq.posZ || 0) + (pB.relZ || 0)
                };
                createDimensionLine3D(posA, posB, pA.id + ' ↔ ' + pB.id);
            }
        }
    }
    
    // ═══════════════════════════════════════════
    // LIMPIEZA
    // ═══════════════════════════════════════════
    
    function clearAllLabels() {
        _equipmentLabels.forEach(function(item) {
            if (item.element && item.handler) {
                item.element.removeEventListener('click', item.handler);
            }
            if (item.label) {
                if (item.label.parent) item.label.parent.remove(item.label);
                if (item.label.element) item.label.element.remove();
            }
            if (item.anchor && item.anchor.parent) {
                item.anchor.parent.remove(item.anchor);
            }
        });
        _equipmentLabels.clear();
        
        _lineLabels.forEach(function(item) {
            if (item.element && item.handler) {
                item.element.removeEventListener('click', item.handler);
            }
            if (item.label) {
                if (item.label.parent) item.label.parent.remove(item.label);
                if (item.label.element) item.label.element.remove();
            }
        });
        _lineLabels.clear();
        
        _componentLabels.forEach(function(item) {
            if (item.label) {
                if (item.label.parent) item.label.parent.remove(item.label);
                if (item.label.element) item.label.element.remove();
            }
        });
        _componentLabels.clear();
        
        clearSpatialGrid();
    }
    
    function clearAllDimensions() {
        _dimensionLines.forEach(function(item) {
            if (item.textLabel) {
                if (item.textLabel.parent) item.textLabel.parent.remove(item.textLabel);
                if (item.textLabel.element) item.textLabel.element.remove();
            }
            if (item.lineGroup && item.lineGroup.parent) {
                item.lineGroup.parent.remove(item.lineGroup);
            }
        });
        _dimensionLines.clear();
        
        while (_dimensionGroup3D.children.length > 0) {
            var child = _dimensionGroup3D.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.element) child.element.remove();
            _dimensionGroup3D.remove(child);
        }
    }
    
    function refreshAllLabels() {
        if (!_core) return;
        clearAllLabels();
        
        var db = _core.getDb();
        if (!db) return;
        
        var equipos = db.equipos || [];
        for (var i = 0; i < equipos.length; i++) {
            if (equipos[i].tipo !== 'plataforma' && !(equipos[i].tag || '').startsWith('TEE-')) {
                createEquipmentLabel(equipos[i]);
            }
        }
        
        var lines = db.lines || [];
        for (var j = 0; j < lines.length; j++) {
            createLineLabel(lines[j]);
            createComponentLabels(lines[j]);
        }
    }
    
    function refreshAllDimensions() {
        if (!_core) return;
        clearAllDimensions();
        
        var db = _core.getDb();
        if (!db) return;
        
        var lines = db.lines || [];
        for (var i = 0; i < lines.length; i++) {
            createDimensionsForLine(lines[i]);
        }
        
        var equipos = db.equipos || [];
        for (var j = 0; j < equipos.length; j++) {
            createDimensionsForEquipment(equipos[j]);
        }
    }
    
    function render() {
        if (_labelRenderer && _scene && _camera) {
            updateAllLabelsLOD();
            _labelRenderer.render(_scene, _camera);
        }
    }
    
    function dispose() {
        clearAllLabels();
        clearAllDimensions();
        
        if (_sharedDimLineMat) _sharedDimLineMat.dispose();
        if (_sharedDimExtMat) _sharedDimExtMat.dispose();
        if (_sharedDimTickMat) _sharedDimTickMat.dispose();
        if (_sharedAnchorMat) _sharedAnchorMat.dispose();
        if (_sharedAnchorGeo) _sharedAnchorGeo.dispose();
        
        if (_labelRenderer && _labelRenderer.domElement) {
            _labelRenderer.domElement.remove();
        }
        
        if (_labelGroup.parent) _labelGroup.parent.remove(_labelGroup);
        if (_dimensionGroup3D.parent) _dimensionGroup3D.parent.remove(_dimensionGroup3D);
        
        window.removeEventListener('resize', onResize);
        
        if (_resizeObserver && _containerElement) {
            _resizeObserver.unobserve(_containerElement);
            _resizeObserver.disconnect();
            _resizeObserver = null;
        }
        
        if (_tooltipDiv) {
            _tooltipDiv.remove();
            _tooltipDiv = null;
        }
        
        _core = null;
        _engine = null;
        _labelRenderer = null;
        _camera = null;
        _scene = null;
        _raycaster = null;
        _containerElement = null;
    }
    
    function getVisibleStats() {
        return _visibleStats;
    }
    
    // ═══════════════════════════════════════════
    // API PÚBLICA
    // ═══════════════════════════════════════════
    
    return {
        init: init,
        refreshAllLabels: refreshAllLabels,
        refreshAllDimensions: refreshAllDimensions,
        clearAllLabels: clearAllLabels,
        clearAllDimensions: clearAllDimensions,
        render: render,
        getLabelRenderer: function() { return _labelRenderer; },
        dispose: dispose,
        getVisibleStats: getVisibleStats
    };
})();

window.SmartFlowLabels3D = SmartFlowLabels3D;
