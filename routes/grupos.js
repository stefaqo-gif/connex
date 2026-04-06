const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // Obtener grupos de un usuario específico
    router.get('/usuario/:id', (req, res) => {
        const userId = req.params.id;
        
        // Nombres corregidos según tu captura de MySQL Workbench
        const sql = `
            SELECT 
                g.id_grupo, 
                g.nombre_grupo, 
                g.descripcion_grupo, 
                g.foto_grupo_url
            FROM grupos g
            JOIN miembros_grupo mg ON g.id_grupo = mg.id_grupo
            WHERE mg.id_usuario = ?
        `;

        db.query(sql, [userId], (err, results) => {
            if (err) {
                console.error("❌ Error SQL al obtener grupos:", err);
                return res.status(500).json({ error: "Error en la base de datos" });
            }
            res.json(results);
        });
    });

    // Crear un nuevo grupo
    router.post('/crear', (req, res) => {
        const { nombre, descripcion, id_creador, foto_url, participantes } = req.body;
        
        // 1. Validar datos mínimos
        if (!nombre || !id_creador) {
            return res.status(400).json({ success: false, message: "Nombre e id_creador son obligatorios" });
        }

        const sqlGrupo = "INSERT INTO grupos (nombre_grupo, descripcion_grupo, foto_grupo_url, id_creador) VALUES (?, ?, ?, ?)";
        
        db.query(sqlGrupo, [nombre, descripcion || '', foto_url || null, id_creador], (err, result) => {
            if (err) {
                console.error("❌ ERROR DB GRUPOS:", err);
                return res.status(500).json({ success: false, message: "Error al crear el grupo en la base de datos" });
            }

            const nuevoGrupoId = result.insertId;

            // 2. Insertar a TODOS los participantes (incluyendo al creador)
            // Convertimos participantes a un array si no lo es y añadimos al creador si no está
            let todosLosMiembros = Array.isArray(participantes) ? participantes : [];
            if (!todosLosMiembros.includes(id_creador)) {
                todosLosMiembros.push(id_creador);
            }

            // Creamos una consulta múltiple para insertar a todos de un golpe
            const valoresMiembros = todosLosMiembros.map(id => [nuevoGrupoId, id, id == id_creador ? 1 : 0]);
            const sqlMiembros = "INSERT INTO miembros_grupo (id_grupo, id_usuario, es_admin_grupo) VALUES ?";
            
            db.query(sqlMiembros, [valoresMiembros], (err2) => {
                if (err2) {
                    console.error("❌ ERROR DB MIEMBROS:", err2);
                    return res.status(500).json({ success: false, message: "Grupo creado, pero falló al añadir miembros" });
                }
                res.json({ success: true, id_grupo: nuevoGrupoId });
            });
        });
    });

        // Obtener información básica de un grupo específico
    router.get('/info/:id', (req, res) => {
        const { id } = req.params;
        const sql = "SELECT id_grupo, nombre_grupo, descripcion_grupo, foto_grupo_url FROM grupos WHERE id_grupo = ?";
        
        db.query(sql, [id], (err, result) => {
            if (err) return res.status(500).json({ success: false, error: err });
            if (result.length === 0) return res.status(404).json({ success: false, message: "Grupo no encontrado" });
            res.json(result[0]);
        });
    });

    return router;
};