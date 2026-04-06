# ConneX – Guía de Instalación y Despliegue

---

## 📋 Requisitos previos

| Herramienta | Versión mínima |
|-------------|----------------|
| Node.js     | 16.x o superior |
| MySQL       | 5.7 o superior  |
| npm         | 8.x o superior  |

---

## 🔑 Sin sistema de login

ConneX no requiere contraseña. Al abrir la app, se muestra una lista con todos los usuarios registrados en la BD. El usuario simplemente hace clic en su nombre para entrar. Puede cambiar de usuario en cualquier momento usando el botón **Cambiar usuario** (→) en la barra lateral.

---

## 🖥️ Ejecución LOCAL (desarrollo)

### 1. Preparar base de datos MySQL

```sql
CREATE DATABASE connex CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Luego importar el esquema:

```bash
mysql -u root -p connex < schema.sql
```

> El `schema.sql` incluido crea todas las tablas (`usuarios`, `mensajes`, `estados`, etc.) e inserta 5 usuarios de prueba.

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env`:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=connex
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Iniciar servidor

```bash
# Desarrollo (auto-reload)
npm run dev

# Producción
npm start
```

### 5. Abrir en navegador

```
http://localhost:3000
```

Verás la pantalla de selección con los 5 usuarios de prueba:
`carlos_admin`, `maria_g`, `jose_mtz`, `ana_lopez`, `luis_h`

---

## ☁️ Despliegue en PLESK

### Paso 1 – Crear aplicación Node.js en Plesk

1. **Plesk Panel → Dominios → tu-dominio.com**
2. Clic en **"Node.js"** → **"Enable Node.js"**
3. Configura:
   - **Node.js version**: 18.x (LTS)
   - **Application mode**: Production
   - **Application root**: `/httpdocs`
   - **Application startup file**: `server.js`

### Paso 2 – Subir archivos

Sube todos los archivos **excepto** `node_modules/` y `.env`

### Paso 3 – Instalar dependencias desde Plesk

En la sección **Node.js** → **"NPM Install"**

### Paso 4 – Crear base de datos MySQL en Plesk

1. **Plesk → Databases → Add Database** → nombre: `connex`
2. Crea un usuario de BD
3. **phpMyAdmin** → selecciona `connex` → pestaña **SQL** → pega `schema.sql`

### Paso 5 – Variables de entorno

En **Node.js → Environment Variables**:

```
DB_HOST     = localhost
DB_USER     = connex_user
DB_PASSWORD = tu_password_seguro
DB_NAME     = connex
```

### Paso 6 – Reiniciar

**Node.js → Stop → Start**

### Paso 7 – WebSockets (si Socket.IO no conecta)

En **Apache & nginx Settings → Additional nginx directives**:

```nginx
location /socket.io/ {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

---

## 🌐 Flujo de mensajes (Socket.IO)

```
CLIENTE A                    SERVIDOR                    CLIENTE B
   │                            │                            │
   │── selecciona usuario ──────►│                            │
   │── socket.connect() ────────►│                            │
   │── register_user(userId) ───►│ onlineUsers.set(id,socket) │
   │                            │──── user_online(userId) ──►│
   │                            │                            │
   │── send_message ────────────►│                            │
   │   { senderId,              │ 1. mensajes → BD           │
   │     receiverId,            │ 2. Si B online:            │
   │     content }              │────── receive_message ─────►│
   │                            │ 3. markDelivered()         │
   │◄── message_delivered ──────│                            │
   │  (✔✔ gris)                 │                            │
   │                            │◄── message_seen(viewerId) ─│
   │◄── messages_seen(by:B) ────│                            │
   │  (✔✔ azul)                 │                            │
```

---

## 📁 Estructura del proyecto

```
connexandra/
├── server.js              ← Punto de entrada
├── db.js                  ← Pool MySQL
├── schema.sql             ← Esquema BD (tabla usuarios + más)
├── package.json
├── .env.example
│
├── models/
│   ├── User.js            ← CRUD tabla usuarios
│   ├── Message.js         ← CRUD tabla mensajes
│   └── Story.js           ← CRUD tablas estados / estados_vistos / estados_silenciados
│
├── controllers/
│   ├── authController.js  ← login por userId (sin contraseña)
│   ├── messageController.js
│   ├── storyController.js
│   └── adminController.js
│
├── routes/
│   ├── auth.js
│   ├── messages.js
│   ├── stories.js
│   └── admin.js
│
├── sockets/
│   └── socketHandler.js   ← Lógica Socket.IO
│
└── public/
    ├── index.html         ← Selector de usuario (sin formulario de login)
    ├── css/style.css
    └── js/app.js
```

---

## 🐛 Solución de problemas

| Problema | Solución |
|----------|----------|
| `ER_ACCESS_DENIED_ERROR` | Verificar usuario/contraseña en `.env` |
| Lista de usuarios vacía | Verificar que `schema.sql` fue importado |
| Socket.IO no conecta en Plesk | Agregar directiva nginx de WebSockets |
| Puerto ocupado | Cambiar `PORT` en `.env` |
| `Cannot find module` | Ejecutar `npm install` |

---

## 🚀 Comandos útiles

```bash
npm install          # Instalar dependencias
npm run dev          # Desarrollo con auto-reload
npm start            # Producción
mysql -u root -p connex < schema.sql   # Importar esquema
```

---

*ConneX © 2026*
