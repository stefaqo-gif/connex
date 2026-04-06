const express = require('express');
const router = express.Router();

module.exports = (db) => {
    // Esta es la ruta que el frontend llamará con fetch('/contactos/14')
    router.get('/:id', (req, res) => {
        const userId = req.params.id;

        // Consulta para obtener los contactos del usuario
        // Nota: Asegúrate de que los nombres de las columnas coincidan con tu DB
        const sql = `
            SELECT u.id_usuario, u.nombre_usuario, u.foto_url 
            FROM usuarios u 
            WHERE u.id_usuario != ?
        `;

        db.query(sql, [userId], (err, results) => {
            if (err) {
                console.error("❌ Error en DB contactos:", err);
                return res.status(500).json({ error: "Error al obtener contactos" });
            }
            res.json(results);
        });
    });

    return router;
};