const express = require('express');
const router = express.Router();

module.exports = (db) => {
    // POST: Guardar o actualizar la llave pública
    router.post('/guardar-llave', (req, res) => {
        const { id_usuario, llave_publica } = req.body;
        if (!id_usuario) return res.status(400).json({ status: "error", message: "ID requerido" });

        const sql = `
            INSERT INTO llaves_cifrado (id_usuario, llave_publica, algoritmo) 
            VALUES (?, ?, 'RSA-2048') 
            ON DUPLICATE KEY UPDATE 
                llave_publica = VALUES(llave_publica), 
                fecha_generacion = CURRENT_TIMESTAMP
        `;
        
        db.query(sql, [id_usuario, llave_publica], (error) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ status: "error", message: "Error en DB" });
            }
            res.json({ status: "ok", message: "Llave sincronizada" });
        });
    });

    // GET: Obtener llave de un receptor
    router.get('/obtener-llave/:id', (req, res) => {
        const sql = "SELECT llave_publica FROM llaves_cifrado WHERE id_usuario = ?";
        db.query(sql, [req.params.id], (err, rows) => {
            if (err || rows.length === 0) return res.status(404).json({ error: "No encontrada" });
            // El frontend espera la propiedad 'llave'
            res.json({ llave: rows[0].llave_publica });
        });
    });

    

    return router;

    
};