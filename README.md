# test-simple-stock-flow-app

> **Prueba tÃ©cnica Â· Ficha ADSO 3413974**  
> Frontend en React (TypeScript + Vite) implementado bajo Arquitectura Onion.

---

### 1. QuÃ© es esto
Es la interfaz web de usuario de *Simple Stock Flow*. Permite al personal del almacÃ©n (administradores y vendedores) explorar el catÃ¡logo con filtrado sin distinciÃ³n de mayÃºsculas ni acentos, gestionar el carrito de compra en memoria, realizar ventas con descuento atÃ³mico y consultar reportes y ventas histÃ³ricas. **No se ocupa** de reglas de persistencia ni del cÃ¡lculo directo de base de datos.

### 2. CÃ³mo se levanta
El frontend se sirve compilado dentro de un contenedor Nginx con proxy inverso hacia la API. Desde la carpeta hermana `test-simple-stock-flow-infra`:
```bash
docker compose up -d app
```
La aplicaciÃ³n web estarÃ¡ disponible de inmediato en `http://localhost:8080`.

Para desarrollo local directo con Node:
```bash
npm install
npm run dev
```

### 3. DÃ³nde estÃ¡n los datos
La aplicaciÃ³n React es un cliente HTTP sin estado propio de base de datos. Consume todos sus datos a travÃ©s de la API REST (`http://localhost:8000` o `/api` mediante el proxy inverso Nginx).

### 4. CÃ³mo se prueba
Para compilar y verificar tipos de TypeScript:
```bash
npm run build
```

### 5. QuÃ© falta
Toda la interacciÃ³n descrita en las historias de usuario HU-01 a HU-08 para vendedores y administradores estÃ¡ completamente desarrollada y conectada al contrato de la API.