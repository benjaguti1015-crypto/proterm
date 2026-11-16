# ProTerm: equipos de terreno

MVP para saber qué equipo está en qué furgón, quién lo tiene y cuándo vuelve.
Reemplaza la hoja de papel que cada equipo llena al salir a terreno y evita que
dos furgones reserven el mismo instrumento.

Next.js (App Router) + TypeScript + Tailwind, con Supabase (Postgres) y deploy en Vercel.

## Cómo se usa

1. Cada furgón tiene un QR fijo. Al escanearlo se abre `/f/furgon-N`, que deja elegido el furgón.
2. La persona entra con su nombre y un PIN numérico. Si el nombre no existe, se crea con ese PIN.
3. En el inicio elige el servicio, marca los equipos que se lleva, pone la fecha estimada de retorno y confirma la salida.
4. Al volver, entra a "Devolver equipos" y marca lo que devuelve. Puede ser parcial. Cuando devuelve todo, la salida se cierra.
5. `/panel` es público y muestra dónde está cada equipo. Se refresca solo cada 10 segundos.
6. `/equipos` permite actualizar las fechas de calibración. Por ahora es abierta: cualquiera
   puede verla y editarla, sin login. Un equipo con la calibración vencida no puede salir a terreno.

## Puesta en marcha

### 1. Base de datos (Supabase)

En el SQL Editor de Supabase, correr en este orden:

1. `supabase/migrations/0001_inicial.sql`: tablas, vistas, funciones y permisos.
2. `supabase/migrations/0002_calibracion.sql`: calibración de equipos.
3. `supabase/migrations/0003_certificados.sql`: certificado adjunto y bucket privado `certificados` en Storage.
4. `supabase/seed.sql`: datos de ejemplo.

La migración 0002 también agrega `usuarios.es_admin`. Hoy no se usa: queda lista para
restringir `/equipos` a administradores más adelante.

`seed.sql` borra todo y deja la demo en su estado inicial, así que se puede volver
a correr para reiniciar antes de grabar. No usarlo sobre datos reales.

### 2. Variables de entorno (Vercel)

En Vercel, Settings > Environment Variables:

| Variable | Valor |
| --- | --- |
| `SUPABASE_URL` | Project URL de Supabase, por ejemplo `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave `service_role` (o la secret key `sb_secret_...`). Es secreta. |
| `SESSION_SECRET` | Texto largo al azar. Se genera con `openssl rand -base64 32` |

Después de cargarlas hay que hacer un nuevo deploy para que tomen efecto.

### 3. Códigos QR

Con la URL final de la app:

```bash
BASE_URL=https://tu-app.vercel.app npm run qr
```

Genera `qr/furgon-1.png`, `qr/furgon-2.png`, `qr/furgon-3.png` y `qr/hoja-impresion.html`,
una hoja A4 con los tres QR lista para imprimir.

### Correr en el computador

```bash
cp .env.example .env.local
```

```bash
npm install
```

```bash
npm run dev
```

## Datos de ejemplo

- Furgones 1, 2 y 3.
- Servicios: Material particulado (isocinético) y Ruido (acústica).
- Usuarios Pedro y Juanito, ambos con PIN `1234`.
- Calibraciones: `PM-GAS-002` vencida hace 5 días, `RU-SON-002` vence en 12 días, el resto
  de los equipos de medición al día. Los accesorios no tienen fechas.
- Salidas abiertas, para que el conflicto se vea de inmediato:
  - Furgón 2, por Pedro: `PM-CON-001` y `PM-GAS-001`, vuelve mañana.
  - Furgón 3, por Juanito: `RU-SON-001` y `RU-CAL-001`, vuelve en 2 días.

## Cómo está hecho

- **Supabase solo desde el servidor.** Todas las consultas pasan por Server Actions
  y Route Handlers con la service role key. RLS está activado sin políticas, así
  que las claves públicas no pueden leer ni escribir nada.
- **Estado derivado.** Un equipo está "en uso" si tiene un ítem sin devolver en una
  salida abierta. Lo calcula la vista `equipos_estado`.
- **Sin doble reserva.** La función `crear_salida` guarda la salida y sus equipos en
  una sola transacción y revalida que nadie los haya reservado mientras tanto. Si hay
  conflicto devuelve cuáles son y no guarda nada. Un índice único impide además que un
  equipo quede pendiente en dos salidas a la vez.
- **Un furgón, una salida.** Un furgón con salida en curso tiene que devolver sus
  equipos antes de registrar otra.
- **Obligatorios por tipo.** Si el kit tiene dos sonómetros marcados como obligatorios,
  basta con llevar uno. Si falta un tipo obligatorio, la app avisa y pide confirmación.
- **Sesión.** Cookie firmada con el nombre del responsable. El PIN se guarda con hash
  (bcryptjs). No es seguridad real: solo identifica a quien registra.
- **Certificados.** Cada equipo guarda número de certificado, laboratorio y el PDF (hasta 4 MB)
  en el bucket privado `certificados`. `/certificados/[codigo]` lo abre con un enlace temporal
  de 10 minutos. Al reemplazar un PDF, el anterior queda guardado en Storage.
  En `docs/certificados-ejemplo/` hay certificados ficticios (marcados "sin validez") para
  RU-SON-001, RU-SON-002, RU-CAL-001, RU-CAL-002, PM-GAS-001, PM-GAS-002 y PM-PIT-001, con
  los mismos números y laboratorios del seed. Se suben desde `/equipos`.
- **Reemplazo sugerido.** Si una unidad está en uso o vencida, la app sugiere la siguiente del
  mismo tipo. Si el servidor rechaza la salida, marca el reemplazo automáticamente y avisa.
- **Selección de equipos.** Primero los obligatorios agrupados por tipo, con su avance
  ("2 de 2 listos"), después los recomendados del kit y al final la fecha de retorno.
- **Calibración.** `fecha_calibracion` es la última calibración y `fecha_vencimiento` hasta
  cuándo es válida (inclusive). Un equipo vencido aparece bloqueado al elegir equipos, y
  `crear_salida` lo rechaza también en la base de datos. Se avisa 30 días antes del vencimiento.

## Estructura

```
app/
  page.tsx                  Inicio: furgón actual, salida en curso o servicios
  f/[codigo]/route.ts       Destino del QR
  login/                    Nombre + PIN
  furgon/                   Cambiar de furgón
  salida/[servicioId]/      Selección de equipos
  devolver/                 Checklist de devolución
  panel/                    Tabla pública
  equipos/                  Calibraciones y certificados (abierta)
  certificados/[codigo]/    Abre el PDF del certificado
  api/panel/route.ts        Datos para el refresco del panel
components/                 Piezas de interfaz
lib/                        Supabase, sesión, consultas y acciones de servidor
supabase/                   Migración y seed
scripts/generar-qr.mjs      Generador de QR
```
