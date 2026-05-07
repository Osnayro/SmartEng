
// ============================================================
// SMARTFLOW LABELS v2.0 - Etiquetas optimizadas (Modo Industria 4.0)
// Archivo: js/labels.js
// ============================================================

const SmartFlowLabels = (function() {
    let _core = null;
    let _labelRenderer = null;
    let _labelObjects = [];
    let _scene = null;
    let _camera = null;
    let _showDetails = false; // Toggle para expandir/colapsar
    let _visibilityDistance = 15000; // Distancia máxima para mostrar etiquetas

    // Colores por tipo de equipo (esquema industrial)
    const COLOR_MAP = {
        'tanque_v': '#3b82f6',
        'tanque_h': '#3b82f6',
        'bomba': '#f59e0b',
        'bomba_dosificacion': '#f59e0b',
        'bomba_sumergible': '#f59e0b',
        'torre': '#ef4444',
        'reactor': '#8b5cf6',
        'intercambiador': '#10b981',
        'caldera': '#ef4444',
        'compresor': '#f59e0b',
        'separador': '#8b5cf6',
        'clarificador': '#06b6d4',
        'filtro_arena': '#06b6d4',
        'osmosis': '#06b6d4',
        'pasteurizador': '#10b981',
        'homogeneizador': '#8b5cf6',
        'tanque_acero': '#94a3b8',
        'colector': '#facc15'
    };

    // Símbolos por tipo (corto)
    const TYPE_SYMBOL = {
        'tanque_v': '⬡',
        'tanque_h': '⬡',
        'bomba': '⚙',
        'torre': '⬒',
        'reactor': '⬒',
        'intercambiador': '⫼',
        'compresor': '⚙',
        'colector': '☰'
    };

    function init(core, labelRenderer, scene) {
        _core = core;
        _labelRenderer = labelRenderer || null;
        _scene = scene || (core && core.getScene ? core.getScene() : null);
        _camera = core && core.getCamera ? core.getCamera() : null;
        
        // Cargar preferencia guardada
        _showDetails = localStorage.getItem('smartflow_labels_detailed') === 'true';
        
        // Atajo de teclado: Ctrl+L para toggle
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'l') {
                e.preventDefault();
                toggleLabelDetail();
            }
        });
        
        console.log('✅ Labels v2.0 inicializado - Industria 4.0 mode');
    }

    function toggleLabelDetail() {
        _showDetails = !_showDetails;
        localStorage.setItem('smartflow_labels_detailed', _showDetails);
        crearLabelsProyecto();
        console.log(`Labels: ${_showDetails ? 'DETALLADO' : 'COMPACTO'}`);
    }

    function getShortLabel(obj) {
        // Solo el TAG principal, sin prefijos largos
        return obj.tag || '?';
    }

    function getDetailedLabel(obj) {
        let label = obj.tag || '?';
        const diam = obj.diametro || obj.diameter || '';
        const mat = obj.material || '';
        
        if (diam) label += ` ⌀${diam}"`;
        if (mat) label += ` ${mat.substring(0,4)}`;
        
        return label;
    }

    function crearLabel(texto, posicion, colorHex = '#ffffff', fontSize = '14px', offsetY = 200) {
        if (!_labelRenderer || !_scene) {
            console.warn('⚠️ LabelRenderer o Scene no disponibles');
            return null;
        }

        // Limitar texto a 20 caracteres
        const displayText = texto.length > 20 ? texto.substring(0, 18) + '..' : texto;

        const div = document.createElement('div');
        div.textContent = displayText;
        div.style.cssText = `
            color: ${colorHex};
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: ${fontSize};
            font-weight: 700;
            text-shadow: 0 0 6px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.8);
            background: rgba(10, 14, 23, 0.75);
            padding: 3px 8px;
            border-radius: 3px;
            border: 1px solid ${colorHex}44;
            pointer-events: none;
            white-space: nowrap;
            user-select: none;
            letter-spacing: 0.5px;
        `;

        const label = new THREE.CSS2DObject(div);
        label.position.copy(posicion);
        label.position.y += offsetY;
        label.userData = { texto, colorHex, fontSize, offsetY, type: 'label', fullText: texto };
        
        _scene.add(label);
        _labelObjects.push(label);
        
        return label;
    }

    function crearLabelEquipo(equipo) {
        if (!equipo) return null;
        
        const pos = {
            x: equipo.posX || (equipo.pos?.x || 0),
            y: equipo.posY || (equipo.pos?.y || 0),
            z: equipo.posZ || (equipo.pos?.z || 0)
        };

        const altura = equipo.altura || 1500;
        const offsetY = altura / 2 + 250;
        
        const color = COLOR_MAP[equipo.tipo] || '#00f2ff';
        const texto = _showDetails ? getDetailedLabel(equipo) : getShortLabel(equipo);
        
        return crearLabel(texto, pos, color, _showDetails ? '13px' : '14px', offsetY);
    }

    function crearLabelLinea(linea) {
        if (!linea) return null;
        
        const pts = linea.points || linea._cachedPoints || linea.points3D || [];
        if (pts.length < 2) return null;
        
        // Punto medio
        const midIdx = Math.floor(pts.length / 2);
        const pos = { x: pts[midIdx].x, y: pts[midIdx].y + 200, z: pts[midIdx].z };
        
        const texto = _showDetails 
            ? `${linea.tag} ${linea.diameter}"` 
            : linea.tag;
        
        return crearLabel(texto, pos, '#f59e0b', '11px', 0);
    }

    function crearLabelsProyecto() {
        if (!_core || !_scene) return;
        
        limpiarLabels();
        
        const db = _core.getDb();
        
        (db.equipos || []).forEach(eq => {
            crearLabelEquipo(eq);
        });
        
        (db.lines || []).forEach(line => {
            crearLabelLinea(line);
        });
        
        console.log(`✅ ${_labelObjects.length} labels creadas (${_showDetails ? 'detallado' : 'compacto'})`);
    }

    function actualizarVisibilidad() {
        if (!_camera) return;
        
        _labelObjects.forEach(label => {
            const distance = _camera.position.distanceTo(label.position);
            label.visible = distance < _visibilityDistance;
        });
    }

    function limpiarLabels() {
        if (!_scene) return;
        _labelObjects.forEach(label => {
            _scene.remove(label);
            if (label.element) label.element.remove();
        });
        _labelObjects = [];
    }

    function setVisibilityDistance(dist) {
        _visibilityDistance = dist;
    }

    function getLabels() {
        return _labelObjects;
    }

    function isDetailedMode() {
        return _showDetails;
    }

    return {
        init,
        crearLabel,
        crearLabelEquipo,
        crearLabelLinea,
        crearLabelsProyecto,
        limpiarLabels,
        getLabels,
        toggleLabelDetail,
        actualizarVisibilidad,
        setVisibilityDistance,
        isDetailedMode
    };
})();
