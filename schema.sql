-- ============================================================
-- schema.sql  –  ConneX Database Schema (BD: connex)
-- Ejecutar: mysql -u root -p connex < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS connex
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE connex;

-- ============================================================
-- 1. PAISES
-- ============================================================
CREATE TABLE IF NOT EXISTS `paises` (
  `id_pais`     INT         NOT NULL AUTO_INCREMENT,
  `nombre`      VARCHAR(50) NOT NULL,
  `codigo_area` VARCHAR(5)  NOT NULL,
  PRIMARY KEY (`id_pais`),
  UNIQUE KEY `uq_codigo_area` (`codigo_area`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `paises` VALUES
  (1,'Costa Rica','+506'),(2,'México','+52'),
  (3,'España','+34'),(4,'Argentina','+54'),(5,'Estados Unidos','+1');

-- ============================================================
-- 2. USUARIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id_usuario`          INT          NOT NULL AUTO_INCREMENT,
  `id_pais`             INT          NOT NULL DEFAULT 1,
  `rol`                 ENUM('Admin','User') DEFAULT 'User',
  `telefono`            VARCHAR(15)  NOT NULL,
  `nombre_usuario`      VARCHAR(100) NOT NULL,
  `correo`              VARCHAR(100) NOT NULL,
  `foto_url`            TEXT         DEFAULT NULL,
  `info_estado`         VARCHAR(150) DEFAULT '¡Hola! Estoy usando ConneX.',
  `privacidad_foto`     ENUM('Todos','Contactos','Nadie') DEFAULT 'Todos',
  `notificar_seguridad` TINYINT(1)   DEFAULT '1',
  `descarga_auto`       ENUM('Wifi','Datos','Ambos','Nunca') DEFAULT 'Wifi',
  `fondo_pantalla`      VARCHAR(50)  DEFAULT 'default_bg.jpg',
  `tono_notificacion`   VARCHAR(50)  DEFAULT 'classic_ring.mp3',
  `esta_verificado`     TINYINT(1)   DEFAULT '0',
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `uq_telefono` (`telefono`),
  UNIQUE KEY `uq_correo`   (`correo`),
  CONSTRAINT `fk_usuario_pais`
    FOREIGN KEY (`id_pais`) REFERENCES `paises` (`id_pais`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `usuarios`
  (id_usuario,id_pais,rol,telefono,nombre_usuario,correo,info_estado)
VALUES
  (1,1,'Admin','88888888','carlos_admin','admin@connex.com','Modo Administrador'),
  (2,1,'User','77777777','maria_g','maria@mail.com','¡Hola! Estoy usando ConneX.'),
  (3,2,'User','5512345678','jose_mtz','jose@mail.com','Disponible'),
  (4,3,'User','612345678','ana_lopez','ana@mail.com','Solo emergencias'),
  (5,4,'User','1144445555','luis_h','luis@mail.com','Ocupado');

-- ============================================================
-- 3. MENSAJES (privados y grupales)
-- ============================================================
CREATE TABLE IF NOT EXISTS `mensajes` (
  `id_mensaje`          INT       NOT NULL AUTO_INCREMENT,
  `id_emisor`           INT       NOT NULL,
  `id_receptor_usuario` INT       DEFAULT NULL,
  `id_receptor_grupo`   INT       DEFAULT NULL,
  `contenido_texto`     TEXT      DEFAULT NULL,
  `tipo_multimedia`     ENUM('texto','imagen','video','audio','documento') DEFAULT 'texto',
  `archivo_url`         TEXT      DEFAULT NULL,
  `leido`               TINYINT(1) DEFAULT '0',
  `fecha_envio`         TIMESTAMP  NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_mensaje`),
  KEY `fk_mensaje_emisor`     (`id_emisor`),
  KEY `fk_mensaje_receptor_u` (`id_receptor_usuario`),
  CONSTRAINT `fk_mensaje_emisor`
    FOREIGN KEY (`id_emisor`) REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_mensaje_receptor_u`
    FOREIGN KEY (`id_receptor_usuario`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. GRUPOS
-- ============================================================
CREATE TABLE IF NOT EXISTS `grupos` (
  `id_grupo`          INT          NOT NULL AUTO_INCREMENT,
  `nombre_grupo`      VARCHAR(100) NOT NULL,
  `descripcion_grupo` VARCHAR(255) DEFAULT NULL,
  `foto_grupo_url`    TEXT         DEFAULT NULL,
  `id_creador`        INT          NOT NULL,
  `fecha_creacion`    TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_grupo`),
  CONSTRAINT `fk_grupo_creador`
    FOREIGN KEY (`id_creador`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. MIEMBROS_GRUPO
-- ============================================================
CREATE TABLE IF NOT EXISTS `miembros_grupo` (
  `id_miembro_grupo` INT        NOT NULL AUTO_INCREMENT,
  `id_grupo`         INT        NOT NULL,
  `id_usuario`       INT        NOT NULL,
  `es_admin_grupo`   TINYINT(1) DEFAULT '0',
  `fecha_union`      TIMESTAMP  NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_miembro_grupo`),
  CONSTRAINT `fk_miembro_grupo`
    FOREIGN KEY (`id_grupo`)   REFERENCES `grupos`   (`id_grupo`)   ON DELETE CASCADE,
  CONSTRAINT `fk_miembro_usuario`
    FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. ESTADOS (Stories)
-- ============================================================
CREATE TABLE IF NOT EXISTS `estados` (
  `id_estado`          INT          NOT NULL AUTO_INCREMENT,
  `id_usuario`         INT          NOT NULL,
  `archivo_url`        TEXT         NOT NULL DEFAULT '',
  `texto_estado`       VARCHAR(255) DEFAULT NULL,
  `fecha_publicacion`  TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  `es_activo`          TINYINT(1)   DEFAULT '1',
  PRIMARY KEY (`id_estado`),
  CONSTRAINT `fk_estado_usuario`
    FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. ESTADOS_VISTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS `estados_vistos` (
  `id_visto`          INT       NOT NULL AUTO_INCREMENT,
  `id_estado`         INT       NOT NULL,
  `id_usuario_lector` INT       NOT NULL,
  `fecha_visto`       TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_visto`),
  UNIQUE KEY `uq_vista` (`id_estado`, `id_usuario_lector`),
  CONSTRAINT `fk_visto_estado`
    FOREIGN KEY (`id_estado`)         REFERENCES `estados`  (`id_estado`)  ON DELETE CASCADE,
  CONSTRAINT `fk_visto_lector`
    FOREIGN KEY (`id_usuario_lector`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. ESTADOS_SILENCIADOS
-- ============================================================
CREATE TABLE IF NOT EXISTS `estados_silenciados` (
  `id_silencio`            INT NOT NULL AUTO_INCREMENT,
  `id_usuario`             INT NOT NULL,
  `id_contacto_silenciado` INT NOT NULL,
  PRIMARY KEY (`id_silencio`),
  UNIQUE KEY `uq_silencio` (`id_usuario`, `id_contacto_silenciado`),
  CONSTRAINT `fk_silencio_usuario`
    FOREIGN KEY (`id_usuario`)            REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE,
  CONSTRAINT `fk_silencio_contacto`
    FOREIGN KEY (`id_contacto_silenciado`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9. CONTACTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS `contactos` (
  `id_contacto`           INT          NOT NULL AUTO_INCREMENT,
  `id_usuario_dueno`      INT          NOT NULL,
  `id_usuario_agregado`   INT          NOT NULL,
  `nombre_servidor_local` VARCHAR(100) DEFAULT NULL,
  `fecha_agregado`        TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_contacto`),
  CONSTRAINT `fk_contacto_dueno`
    FOREIGN KEY (`id_usuario_dueno`)    REFERENCES `usuarios` (`id_usuario`),
  CONSTRAINT `fk_contacto_agregado`
    FOREIGN KEY (`id_usuario_agregado`) REFERENCES `usuarios` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 10. BLOQUEOS
-- ============================================================
CREATE TABLE IF NOT EXISTS `bloqueos` (
  `id_bloqueo`            INT       NOT NULL AUTO_INCREMENT,
  `id_usuario_bloqueador` INT       NOT NULL,
  `id_usuario_bloqueado`  INT       NOT NULL,
  `fecha_bloqueo`         TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_bloqueo`),
  UNIQUE KEY `uq_bloqueo` (`id_usuario_bloqueador`, `id_usuario_bloqueado`),
  CONSTRAINT `fk_bloqueador`
    FOREIGN KEY (`id_usuario_bloqueador`) REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE,
  CONSTRAINT `fk_bloqueado`
    FOREIGN KEY (`id_usuario_bloqueado`)  REFERENCES `usuarios` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- FIN DEL SCRIPT  |  ConneX © 2026
-- ============================================================
