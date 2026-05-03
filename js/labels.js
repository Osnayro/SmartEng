
// SmartFlowLabels v1.7 – Etiquetas completas con protección
const SmartFlowLabels = (function() {
    let _core = null;
    let _scene = null;
    let _labelRenderer = null;
    let _itemsMap = new Map();

    const _config = {
        lineColor: 0x00f2ff,
        dashSize: 6,
        gapSize: 4,
        offset: new THREE.Vector3(250, 200, 250),
        fontSize: '12px',
        fontFamily: 'monospace',
        textColor: '#00f2ff',
        bgColor: 'rgba(15, 23, 42, 0.85)',
        borderColor: '#00f2ff',
        borderRadius: '4px',
        padding: '2px 8px'
    };

    function _status(msg, color = '#00f2ff') {
        var el = document.getElementById('statusMsg');
        if (el) {
            el.innerText = 'Labels: ' + msg;
            el.style.color = color;
        }
    }

    function _css2dSupported() {
        return typeof THREE !== 'undefined' &&
               typeof THREE.CSS2DRenderer === 'function' &&
               typeof THREE.CSS2DObject === 'function';
    }

    function createConnectorLine(start, end) {
        if (!_css2dSupported() || !_scene) return null;
        try {
            var geom = new THREE.BufferGeometry().setFromPoints([start.clone(), end.clone()]);
            var mat = new THREE.LineDashedMaterial({
                color: _config.lineColor,
                dashSize: _config.dashSize,
                gapSize: _config.gapSize,
                linewidth: 1
            });
            var line = new THREE.Line(geom, mat);
            line.computeLineDistances();
            return line;
        } catch (e) {
            _status('Error línea conectora: ' + e.message, '#ff4444');
            return null;
        }
    }

    function createLabel(text, position) {
        if (!_css2dSupported() || !_scene) return null;
        try {
            var div = document.createElement('div');
            div.innerHTML = text.replace(/\n/g, '<br>');
            Object.assign(div.style, {
                color: _config.textColor,
                fontFamily: _config.fontFamily,
                fontSize: _config.fontSize,
                fontWeight: 'bold',
                background: _config.bgColor,
                border: '1px solid ' + _config.borderColor,
                borderRadius: _config.borderRadius,
                padding: _config.padding,
                whiteSpace: 'nowrap',
                pointerEvents: 'none'
            });
            var label = new THREE.CSS2DObject(div);
            label.position.copy(position);
            return label;
        } catch (e) {
            _status('Error etiqueta: ' + e.message, '#ff4444');
            return null;
        }
    }

    function getEquipmentLabelData(eq) {
        var anchor = new THREE.Vector3(eq.posX, eq.posY, eq.posZ);
        var offset = _config.offset.clone();
        var text = eq.tag;
        if (eq.tipo === 'tanque_v' || eq.tipo === 'torre') {
            var diam = eq.diametro || 0;
            var alt = eq.altura || 0;
            text += '\n\u2300' + diam + 'mm H=' + alt + 'mm';
            anchor = new THREE.Vector3(eq.posX, eq.posY + alt/2, eq.posZ);
            offset = new THREE.Vector3(300, 300, 0);
        } else if (eq.tipo === 'bomba') {
            var alto = eq.altura || 800;
            text += '\n' + alto + 'x' + (eq.ancho||800) + 'mm';
            anchor = new THREE.Vector3(eq.posX, eq.posY + alto/2, eq.posZ);
            offset = new THREE.Vector3(300, 200, 300);
        }
        var endPoint = anchor.clone().add(offset);
        return { anchor: anchor, endPoint: endPoint, text: text };
    }

    function getLineLabelData(line) {
        var pts = line.points || line._cachedPoints;
        if (!pts || pts.length < 2) return null;
        var mid = new THREE.Vector3(0,0,0);
        pts.forEach(function(p) { mid.add(new THREE.Vector3(p.x, p.y, p.z)); });
        mid.divideScalar(pts.length);
        var totalLen = 0;
        for (var i=0; i<pts.length-1; i++) {
            totalLen += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
        }
        var diam = line.diameter || 4;
        var material = line.material || 'PPR';
        var text = line.tag + '\n' + diam + '" ' + material + '\nL=' + (totalLen/1000).toFixed(2) + 'm';
        var offset = new THREE.Vector3(0, 200, 0);
        var endPoint = mid.clone().add(offset);
        return { anchor: mid, endPoint: endPoint, text: text };
    }

    function _safeRemove(obj) {
        if (!obj) return;
        try {
            if (typeof obj.removeFromParent === 'function') {
                obj.removeFromParent();
            } else if (obj.parent) {
                obj.parent.remove(obj);
            }
        } catch (e) {
            _status('Error removiendo: ' + e.message, '#ff4444');
        }
    }

    function removeLabelForTag(tag) {
        if (!_itemsMap.has(tag)) return;
        var item = _itemsMap.get(tag);
        if (item.line && _scene) _scene.remove(item.line);
        if (item.label) _safeRemove(item.label);
        _itemsMap.delete(tag);
    }

    function updateLabelForObject(obj) {
        if (!obj || !obj.tag) return;
        var data;
        if (obj.posX !== undefined) {
            data = getEquipmentLabelData(obj);
        } else {
            data = getLineLabelData(obj);
        }
        if (!data) {
            removeLabelForTag(obj.tag);
            return;
        }
        removeLabelForTag(obj.tag);
        var line = createConnectorLine(data.anchor, data.endPoint);
        var label = createLabel(data.text, data.endPoint);
        if (!line || !label) return;
        _scene.add(line);
        _scene.add(label);
        _itemsMap.set(obj.tag, { line: line, label: label });
    }

    function updateAllLabels() {
        if (!_core || !_scene) return;
        var db = _core.getDb();
        if (!db) return;
        var currentTags = {};
        (db.equipos||[]).forEach(function(eq) {
            currentTags[eq.tag] = true;
            updateLabelForObject(eq);
        });
        (db.lines||[]).forEach(function(line) {
            currentTags[line.tag] = true;
            updateLabelForObject(line);
        });
        // Limpiar etiquetas de objetos eliminados
        var tags = Object.keys(currentTags);
        _itemsMap.forEach(function(item, tag) {
            if (!currentTags[tag]) {
                removeLabelForTag(tag);
            }
        });
    }

    function init(coreInstance) {
        _core = coreInstance;
        _scene = _core.getScene();
        if (!_scene) {
            _status('Escena no disponible', '#ff4444');
            return;
        }
        if (!_css2dSupported()) {
            _status('CSS2DRenderer no soportado', '#ff4444');
            return;
        }
        var container = document.getElementById('canvas-container');
        if (!container) {
            _status('canvas-container no encontrado', '#ff4444');
            return;
        }
        _labelRenderer = new THREE.CSS2DRenderer();
        _labelRenderer.setSize(window.innerWidth, window.innerHeight);
        _labelRenderer.domElement.style.position = 'absolute';
        _labelRenderer.domElement.style.top = '0px';
        _labelRenderer.domElement.style.pointerEvents = 'none';
        container.appendChild(_labelRenderer.domElement);

        var originalAnimate = _core.getAnimate();
        if (originalAnimate) {
            var newAnimate = function() {
                originalAnimate();
                if (_labelRenderer && _core.getCamera()) {
                    _labelRenderer.render(_scene, _core.getCamera());
                }
            };
            _core.setAnimate(newAnimate);
        }

        _core.subscribe(function() {
            updateAllLabels();
        });

        updateAllLabels();
        window.addEventListener('resize', function() {
            if (_labelRenderer) _labelRenderer.setSize(window.innerWidth, window.innerHeight);
        });

        _status('Etiquetas activas (' + _itemsMap.size + ')', '#00ff00');
    }

    return { init: init };
})();
```

---

Paso 2: Verifica la llamada en main.js

Busca la función initModules dentro de main.js. Asegúrate de que exista la siguiente línea:

```javascript
if (typeof SmartFlowLabels !== 'undefined') SmartFlowLabels.init(SmartFlowCore);
