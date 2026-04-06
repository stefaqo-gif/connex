const express = require('express');
const router = express.Router();

module.exports = (db) => {

    // 🔐 GUARDAR O ROTAR CLAVE
    router.post('/guardar', (req, res) => {
        const { id_grupo, id_usuario, clave_cifrada } = req.body;

        if (!id_grupo || !id_usuario || !clave_cifrada) {
            return res.status(400).json({ error: "Datos incompletos" });
        }

        // Borramos la anterior para que solo exista una llave activa por usuario/grupo
        const sqlDelete = 'DELETE FROM claves_grupo WHERE id_grupo = ? AND id_usuario = ?';
        
        db.query(sqlDelete, [id_grupo, id_usuario], (err) => {
            if (err) return res.status(500).json({ error: "Error al limpiar llaves" });

            const sqlInsert = 'INSERT INTO claves_grupo (id_grupo, id_usuario, clave_cifrada) VALUES (?, ?, ?)';
            db.query(sqlInsert, [id_grupo, id_usuario, clave_cifrada], (error) => {
                if (error) return res.status(500).json({ error: "Error al insertar" });
                res.json({ status: "ok", message: "Clave rotada" });
            });
        });
    });

    // routes/clavesgrupo.js
    router.get('/obtener/:id_grupo/:id_usuario', (req, res) => {
        const { id_grupo, id_usuario } = req.params;
        
        // IMPORTANTE: ORDER BY id DESC LIMIT 1 asegura traer solo la última llave generada
        const sql = "SELECT id, clave_cifrada FROM claves_grupo WHERE id_grupo = ? AND id_usuario = ? ORDER BY id DESC LIMIT 1";
        
        db.query(sql, [id_grupo, id_usuario], (err, rows) => {
            if (err) return res.status(500).json(err);
            
            // Si no hay filas, el frontend debe saberlo para no intentar descifrar
            if (rows.length === 0) return res.json([]); 
            
            res.json(rows); 
        });
    });
};