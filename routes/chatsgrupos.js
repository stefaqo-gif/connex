const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // ==========================================
    // 🔐 GESTIÓN DE LLAVES DE CIFRADO
    // ==========================================

    // Obtener la llave más reciente para un usuario en un grupo
    router.get('/obtener/:id_grupo/:id_usuario', (req, res) => {
        const { id_grupo, id_usuario } = req.params;

        const sql = `SELECT clave_cifrada FROM claves_grupo 
                    WHERE id_grupo = ? AND id_usuario = ? 
                    ORDER BY id DESC LIMIT 1`;

        db.query(sql, [id_grupo, id_usuario], (error, rows) => {
            if (error) return res.status(500).json({ error: "Error DB" });
            if (rows.length === 0) return res.status(404).json({ error: "No hay clave" });

            res.json({ clave_maestra_encriptada: rows[0].clave_cifrada });
        });
    });

    // Guardar o actualizar clave de grupo
    router.post('/guardar', (req, res) => {
        const { id_grupo, id_usuario, clave_cifrada } = req.body;
        const sql = `INSERT INTO claves_grupo (id_grupo, id_usuario, clave_cifrada)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE clave_cifrada = VALUES(clave_cifrada)`;

        db.query(sql, [id_grupo, id_usuario, clave_cifrada], (error) => {
            if (error) {
                console.error("❌ Error al guardar clave:", error);
                return res.status(500).json({ error: "Error guardando clave" });
            }
            res.json({ status: "ok" });
        });
    });

    // ==========================================
    // 💬 GESTIÓN DE MENSAJES
    // ==========================================

    // Obtener mensajes del grupo
    router.get('/mensajes/:id_grupo', (req, res) => {
        const { id_grupo } = req.params;
        const sql = `
            SELECT m.*, u.nombre_usuario 
            FROM mensajes m 
            JOIN usuarios u ON m.id_emisor = u.id_usuario 
            WHERE m.id_receptor_grupo = ? 
            ORDER BY m.fecha_envio ASC`;

        db.query(sql, [id_grupo], (error, results) => {
            if (error) {
                console.error("❌ Error al cargar mensajes:", error);
                return res.status(500).json({ error: "Error al cargar mensajes" });
            }
            res.json(results || []);
        });
    });

    // Enviar un mensaje (Texto o Multimedia cifrado)
    router.post('/enviar', (req, res) => {
        const { id_grupo, id_usuario, contenido, tipo } = req.body;
        
        const sql = `INSERT INTO mensajes 
                    (id_emisor, id_receptor_grupo, contenido_texto, tipo_multimedia) 
                    VALUES (?, ?, ?, ?)`;
        
        db.query(sql, [id_usuario, id_grupo, contenido, tipo], (error) => {
            if (error) {
                console.error("❌ Error al enviar:", error);
                return res.status(500).json({ error: "Error al guardar en BD" });
            }
            res.json({ success: true });
        });
    });

    // ==========================================
    // ℹ️ INFORMACIÓN Y CONFIGURACIÓN DEL GRUPO
    // ==========================================

    // Obtener información básica del grupo (Sidebar)
    router.get('/info/:idGrupo', (req, res) => {
        const { idGrupo } = req.params;
        const sql = `
            SELECT nombre_grupo, descripcion_grupo, reglas_grupo, foto_grupo_url 
            FROM grupos 
            WHERE id_grupo = ?`;
        
        db.query(sql, [idGrupo], (err, result) => {
            if (err) return res.status(500).json({ error: "Error al obtener info del grupo" });
            if (result.length === 0) return res.status(404).json({ error: "Grupo no encontrado" });
            res.json(result[0]);
        });
    });

    // Verificar el rol del usuario actual en el grupo
    router.get('/mi-rol/:id_grupo/:id_usuario', (req, res) => {
        const { id_grupo, id_usuario } = req.params;
        const sql = "SELECT es_admin_grupo FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?";
        
        db.query(sql, [id_grupo, id_usuario], (err, result) => {
            if (err) return res.status(500).json({ error: "Error DB" });
            res.json(result[0] || { es_admin_grupo: 0 });
        });
    });

    // Actualizar información del grupo (Solo Admin)
    router.put('/actualizar-info/:idGrupo', (req, res) => {
        const { idGrupo } = req.params;
        const { nombre, descripcion, reglas, foto, id_usuario } = req.body;

        const sqlCheck = "SELECT es_admin_grupo FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?";
        
        db.query(sqlCheck, [idGrupo, id_usuario], (err, row) => {
            if (err) return res.status(500).json({ error: "Error de validación" });
            
            if (row.length > 0 && row[0].es_admin_grupo === 1) {
                const sqlUpdate = `
                    UPDATE grupos 
                    SET nombre_grupo = ?, descripcion_grupo = ?, reglas_grupo = ?, foto_grupo_url = ? 
                    WHERE id_grupo = ?`;

                db.query(sqlUpdate, [nombre, descripcion, reglas, foto, idGrupo], (err) => {
                    if (err) return res.status(500).json({ error: "Error al actualizar la base de datos" });
                    res.json({ success: true });
                });
            } else {
                res.status(403).json({ error: "No tienes permiso para editar este grupo" });
            }
        });
    });

    // ==========================================
    // 👥 GESTIÓN DE INTEGRANTES
    // ==========================================

    // Obtener lista completa de integrantes
    router.get('/integrantes/:idGrupo', (req, res) => {
        const { idGrupo } = req.params;
        const sql = `
            SELECT u.id_usuario, u.nombre_usuario, m.es_admin_grupo 
            FROM miembros_grupo m
            JOIN usuarios u ON m.id_usuario = u.id_usuario
            WHERE m.id_grupo = ?
            ORDER BY m.es_admin_grupo DESC, u.nombre_usuario ASC`;

        db.query(sql, [idGrupo], (err, results) => {
            if (err) return res.status(500).json({ error: "Error al obtener integrantes" });
            res.json(results);
        });
    });

    // Cambiar rol de un miembro (Hacer admin o quitar admin)
    router.put('/cambiar-rol/:idGrupo/:idUsuarioDestino', (req, res) => {
        const { idGrupo, idUsuarioDestino } = req.params;
        const { nuevo_rol, id_admin_que_pide } = req.body;

        const sqlCheck = "SELECT es_admin_grupo FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?";
        db.query(sqlCheck, [idGrupo, id_admin_que_pide], (err, row) => {
            if (err) return res.status(500).json({ error: "Error DB" });

            if (row.length > 0 && row[0].es_admin_grupo === 1) {
                const sqlUpdate = "UPDATE miembros_grupo SET es_admin_grupo = ? WHERE id_grupo = ? AND id_usuario = ?";
                db.query(sqlUpdate, [nuevo_rol, idGrupo, idUsuarioDestino], (err) => {
                    if (err) return res.status(500).json({ error: "Error al cambiar rol" });
                    res.json({ success: true });
                });
            } else {
                res.status(403).json({ error: "Permiso denegado" });
            }
        });
    });

    // Expulsar miembro del grupo
    router.delete('/eliminar-participante/:idGrupo/:idUsuarioEliminar/:idAdminQuePide', (req, res) => {
        const { idGrupo, idUsuarioEliminar, idAdminQuePide } = req.params;

        const sqlCheck = "SELECT es_admin_grupo FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?";
        db.query(sqlCheck, [idGrupo, idAdminQuePide], (err, row) => {
            if (err) return res.status(500).json({ error: "Error DB" });

            if (row.length > 0 && row[0].es_admin_grupo === 1) {
                const sqlDelete = "DELETE FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?";
                db.query(sqlDelete, [idGrupo, idUsuarioEliminar], (err) => {
                    if (err) return res.status(500).json({ error: "Error al eliminar integrante" });
                    res.json({ success: true });
                });
            } else {
                res.status(403).json({ error: "No tienes permisos de administrador" });
            }
        });
    });

        // --- BUSCAR USUARIOS DISPONIBLES (Para agregar al grupo) ---
    router.get('/buscar-candidatos/:idGrupo', (req, res) => {
        const { idGrupo } = req.params;
        // Buscamos usuarios que NO formen parte de este grupo ya
        const sql = `
            SELECT id_usuario, nombre_usuario, foto_perfil_url 
            FROM usuarios 
            WHERE id_usuario NOT IN (
                SELECT id_usuario FROM miembros_grupo WHERE id_grupo = ?
            ) LIMIT 10`;

        db.query(sql, [idGrupo], (err, results) => {
            if (err) return res.status(500).json({ error: "Error al buscar candidatos" });
            res.json(results);
        });
    });

    // --- AGREGAR NUEVO PARTICIPANTE ---
    router.post('/agregar-participante', (req, res) => {
        const { id_grupo, id_usuario_nuevo, id_admin_que_pide } = req.body;

        // 1. Validar que quien pide sea admin
        const sqlCheck = "SELECT es_admin_grupo FROM miembros_grupo WHERE id_grupo = ? AND id_usuario = ?";
        db.query(sqlCheck, [id_grupo, id_admin_que_pide], (err, row) => {
            if (err || row.length === 0 || row[0].es_admin_grupo !== 1) {
                return res.status(403).json({ error: "No tienes permisos" });
            }

            // 2. Insertar al nuevo miembro (por defecto es_admin_grupo = 0)
            const sqlInsert = "INSERT INTO miembros_grupo (id_grupo, id_usuario, es_admin_grupo) VALUES (?, ?, 0)";
            db.query(sqlInsert, [id_grupo, id_usuario_nuevo], (err) => {
                if (err) return res.status(500).json({ error: "Error al agregar integrante" });
                res.json({ success: true });
            });
        });
    });

    // IMPORTANTE: Retornar el router al final de la función
    return router;
};