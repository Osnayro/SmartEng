/**
 * SMARTFLOW ADAPTER v1.0
 * Bridge entre Core v4.5 (2D) y Core v6.5 (3D)
 */
const SmartFlowAdapter = {
    // Convierte cualquier formato al estándar que entiende el motor 3D
    ensure3DReady: function(input) {
        const db = input.data || input; // Maneja si viene envuelto en {data: ...}
        
        if (db.equipos) {
            db.equipos.forEach(eq => {
                // Si tiene posX/Y/Z (2D) pero no pos (3D)
                if (eq.posX !== undefined && !eq.pos) {
                    eq.pos = { x: eq.posX, y: eq.posY, z: eq.posZ };
                }
            });
        }
        
        if (db.lines) {
            db.lines.forEach(line => {
                // Asegura que el motor 3D encuentre el array de puntos
                if (!line.points) {
                    line.points = line.points3D || line._cachedPoints || [];
                }
            });
        }
        return db;
    },

    // Convierte cualquier formato al estándar que entiende el motor 2D
    ensure2DReady: function(input) {
        const db = input.data || input;
        
        if (db.equipos) {
            db.equipos.forEach(eq => {
                // Si tiene pos (3D) pero no posX/Y/Z (2D)
                if (eq.pos && eq.posX === undefined) {
                    eq.posX = eq.pos.x;
                    eq.posY = eq.pos.y;
                    eq.posZ = eq.pos.z;
                }
            });
        }
        
        if (db.lines) {
            db.lines.forEach(line => {
                // Asegura que el motor 2D encuentre points3D
                if (!line.points3D) {
                    line.points3D = line.points || line._cachedPoints || [];
                }
            });
        }
        return db;
    }
};
