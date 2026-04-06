const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // Obtener lista de contactos del usuario
    router.get('/:userId', (req, res) => {
        const { userId } = req.params;
        const sql = `
            SELECT u.id_usuario, u.nombre_usuario, u.telefono, u.foto_url, u.info_estado, c.nombre_servidor_local
            FROM contactos c
            JOIN usuarios u ON u.id_usuario = c.id_usuario_agregado
            WHERE c.id_usuario_dueno = ?
            ORDER BY u.nombre_usuario ASC`;
        
        db.query(sql, [userId], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
        });
    });

    return router;
};