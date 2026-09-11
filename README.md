# DroneControl

Aplicación independiente de control de envíos por dron: despacho de misiones,
mapa en vivo con telemetría, y planificación de rutas. La v1 vuela sobre una
**flota simulada** (sin hardware real) detrás de una interfaz de adaptador,
para poder conectar drones DJI reales más adelante sin rehacer el sistema.

## Quickstart (desarrollo local)

```bash
# 1. Base de datos local (Postgres en Docker)
docker compose up -d db

# 2. Backend
cp .env.example .env          # ajustar DB_PORT=5433 si usas el docker-compose de este repo
npm install
npm run db:init -- --seed     # crea las tablas + un dron y una misión de demo
npm run create-user -- admin@dronecontrol.local pass123 "Admin" admin
npm run dev                   # http://localhost:3000

# 3. Frontend (en otra terminal)
cd client
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

Iniciar sesión con `admin@dronecontrol.local` / `pass123` (o el usuario que hayas creado).

## Variables de entorno

Ver [.env.example](.env.example) (backend) y [client/.env.example](client/.env.example) (frontend).

| Variable | Uso |
|---|---|
| `DB_HOST/DB_USER/DB_PASSWORD/DB_NAME/DB_PORT/DB_SSL` | Conexión Postgres |
| `JWT_SECRET/JWT_EXPIRES_IN` | Firma de sesión |
| `DRONE_ADAPTER` | `simulated` hoy; `dji` cuando haya hardware real |
| `SIM_TICK_MS/SIM_DEFAULT_SPEED_MPS/SIM_BATTERY_DRAIN_PCT_PER_MIN` | Parámetros de la simulación de vuelo |
| `VITE_API_BASE_URL` | Vacío = rutas relativas (funciona en dev vía proxy de Vite y en producción same-origin) |

## Estado de las fases

- [x] Fase 1 — scaffold, auth JWT, esquema de base de datos
- [x] Fase 2 — adaptador simulado, mapa en vivo con telemetría SSE (checkpoint)
- [x] Fase 3 — despacho de misiones de punta a punta
- [x] Fase 4 — planificador visual de rutas (waypoints en el mapa)

## Integración de hardware real (futuro, no implementado)

Decisión tomada: se integra hardware **DJI** cuando esté disponible físicamente.

Cuando llegue ese momento, se agrega `services/adapters/DjiAdapter.js`
implementando la misma interfaz que `services/adapters/DroneAdapter.js`, y se
activa con `DRONE_ADAPTER=dji` — sin tocar rutas, base de datos ni frontend.

Hardware/SDK concreto a integrar:

- **DJI Cloud API**: el SDK pensado exactamente para este patrón — una
  plataforma web de terceros que despacha misiones y recibe telemetría/video
  de una flota DJI de forma remota. Es lo que traduciría `DjiAdapter.js`.
- **DJI Dock / Dock 2**: la estación que permite operar sin piloto presente
  (despegue, misión, aterrizaje y recarga automáticos). Sin esto, cualquier
  dron DJI necesita a alguien físicamente ahí con el control.
- **DJI FlyCart 30**: el dron de carga de DJI pensado para reparto/logística.
