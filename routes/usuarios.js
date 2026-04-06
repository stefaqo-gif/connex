const express = require('express');
const router = express.Router();

// Exportamos la función que recibe la conexión 'db' desde app.js
module.exports = (db) => {

    // 👤 Obtener datos de usuario para los Ajustes
    router.get('/:id', (req, res) => {
        const { id } = req.params;
        const sql = "SELECT id_usuario, nombre_usuario, telefono, correo, foto_url, info_estado, privacidad_foto, descarga_auto FROM usuarios WHERE id_usuario = ?";
        
        db.query(sql, [id], (err, results) => {
            if (err) {
                console.error("❌ Error en GET /usuario/:id:", err);
                return res.status(500).json({ error: 'Error en el servidor' });
            }
            if (results.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
            res.json(results[0]);
        });
    });

    // 🔒 Actualizar privacidad desde Ajustes
    router.post('/actualizar-privacidad', (req, res) => {
        const { userId, privacidadFoto } = req.body;
        const sql = "UPDATE usuarios SET privacidad_foto = ? WHERE id_usuario = ?";
        
        db.query(sql, [privacidadFoto, userId], (err) => {
            if (err) {
                console.error("❌ Error en /actualizar-privacidad:", err);
                return res.status(500).json({ error: 'Error al actualizar' });
            }
            res.json({ mensaje: 'Actualizado correctamente' });
        });
    });

    // 📥 Actualizar descarga automática
    router.post('/actualizar-descarga', (req, res) => {
        const { userId, descargaAuto } = req.body;
        const sql = "UPDATE usuarios SET descarga_auto = ? WHERE id_usuario = ?";
        
        db.query(sql, [descargaAuto, userId], (err) => {
            if (err) {
                console.error("❌ Error en /actualizar-descarga:", err);
                return res.status(500).json({ error: 'Error al actualizar' });
            }
            res.json({ mensaje: 'Actualizado correctamente' });
        });
    });

    // 💬 Obtener chats para la pantalla principal
    router.get('/chats/:userId', (req, res) => {
        const { userId } = req.params;
        const sql = `
            SELECT u.id_usuario, u.nombre_usuario, u.foto_url, u.info_estado, 
                   m.contenido_texto as ultimo_mensaje, m.fecha_envio
            FROM contactos c
            JOIN usuarios u ON u.id_usuario = c.id_usuario_agregado
            LEFT JOIN mensajes m ON (m.id_emisor = u.id_usuario AND m.id_receptor_usuario = ?)
            OR (m.id_emisor = ? AND m.id_receptor_usuario = u.id_usuario)
            WHERE c.id_usuario_dueno = ?
            GROUP BY u.id_usuario 
            ORDER BY m.fecha_envio DESC 
            LIMIT 20`;
        
        db.query(sql, [userId, userId, userId], (err, results) => {
            if (err) {
                console.error("❌ Error en GET /chats/:userId:", err);
                return res.status(500).json({ error: 'Error en el servidor' });
            }
            res.json(results);
        });
    });

    return router; // Retornamos el router configurado
};