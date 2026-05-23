
// ============================================================
// SMARTFLOW CATALOG v3.5.2 (Abreviaturas ISO + Componentes completos)
// Archivo: js/catalog.js
// Cambios: añadida plataforma como nuevo tipo de equipo
// ============================================================

const SmartFlowCatalog = (function() {
    
    // -------------------- 1. ESPECIFICACIONES DE MATERIALES --------------------
    const specs = {
        "PPR_PN12_5": { material: "PPR", norma: "IRAM 13471", presion: "PN 12.5", color: 0x7c3aed, conexion: "TERMOFUSION" },
        "ACERO_SCH80": { material: "Acero al Carbono", norma: "ASTM A106 Gr. B", schedule: "SCH 80", color: 0x94a3b8, conexion: "NPT" },
        "ACERO_150_RF": { material: "Acero al Carbono", norma: "ASTM A105", clase: "150", cara: "RF", color: 0x64748b, conexion: "BRIDADA" },
        "CS_300_RF": { material: "Acero al Carbono", norma: "ASTM A105", clase: "300", cara: "RF", color: 0x475569, conexion: "BRIDADA" },
        "SS_150_RF": { material: "Acero Inoxidable 316L", norma: "ASTM A182 F316L", clase: "150", cara: "RF", color: 0x94a3b8, conexion: "BRIDADA" },
        "SS_SANITARY": { material: "Acero Inoxidable 316L", norma: "3A / ASME BPE", acabado: "Ra < 0.8 µm", color: 0xe2e8f0, conexion: "TRI-CLAMP" },
        "PTFE_LINED": { material: "Acero al Carbono Revestido PTFE", norma: "ASTM A395", color: 0xa78bfa, conexion: "BRIDADA" },
        "HDPE_PE100": { material: "HDPE", norma: "PE100", presion: "PN 10", color: 0x22c55e, conexion: "ELECTROFUSION" },
        "PVC_SCH80": { material: "PVC", norma: "ASTM D1785", schedule: "SCH 80", color: 0xeab308, conexion: "CEMENTADO" }
    };

    // -------------------- 2. DEFINICIÓN DE EQUIPOS --------------------
    const equipment = {
        tanque_v: { 
            nombre: 'Tanque Vertical', categoria: 'almacenamiento', forma: 'cilindro',
            generarPuertos: (eq) => {
                const alturaRelativaSalida = eq.altura_salida_desde_base !== undefined ? eq.altura_salida_desde_base - eq.altura/2 : -eq.altura/2;
                return [
                    { id: 'N1', label: 'Salida de Fondo / Succión', relX: 0, relY: alturaRelativaSalida, relZ: 0, diametro: eq.diametro_salida || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 0, dy: 0, dz: 1 } },
                    { id: 'N2', label: 'Entrada Superior', relX: 0, relY: eq.altura/2, relZ: 0, diametro: eq.diametro_entrada || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 0, dy: 1, dz: 0 } }
                ];
            }
        },
        tanque_h: { 
            nombre: 'Tanque Horizontal', categoria: 'almacenamiento', forma: 'cilindro_horizontal',
            generarPuertos: (eq) => [
                { id: 'N1', label: 'Salida', relX: eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_salida || 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } },
                { id: 'N2', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_entrada || 4, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } }
            ]
        },
        bomba: { 
            nombre: 'Bomba Centrífuga', categoria: 'rotativo', forma: 'rectangular',
            generarPuertos: (eq) => [
                { id: 'SUC', label: 'Succión', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_succion || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'DESC', label: 'Descarga', relX: eq.largo/2, relY: 0, relZ: 0, diametro: eq.diametro_descarga || 3, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        bomba_dosificacion: { 
            nombre: 'Bomba Dosificadora', categoria: 'rotativo', forma: 'rectangular',
            generarPuertos: (eq) => [
                { id: 'SUC', label: 'Succión', relX: -200, relY: 0, relZ: 0, diametro: 1, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'DESC', label: 'Descarga', relX: 200, relY: 0, relZ: 0, diametro: 1, tipoConexion: 'NPT_HEMBRA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        intercambiador: { 
            nombre: 'Intercambiador de Calor', categoria: 'termico', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN1', label: 'Entrada Caliente', relX: -eq.largo/2, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT1', label: 'Salida Caliente', relX: eq.largo/2, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        torre: { 
            nombre: 'Torre de Destilación', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: 0, relY: 0, relZ: eq.diametro/2, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 0, dz: 1 } },
                { id: 'TOP', label: 'Tope', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'BOT', label: 'Fondo', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        reactor: { 
            nombre: 'Reactor', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        caldera: { 
            nombre: 'Caldera', categoria: 'termico', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'AGUA', label: 'Entrada Agua', relX: -eq.largo/2, relY: eq.altura/4, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'VAPOR', label: 'Salida Vapor', relX: eq.largo/2, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 1, dz: 0 } }
            ]
        },
        compresor: { 
            nombre: 'Compresor', categoria: 'rotativo', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'SUC', label: 'Succión', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'DESC', label: 'Descarga', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        separador: { 
            nombre: 'Separador', categoria: 'proceso', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'GAS', label: 'Salida Gas', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 4, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'LIQ', label: 'Salida Líquido', relX: eq.largo/2, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 1, dy: -1, dz: 0 } }
            ]
        },
        clarificador: { 
            nombre: 'Clarificador', categoria: 'tratamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 8, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        filtro_arena: { 
            nombre: 'Filtro de Arena', categoria: 'tratamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 6, tipoConexion: 'BRIDADA', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        osmosis: { 
            nombre: 'Ósmosis Inversa', categoria: 'tratamiento', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'FEED', label: 'Alimentación', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'PERM', label: 'Permeado', relX: eq.largo/2, relY: eq.altura/2, relZ: 0, diametro: 2, tipoConexion: 'NPT', orientacion: { dx: 1, dy: 1, dz: 0 } }
            ]
        },
        bomba_sumergible: { 
            nombre: 'Bomba Sumergible', categoria: 'rotativo', forma: 'circulo',
            generarPuertos: (eq) => [
                { id: 'DESC', label: 'Descarga', relX: 0, relY: 500, relZ: 0, diametro: 4, tipoConexion: 'NPT', orientacion: { dx: 0, dy: 1, dz: 0 } }
            ]
        },
        tanque_acero: { 
            nombre: 'Tanque Acero Inoxidable', categoria: 'almacenamiento', forma: 'cilindro',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: 0, relY: eq.altura/2, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 0, dy: 1, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: 0, relY: -eq.altura/2, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 0, dy: -1, dz: 0 } }
            ]
        },
        pasteurizador: { 
            nombre: 'Pasteurizador', categoria: 'termico', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'TRI-CLAMP', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 4, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        homogeneizador: { 
            nombre: 'Homogeneizador', categoria: 'proceso', forma: 'rect',
            generarPuertos: (eq) => [
                { id: 'IN', label: 'Entrada', relX: -eq.largo/2, relY: 0, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: -1, dy: 0, dz: 0 } },
                { id: 'OUT', label: 'Salida', relX: eq.largo/2, relY: 0, relZ: 0, diametro: 3, tipoConexion: 'TRI-CLAMP', orientacion: { dx: 1, dy: 0, dz: 0 } }
            ]
        },
        plataforma: {
            nombre: 'Plataforma Estructural',
            categoria: 'estructura',
            forma: 'rect',
            generarPuertos: (eq) => []
        }
    };

    // -------------------- 3. COMPONENTES DE TUBERÍA --------------------
    const components = {
        TEE_EQUAL_CS: { tipo: 'TEE_EQUAL', nombre: 'Tee Recta Acero', abbr: 'TE', spec: 'ACERO_150_RF', norma: 'ASTM A234 WPB', material: 'Acero al Carbono' },
        TEE_REDUCING_CS: { tipo: 'TEE_REDUCING', nombre: 'Tee Reductora Acero', abbr: 'TR', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        TEE_EQUAL_PPR: { tipo: 'TEE_EQUAL', nombre: 'Tee Recta PPR', abbr: 'TE', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        TEE_REDUCING_PPR: { tipo: 'TEE_REDUCING', nombre: 'Tee Reductora PPR', abbr: 'TR', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        TEE_EQUAL_HDPE: { tipo: 'TEE_EQUAL', nombre: 'Tee Recta HDPE', abbr: 'TE', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE' },
        TEE_EQUAL_PVC: { tipo: 'TEE_EQUAL', nombre: 'Tee Recta PVC', abbr: 'TE', spec: 'PVC_SCH80', conexion: 'CEMENTADO', material: 'PVC' },
        CROSS_CS: { tipo: 'CROSS', nombre: 'Cruz Acero', abbr: 'CR', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        TEE_EQUAL_SS: { tipo: 'TEE_EQUAL', nombre: 'Tee Recta Inoxidable', abbr: 'TE', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        TEE_REDUCING_SS: { tipo: 'TEE_REDUCING', nombre: 'Tee Reductora Inoxidable', abbr: 'TR', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        TEE_REDUCING_PVC: { tipo: 'TEE_REDUCING', nombre: 'Tee Reductora PVC', abbr: 'TR', spec: 'PVC_SCH80', conexion: 'CEMENTADO', material: 'PVC' },
        TEE_REDUCING_HDPE: { tipo: 'TEE_REDUCING', nombre: 'Tee Reductora HDPE', abbr: 'TR', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE' },
        
        PIPE_PPR_PN12_5: { tipo: 'PIPE', nombre: 'Tubo PPR PN12.5', abbr: 'PP', spec: 'PPR_PN12_5' },
        PIPE_CS_SCH80: { tipo: 'PIPE', nombre: 'Tubo Acero SCH80', abbr: 'CS', spec: 'ACERO_SCH80' },
        PIPE_SS_SANITARY: { tipo: 'PIPE', nombre: 'Tubo Sanitario Acero Inox', abbr: 'SS', spec: 'SS_SANITARY' },
        PIPE_HDPE_PE100: { tipo: 'PIPE', nombre: 'Tubo HDPE PE100', abbr: 'PE', spec: 'HDPE_PE100' },
        PIPE_PVC_SCH80: { tipo: 'PIPE', nombre: 'Tubo PVC SCH80', abbr: 'PV', spec: 'PVC_SCH80' },
        
        GATE_VALVE_CS_150: { tipo: 'GATE_VALVE', nombre: 'Válvula Compuerta Acero 150#', abbr: 'GV', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        GATE_VALVE_PPR: { tipo: 'GATE_VALVE', nombre: 'Válvula Compuerta PPR', abbr: 'GV', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        GLOBE_VALVE_CS_150: { tipo: 'GLOBE_VALVE', nombre: 'Válvula Globo Acero 150#', abbr: 'GL', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        GLOBE_VALVE_SS_300: { tipo: 'GLOBE_VALVE', nombre: 'Válvula Globo Inox 300#', abbr: 'GL', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        BUTTERFLY_VALVE_CS_150: { tipo: 'BUTTERFLY_VALVE', nombre: 'Válvula Mariposa Acero 150#', abbr: 'VB', spec: 'ACERO_150_RF', conexion: 'WAFER', material: 'Acero al Carbono' },
        BUTTERFLY_VALVE_PPR: { tipo: 'BUTTERFLY_VALVE', nombre: 'Válvula Mariposa PPR', abbr: 'VB', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        BUTTERFLY_VALVE_SS_SANITARY: { tipo: 'BUTTERFLY_VALVE', nombre: 'Válvula Mariposa Sanitaria', abbr: 'VB', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP', material: 'Acero Inoxidable' },
        BALL_VALVE_CS_150: { tipo: 'BALL_VALVE', nombre: 'Válvula de Bola Acero 150#', abbr: 'BA', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        BALL_VALVE_PPR: { tipo: 'BALL_VALVE', nombre: 'Válvula de Bola PPR', abbr: 'BA', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        BALL_VALVE_HDPE: { tipo: 'BALL_VALVE', nombre: 'Válvula de Bola HDPE', abbr: 'BA', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE' },
        BALL_VALVE_SS: { tipo: 'BALL_VALVE', nombre: 'Válvula de Bola Inoxidable', abbr: 'BA', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        CHECK_VALVE_SWING_CS: { tipo: 'CHECK_VALVE', nombre: 'Válvula Check Swing Acero', abbr: 'CK', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        CHECK_VALVE_WAFER_SS: { tipo: 'CHECK_VALVE', nombre: 'Válvula Check Wafer Inox', abbr: 'CK', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        CHECK_VALVE_PPR: { tipo: 'CHECK_VALVE', nombre: 'Válvula Check PPR', abbr: 'CK', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        DIAPHRAGM_VALVE_PTFE: { tipo: 'DIAPHRAGM_VALVE', nombre: 'Válvula de Diafragma PTFE', abbr: 'DV', spec: 'PTFE_LINED', material: 'PTFE' },
        CONTROL_VALVE_CS: { tipo: 'CONTROL_VALVE', nombre: 'Válvula de Control Acero', abbr: 'CV', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        PRESSURE_RELIEF_VALVE: { tipo: 'PRESSURE_RELIEF', nombre: 'Válvula de Alivio', abbr: 'RV', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        SAFETY_VALVE_SS: { tipo: 'SAFETY_VALVE', nombre: 'Válvula de Seguridad Inox', abbr: 'SV', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        
        ELBOW_90_LR_CS: { tipo: 'ELBOW_90_LR', nombre: 'Codo 90° Radio Largo Acero', abbr: 'EL', spec: 'ACERO_150_RF', material: 'Acero al Carbono', angulo: 90 },
        ELBOW_90_SR_CS: { tipo: 'ELBOW_90_SR', nombre: 'Codo 90° Radio Corto Acero', abbr: 'EL', spec: 'ACERO_150_RF', material: 'Acero al Carbono', angulo: 90 },
        ELBOW_45_CS: { tipo: 'ELBOW_45', nombre: 'Codo 45° Acero', abbr: 'E4', spec: 'ACERO_150_RF', material: 'Acero al Carbono', angulo: 45 },
        ELBOW_90_PPR: { tipo: 'ELBOW_90_PPR', nombre: 'Codo 90° PPR', abbr: 'EL', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR', angulo: 90 },
        ELBOW_45_PPR: { tipo: 'ELBOW_45_PPR', nombre: 'Codo 45° PPR', abbr: 'E4', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR', angulo: 45 },
        ELBOW_90_HDPE: { tipo: 'ELBOW_90_HDPE', nombre: 'Codo 90° HDPE', abbr: 'EL', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE', angulo: 90 },
        ELBOW_45_HDPE: { tipo: 'ELBOW_45_HDPE', nombre: 'Codo 45° HDPE', abbr: 'E4', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE', angulo: 45 },
        ELBOW_90_PVC: { tipo: 'ELBOW_90_PVC', nombre: 'Codo 90° PVC', abbr: 'EL', spec: 'PVC_SCH80', conexion: 'CEMENTADO', material: 'PVC', angulo: 90 },
        ELBOW_45_PVC: { tipo: 'ELBOW_45_PVC', nombre: 'Codo 45° PVC', abbr: 'E4', spec: 'PVC_SCH80', conexion: 'CEMENTADO', material: 'PVC', angulo: 45 },
        ELBOW_90_LR_SS: { tipo: 'ELBOW_90_LR', nombre: 'Codo 90° Radio Largo Inox', abbr: 'EL', spec: 'SS_150_RF', material: 'Acero Inoxidable', angulo: 90 },
        ELBOW_45_SS: { tipo: 'ELBOW_45', nombre: 'Codo 45° Inoxidable', abbr: 'E4', spec: 'SS_150_RF', material: 'Acero Inoxidable', angulo: 45 },
        ELBOW_90_SANITARY: { tipo: 'ELBOW_90_SR', nombre: 'Codo 90° Sanitario', abbr: 'EL', spec: 'SS_SANITARY', conexion: 'TRI-CLAMP', material: 'Acero Inoxidable', angulo: 90 },
        
        CONCENTRIC_REDUCER_CS: { tipo: 'CONCENTRIC_REDUCER', nombre: 'Reductor Concéntrico Acero', abbr: 'RC', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        ECCENTRIC_REDUCER_CS: { tipo: 'ECCENTRIC_REDUCER', nombre: 'Reductor Excéntrico Acero', abbr: 'RE', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        CONCENTRIC_REDUCER_PPR: { tipo: 'CONCENTRIC_REDUCER', nombre: 'Reductor Concéntrico PPR', abbr: 'RC', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        CONCENTRIC_REDUCER_HDPE: { tipo: 'CONCENTRIC_REDUCER', nombre: 'Reductor Concéntrico HDPE', abbr: 'RC', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE' },
        CONCENTRIC_REDUCER_SS: { tipo: 'CONCENTRIC_REDUCER', nombre: 'Reductor Concéntrico Inox', abbr: 'RC', spec: 'SS_150_RF', material: 'Acero Inoxidable' },
        CONCENTRIC_REDUCER_PVC: { tipo: 'CONCENTRIC_REDUCER', nombre: 'Reductor Concéntrico PVC', abbr: 'RC', spec: 'PVC_SCH80', conexion: 'CEMENTADO', material: 'PVC' },
        ECCENTRIC_REDUCER_PPR: { tipo: 'ECCENTRIC_REDUCER', nombre: 'Reductor Excéntrico PPR', abbr: 'RE', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        
        WELD_NECK_FLANGE_150: { tipo: 'WELD_NECK_FLANGE', nombre: 'Brida Cuello Soldable 150#', abbr: 'FL', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        SLIP_ON_FLANGE_150: { tipo: 'SLIP_ON_FLANGE', nombre: 'Brida Slip-On 150#', abbr: 'FL', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        BLIND_FLANGE_150: { tipo: 'BLIND_FLANGE', nombre: 'Brida Ciega 150#', abbr: 'FB', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        LAP_JOINT_FLANGE_150: { tipo: 'LAP_JOINT_FLANGE', nombre: 'Brida Loca Acero', abbr: 'FL', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        STUB_END_PPR: { tipo: 'STUB_END', nombre: 'Portabrida PPR', abbr: 'SE', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        STUB_END_HDPE: { tipo: 'STUB_END', nombre: 'Portabrida HDPE', abbr: 'SE', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE' },
        
        CAP_CS: { tipo: 'CAP', nombre: 'Tapón Acero', abbr: 'CA', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        CAP_PPR: { tipo: 'CAP', nombre: 'Tapón PPR', abbr: 'CA', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        
        UNION_CS_3000: { tipo: 'UNION', nombre: 'Unión Universal Acero 3000', abbr: 'UN', spec: 'ACERO_SCH80', material: 'Acero al Carbono' },
        UNION_PPR: { tipo: 'UNION', nombre: 'Unión Universal PPR', abbr: 'UN', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR' },
        UNION_HDPE: { tipo: 'UNION', nombre: 'Unión Universal HDPE', abbr: 'UN', spec: 'HDPE_PE100', conexion: 'ELECTROFUSION', material: 'HDPE' },
        
        BULKHEAD_PE_3IN: { tipo: 'BULKHEAD', nombre: 'Pasamuros Heavy Duty 3 pulgadas', abbr: 'BH', material: 'PP_EPDM', conexion: 'NPT_HEMBRA', diametro: 3 },
        BULKHEAD_PE_4IN: { tipo: 'BULKHEAD', nombre: 'Pasamuros Heavy Duty 4 pulgadas', abbr: 'BH', material: 'PP_EPDM', conexion: 'NPT_HEMBRA', diametro: 4 },
        BULKHEAD: { tipo: 'BULKHEAD', nombre: 'Pasamuros Heavy Duty', abbr: 'BH', material: 'PP_EPDM', conexion: 'NPT_HEMBRA' },
        
        ADAPTADOR_MACHO_PPR_3IN: { tipo: 'TRANSITION', nombre: 'Adaptador Macho PPR 90mm x 3 NPT', abbr: 'AM', spec_origen: 'PPR_PN12_5', spec_destino: 'ACERO_SCH80', conexion_origen: 'TERMOFUSION', conexion_destino: 'NPT_MACHO' },
        ADAPTADOR_HEMBRA_PPR_3IN: { tipo: 'TRANSITION', nombre: 'Adaptador Hembra PPR 90mm x 3 NPT', abbr: 'AH', spec_origen: 'PPR_PN12_5', spec_destino: 'ACERO_SCH80', conexion_origen: 'TERMOFUSION', conexion_destino: 'NPT_HEMBRA' },
        TRANSITION_HDPE_STEEL: { tipo: 'TRANSITION', nombre: 'Transición HDPE x Acero', abbr: 'TR', spec_origen: 'HDPE_PE100', spec_destino: 'ACERO_150_RF', conexion_origen: 'ELECTROFUSION', conexion_destino: 'BRIDADA' },
        
        UNION_UNIVERSAL_ACERO_3IN: { tipo: 'UNION_ACERO', nombre: 'Unión Universal Acero 3 pulgadas', abbr: 'UN', spec: 'ACERO_SCH80', conexion: 'NPT_HEMBRA', material: 'Acero Galvanizado' },
        NIPLE_ACERO_3IN_150MM: { tipo: 'NIPPLE', nombre: 'Niple Acero 3 x 150 mm', abbr: 'NI', spec: 'ACERO_SCH80', conexion: 'NPT_MACHO', material: 'Acero al Carbono', longitud_total: 150 },
        NIPLE_ACERO_3IN_100MM: { tipo: 'NIPPLE', nombre: 'Niple Acero 3 x 100 mm', abbr: 'NI', spec: 'ACERO_SCH80', conexion: 'NPT_MACHO', material: 'Acero al Carbono', longitud_total: 100 },
        
        EXPANSION_JOINT_PPR: { tipo: 'EXPANSION_JOINT', nombre: 'Junta de Expansión PPR', abbr: 'EJ', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', material: 'PPR_EPDM' },
        EXPANSION_JOINT_CS: { tipo: 'EXPANSION_JOINT', nombre: 'Junta de Expansión Acero', abbr: 'EJ', spec: 'ACERO_150_RF', clase: '150', material: 'Acero al Carbono' },
        
        Y_STRAINER_CS: { tipo: 'Y_STRAINER', nombre: 'Filtro Tipo Y Acero', abbr: 'YS', spec: 'ACERO_150_RF', clase: '150', malla: '40 Mesh' },
        Y_STRAINER_PPR: { tipo: 'Y_STRAINER', nombre: 'Filtro Tipo Y PPR', abbr: 'YS', spec: 'PPR_PN12_5', conexion: 'TERMOFUSION', malla: '40 Mesh' },
        T_STRAINER: { tipo: 'T_STRAINER', nombre: 'Filtro Tipo T', abbr: 'TS', spec: 'ACERO_150_RF', clase: '150', material: 'Acero al Carbono' },
        BASKET_STRAINER: { tipo: 'BASKET_STRAINER', nombre: 'Filtro Canasta', abbr: 'BS', spec: 'ACERO_150_RF', clase: '150', material: 'Acero al Carbono' },
        
        STEAM_TRAP_THERMODYNAMIC: { tipo: 'STEAM_TRAP', subtipo: 'THERMODYNAMIC', nombre: 'Trampa de Vapor Termodinámica', abbr: 'ST', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        STEAM_TRAP_FLOAT: { tipo: 'STEAM_TRAP', subtipo: 'FLOAT', nombre: 'Trampa de Vapor de Flotador', abbr: 'SF', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        STEAM_TRAP_BUCKET: { tipo: 'STEAM_TRAP', subtipo: 'BUCKET', nombre: 'Trampa de Vapor de Cubeta', abbr: 'SB', spec: 'ACERO_150_RF', material: 'Acero al Carbono' },
        
        PRESSURE_GAUGE: { tipo: 'PRESSURE_GAUGE', nombre: 'Manómetro', abbr: 'PG', rango: '0-100 psi', conexion: '1/2 NPT' },
        TEMPERATURE_GAUGE: { tipo: 'TEMPERATURE_GAUGE', nombre: 'Termómetro', abbr: 'TG', rango: '0-150 °C' },
        FLOW_METER_MAG: { tipo: 'FLOW_METER', subtipo: 'MAGNETICO', nombre: 'Caudalímetro Magnético', abbr: 'FM', conexion: 'BRIDADA' },
        PRESSURE_TRANSMITTER: { tipo: 'INSTRUMENT', nombre: 'Transmisor de Presión', abbr: 'PT', señal: '4-20 mA' },
        LEVEL_TRANSMITTER: { tipo: 'INSTRUMENT', nombre: 'Transmisor de Nivel', abbr: 'LT', señal: '4-20 mA' },
        TEMPERATURE_TRANSMITTER: { tipo: 'INSTRUMENT', nombre: 'Transmisor de Temperatura', abbr: 'TT', señal: '4-20 mA' },
        ROTAMETER: { tipo: 'INSTRUMENT', nombre: 'Rotámetro', abbr: 'RO', conexion: 'ROSCADO' },
        SIGHT_GLASS: { tipo: 'INSTRUMENT', nombre: 'Visor de Flujo', abbr: 'SG', conexion: 'ROSCADO' },
        LEVEL_SWITCH_RANA: { tipo: 'LEVEL_SWITCH_RANA', nombre: 'Switch de Nivel Tipo Rana', abbr: 'LS', conexion: '1/2 NPT' },
        
        PIPE_SHOE: { tipo: 'PIPE_SHOE', nombre: 'Zapata', abbr: 'SH', material: 'Acero al Carbono' },
        U_BOLT: { tipo: 'U_BOLT', nombre: 'Abrazadera U-Bolt', abbr: 'UB', material: 'Acero Galvanizado' },
        GUIDE: { tipo: 'GUIDE', nombre: 'Guía', abbr: 'GD', material: 'Acero al Carbono' },
        ANCHOR: { tipo: 'ANCHOR', nombre: 'Anclaje Fijo', abbr: 'AN', material: 'Acero al Carbono' },
        HANGER: { tipo: 'HANGER', nombre: 'Colgador', abbr: 'HG', material: 'Acero al Carbono' },
        SPRING_HANGER: { tipo: 'SPRING_HANGER', nombre: 'Colgador de Resorte', abbr: 'SH', material: 'Acero al Carbono' },
        PIPE_CLAMP: { tipo: 'PIPE_CLAMP', nombre: 'Abrazadera', abbr: 'PC', material: 'Acero al Carbono' },
        
        CAMLOCK_MALE: { tipo: 'CAMLOCK', subtipo: 'MALE', nombre: 'Acople Camlock Macho', abbr: 'CM', material: 'Acero Inoxidable' },
        CAMLOCK_FEMALE: { tipo: 'CAMLOCK', subtipo: 'FEMALE', nombre: 'Acople Camlock Hembra', abbr: 'CF', material: 'Acero Inoxidable' },
        QUICK_CONNECT: { tipo: 'QUICK_CONNECT', nombre: 'Conexión Rápida', abbr: 'QC', material: 'Acero Inoxidable' },
        
        FLEXIBLE_HOSE: { tipo: 'HOSE', nombre: 'Manguera Flexible', abbr: 'HO', material: 'EPDM' },
        METALLIC_HOSE: { tipo: 'HOSE', subtipo: 'METALLIC', nombre: 'Manguera Metálica', abbr: 'HM', material: 'Acero Inoxidable' },
        PTFE_HOSE: { tipo: 'HOSE', subtipo: 'PTFE', nombre: 'Manguera PTFE', abbr: 'HP', material: 'PTFE' },
        
        SILENCER: { tipo: 'SILENCER', nombre: 'Silenciador', abbr: 'SI', material: 'Acero al Carbono' },
        VENT_SILENCER: { tipo: 'SILENCER', subtipo: 'VENT', nombre: 'Silenciador de Venteo', abbr: 'VS', material: 'Acero Inoxidable' },
        FLAME_ARRESTER: { tipo: 'FLAME_ARRESTER', nombre: 'Arrestador de Llama', abbr: 'FA', material: 'Acero Inoxidable' },
        VACUUM_BREAKER: { tipo: 'VACUUM_BREAKER', nombre: 'Rompedor de Vacío', abbr: 'VB', material: 'Acero Inoxidable' },
        
        DRAIN_VALVE: { tipo: 'DRAIN_VALVE', nombre: 'Válvula de Purga', abbr: 'DV', spec: 'ACERO_SCH80', conexion: 'NPT', material: 'Acero al Carbono' },
        AIR_RELEASE_VALVE: { tipo: 'AIR_RELEASE', nombre: 'Válvula de Liberación de Aire', abbr: 'AR', material: 'Acero Inoxidable' },
        
        SAMPLE_COOLER: { tipo: 'SAMPLE_COOLER', nombre: 'Enfriador de Muestra', abbr: 'SC', material: 'Acero Inoxidable' },
        SAMPLE_VALVE: { tipo: 'SAMPLE_VALVE', nombre: 'Válvula de Muestreo', abbr: 'SV', material: 'Acero Inoxidable' }
    };

    // ==================== 4. GENERADORES DE PUERTOS PARA ACCESORIOS ====================
    function calculateLineDirection(line, param) {
        if (!line) return { dx: 1, dy: 0, dz: 0 };
        let pts = [];
        if (typeof SmartFlowCore !== 'undefined' && SmartFlowCore.getLinePoints) {
            pts = SmartFlowCore.getLinePoints(line) || [];
        } else {
            pts = line._cachedPoints || line.points3D || line.points || [];
        }
        if (!pts || pts.length < 2) return { dx: 1, dy: 0, dz: 0 };
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            let d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d); totalLen += d;
        }
        if (totalLen === 0) return { dx: 1, dy: 0, dz: 0 };
        const targetLen = totalLen * param;
        let currentAccum = 0, segIndex = 0;
        for (let i = 0; i < lengths.length; i++) {
            if (currentAccum + lengths[i] >= targetLen || i === lengths.length - 1) { segIndex = i; break; }
            currentAccum += lengths[i];
        }
        const p1 = pts[segIndex], p2 = pts[segIndex + 1];
        const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
        const len = Math.hypot(dx, dy, dz) || 1;
        return { dx: dx/len, dy: dy/len, dz: dz/len };
    }

    function getPerpendicularVector(dir) {
        if (Math.abs(dir.dy) > 0.9) return { dx: 1, dy: 0, dz: 0 };
        let perp = { dx: -dir.dy, dy: dir.dx, dz: 0 };
        const len = Math.hypot(perp.dx, perp.dy, perp.dz);
        if (len < 0.1) perp = { dx: 1, dy: 0, dz: 0 };
        else { perp.dx /= len; perp.dy /= len; perp.dz /= len; }
        return perp;
    }

    function getComponentOffset(tipo, diametro) {
        const dim = getComponentDimension(tipo, diametro) / 2;
        return dim > 0 ? dim : 50;
    }

    const baseGenerators = {
        TEE_EQUAL: (line, param, diametro) => {
            const dir = calculateLineDirection(line, param);
            const perp = getPerpendicularVector(dir);
            const offset = getComponentOffset('TEE_EQUAL', diametro);
            return [
                { id: 'RUN1', label: 'Entrada', relX: -dir.dx*offset, relY: -dir.dy*offset, relZ: -dir.dz*offset, orientacion: dir, diametro },
                { id: 'RUN2', label: 'Salida', relX: dir.dx*offset, relY: dir.dy*offset, relZ: dir.dz*offset, orientacion: dir, diametro },
                { id: 'BRANCH', label: 'Derivación', relX: perp.dx*offset, relY: perp.dy*offset, relZ: perp.dz*offset, orientacion: perp, diametro }
            ];
        },
        TEE_REDUCING: (line, param, diametro) => {
            const dir = calculateLineDirection(line, param);
            const perp = getPerpendicularVector(dir);
            const offset = getComponentOffset('TEE_REDUCING', diametro);
            return [
                { id: 'RUN1', label: 'Entrada', relX: -dir.dx*offset, relY: -dir.dy*offset, relZ: -dir.dz*offset, orientacion: dir, diametro },
                { id: 'RUN2', label: 'Salida', relX: dir.dx*offset, relY: dir.dy*offset, relZ: dir.dz*offset, orientacion: dir, diametro },
                { id: 'BRANCH', label: 'Derivación', relX: perp.dx*offset, relY: perp.dy*offset, relZ: perp.dz*offset, orientacion: perp, diametro: diametro * 0.75 }
            ];
        },
        CROSS: (line, param, diametro) => {
            const dir = calculateLineDirection(line, param);
            const perp1 = getPerpendicularVector(dir);
            const perp2 = { dx: dir.dy * perp1.dz - dir.dz * perp1.dy, dy: dir.dz * perp1.dx - dir.dx * perp1.dz, dz: dir.dx * perp1.dy - dir.dy * perp1.dx };
            const offset = getComponentOffset('CROSS', diametro);
            return [
                { id: 'RUN1', label: 'Entrada', relX: -dir.dx*offset, relY: -dir.dy*offset, relZ: -dir.dz*offset, orientacion: dir, diametro },
                { id: 'RUN2', label: 'Salida', relX: dir.dx*offset, relY: dir.dy*offset, relZ: dir.dz*offset, orientacion: dir, diametro },
                { id: 'BRANCH1', label: 'Derivación 1', relX: perp1.dx*offset, relY: perp1.dy*offset, relZ: perp1.dz*offset, orientacion: perp1, diametro },
                { id: 'BRANCH2', label: 'Derivación 2', relX: perp2.dx*offset, relY: perp2.dy*offset, relZ: perp2.dz*offset, orientacion: perp2, diametro }
            ];
        }
    };

    function assignGenerators() {
        const teeEqualKeys = ['TEE_EQUAL_CS', 'TEE_EQUAL_PPR', 'TEE_EQUAL_HDPE', 'TEE_EQUAL_PVC', 'TEE_EQUAL_SS'];
        const teeReducingKeys = ['TEE_REDUCING_CS', 'TEE_REDUCING_PPR', 'TEE_REDUCING_PVC', 'TEE_REDUCING_HDPE', 'TEE_REDUCING_SS'];
        const crossKeys = ['CROSS_CS'];

        for (const key of teeEqualKeys) {
            if (components[key] && !components[key].generarPuertos) {
                components[key].generarPuertos = baseGenerators.TEE_EQUAL;
            }
        }
        for (const key of teeReducingKeys) {
            if (components[key] && !components[key].generarPuertos) {
                components[key].generarPuertos = baseGenerators.TEE_REDUCING;
            }
        }
        for (const key of crossKeys) {
            if (components[key] && !components[key].generarPuertos) {
                components[key].generarPuertos = baseGenerators.CROSS;
            }
        }
    }
    assignGenerators();

    // -------------------- 5. DIMENSIONES ESTÁNDAR --------------------
    const dimensiones = {
        "codo_90": { 2: 152, 3: 229, 4: 305, 6: 457, 8: 610 },
        "codo_45": { 2: 80, 3: 110, 4: 150, 6: 230 },
        "tee": { 2: 127, 3: 152, 4: 178, 6: 229, 8: 279 },
        "tee_reducing": { 3: 160, 4: 190, 6: 240 },
        "cross": { 2: 140, 3: 165, 4: 200, 6: 260 },
        "valvula_compuerta": { 2: 178, 3: 203, 4: 229, 6: 267 },
        "valvula_globo": { 2: 200, 3: 240, 4: 280, 6: 350 },
        "valvula_bola": { 2: 150, 3: 180, 4: 210, 6: 260 },
        "valvula_mariposa": { 2: 100, 3: 120, 4: 140, 6: 180 },
        "reduccion": { "4x3": 102, "6x4": 152, "3x2": 89, "8x6": 203, "6x3": 178, "default": 120 },
        "insercion_ppr": { 2: 45, 3: 60, 4: 75, 6: 90 },
        "insercion_hdpe": { 2: 50, 3: 65, 4: 80, 6: 100 },
        "union_universal": { 2: 70, 3: 90, 4: 110, 6: 140 },
        "adaptador_macho": { 2: 45, 3: 60, 4: 75, 6: 90 },
        "brida_espesor_150": { 2: 12, 3: 15, 4: 18, 6: 22 }
    };

    function getComponentDimension(tipo, diametro) {
        let lookupTipo = tipo;
        const tipoUpper = (tipo || '').toUpperCase();
        if (tipoUpper.includes('TEE_REDUCING')) lookupTipo = 'tee_reducing';
        else if (tipoUpper.includes('TEE')) lookupTipo = 'tee';
        else if (tipoUpper.includes('CROSS')) lookupTipo = 'cross';
        else if (tipoUpper.includes('ELBOW_90')) lookupTipo = 'codo_90';
        else if (tipoUpper.includes('ELBOW_45')) lookupTipo = 'codo_45';
        else if (tipoUpper.includes('GATE_VALVE')) lookupTipo = 'valvula_compuerta';
        else if (tipoUpper.includes('GLOBE_VALVE')) lookupTipo = 'valvula_globo';
        else if (tipoUpper.includes('BALL_VALVE')) lookupTipo = 'valvula_bola';
        else if (tipoUpper.includes('BUTTERFLY_VALVE')) lookupTipo = 'valvula_mariposa';
        else if (tipoUpper.includes('REDUCER') || tipoUpper.includes('REDUCCION')) lookupTipo = 'reduccion';
        else if (tipoUpper.includes('UNION')) lookupTipo = 'union_universal';
        else if (tipoUpper.includes('TRANSITION')) lookupTipo = 'adaptador_macho';
        else if (tipoUpper.includes('FLANGE')) lookupTipo = 'brida_espesor_150';

        const dims = dimensiones[lookupTipo];
        if (!dims) return 0;

        if (lookupTipo === 'reduccion') {
            if (typeof diametro === 'string' && dims[diametro] !== undefined) return dims[diametro];
            return dims["default"];
        }

        if (dims[diametro] !== undefined) return dims[diametro];
        if (Array.isArray(dims) && dims.length > 0) return dims[0];
        return 0;
    }

    // -------------------- 6. FACTORÍA VISUAL 3D --------------------
    function createEquipmentMesh(eq) {
        let geometry, material;
        const spec = specs[eq.spec] || specs["ACERO_150_RF"];
        const color = spec ? spec.color : 0x7c3aed;
        const mat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.6, roughness: 0.4 });
        
        switch(eq.tipo) {
            case 'tanque_v': case 'torre': case 'reactor':
                const radius = (eq.diametro || 1000) / 2;
                const height = eq.altura || 1500;
                geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
                break;
            case 'tanque_h':
                const rx = (eq.largo || 2000) / 2;
                const ry = (eq.diametro || 1000) / 2;
                geometry = new THREE.BoxGeometry(rx*2, ry*2, ry*2);
                break;
            default:
                const width = eq.largo || 800;
                const heightBox = eq.altura || 800;
                const depth = eq.ancho || 800;
                geometry = new THREE.BoxGeometry(width, heightBox, depth);
        }
        const mesh = new THREE.Mesh(geometry, mat);
        mesh.position.set(eq.posX || 0, eq.posY || 0, eq.posZ || 0);
        mesh.userData = { tag: eq.tag, type: 'equipment' };
        return mesh;
    }

    function createLineMesh(lineData) {
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.createLineMesh)
            return SmartFlowRouter.createLineMesh(lineData);
        return new THREE.Group();
    }

    // -------------------- 7. API PÚBLICA --------------------
    return {
        getSpecs: () => specs,
        getSpec: (id) => specs[id] || null,
        getEquipment: (tipo) => equipment[tipo] || null,
        getComponent: (id) => components[id] || null,
        getDimension: (tipo, diametro) => dimensiones[tipo]?.[diametro] || null,
        getComponentDimension,
        listEquipmentTypes: () => Object.keys(equipment),
        listComponentTypes: () => Object.keys(components),
        listSpecs: () => Object.keys(specs),
        
        createEquipment: function(tipo, tag, x, y, z, opciones = {}) {
            const def = equipment[tipo];
            if (!def) return null;
            
            let defaultSpec = 'ACERO_150_RF';
            const material = (opciones.material || '').toUpperCase();
            if (material.includes('PPR')) defaultSpec = 'PPR_PN12_5';
            else if (material.includes('PE') || material.includes('HDPE')) defaultSpec = 'HDPE_PE100';
            else if (material.includes('PVC')) defaultSpec = 'PVC_SCH80';
            else if (material.includes('ACERO') || material.includes('CS') || material.includes('CARBONO')) defaultSpec = 'ACERO_150_RF';
            else if (material.includes('INOX') || material.includes('STAINLESS')) defaultSpec = 'SS_150_RF';
            
            let base = {
                tag, tipo, posX: x, posY: y, posZ: z,
                diametro: opciones.diametro || 1000,
                altura: opciones.altura || 1500,
                material: opciones.material || 'CS',
                spec: opciones.spec || defaultSpec,
                largo: opciones.largo || 1000,
                ancho: opciones.ancho || 1000
            };

            if (tipo === 'plataforma') {
                base.largo = opciones.largo || 6000;
                base.ancho = opciones.ancho || 3000;
                base.altura = opciones.altura || 400;
                base.baranda = opciones.baranda !== undefined ? opciones.baranda : false;
            }

            base.puertos = def.generarPuertos(base).map(p => ({
                ...p, spec: base.spec, status: 'open', diametro: p.diametro || 3
            }));
            return base;
        },
        
        createComponent: (compId, opciones = {}) => {
            const def = components[compId];
            if (!def) return null;
            return { ...def, ...opciones, id: compId };
        },

        createFitting: function(tipo, diam, spec, pos) {
            const generator = baseGenerators[tipo] || baseGenerators['TEE_EQUAL'];
            return {
                tag: `FIT-${Date.now().toString(36).slice(-4)}`,
                tipo: tipo,
                posX: pos.x, posY: pos.y, posZ: pos.z,
                isFitting: true,
                puertos: generator(null, 0, diam).map(p => ({ ...p, spec, status: 'open' }))
            };
        },

        getFittingForConnection: function(d_origen, d_destino, spec) {
            if (d_origen === d_destino) return { tipo: 'TEE_EQUAL', diam: d_origen };
            return { tipo: 'REDUCCION_CONCENTRICA', d_mayor: Math.max(d_origen, d_destino), d_menor: Math.min(d_origen, d_destino) };
        },

        getTransitionAccessories: (lineMaterial, componentMaterial, diameter) => {
            const from = (lineMaterial || '').toUpperCase().trim();
            const to   = (componentMaterial || '').toUpperCase().trim();
            if (!to || from === to) return null;
            const plasticFamilies = [
                ['PPR', 'PP', 'PPR', 'PP-EPDM', 'PP_EPDM'],
                ['PE', 'PE100', 'HDPE', 'PE_EPDM'],
                ['PVC', 'CPVC']
            ];
            const isPlasticCompatible = plasticFamilies.some(family => 
                family.some(m => from.includes(m)) && family.some(m => to.includes(m))
            );
            if (isPlasticCompatible) return null;
            const transitionMap = {
                'PPR->ACERO AL CARBONO': { left: 'ADAPTADOR_MACHO_PPR_3IN', right: 'UNION_CS_3000' },
                'ACERO AL CARBONO->PPR': { left: 'UNION_CS_3000', right: 'ADAPTADOR_HEMBRA_PPR_3IN' },
                'HDPE->ACERO AL CARBONO': { left: 'TRANSITION_HDPE_STEEL', right: null },
                'ACERO AL CARBONO->HDPE': { left: null, right: 'TRANSITION_HDPE_STEEL' },
                'PVC->ACERO AL CARBONO': { left: 'UNION_CS_3000', right: null },
                'ACERO AL CARBONO->PVC': { left: null, right: 'UNION_CS_3000' },
                'ACERO AL CARBONO->ACERO INOXIDABLE 316L': { left: 'UNION_CS_3000', right: null }
            };
            const key = `${from}->${to}`;
            if (transitionMap[key]) return transitionMap[key];
            const metalMaterials = ['ACERO', 'INOXIDABLE', 'INOX', 'CARBONO', 'CS', 'SS'];
            const fromIsMetal = metalMaterials.some(m => from.includes(m));
            const toIsMetal = metalMaterials.some(m => to.includes(m));
            if (fromIsMetal && toIsMetal) return { left: 'UNION_CS_3000', right: 'UNION_CS_3000' };
            return null;
        },
        
        createEquipmentMesh,
        createLineMesh
    };
})();
