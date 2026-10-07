# test-simple-stock-flow-app

> **Prueba técnica · Ficha ADSO 3413974**  
> Frontend en React (TypeScript + Vite) implementado bajo Arquitectura Onion.

---

### 1. Qué es esto
Es la interfaz web de usuario de *Simple Stock Flow*. Permite al personal del almacén (administradores y vendedores) explorar el catálogo con filtrado sin distinción de mayúsculas ni acentos, gestionar el carrito de compra en memoria, realizar ventas con descuento atómico y consultar reportes y ventas históricas. **No se ocupa** de reglas de persistencia ni del cálculo directo de base de datos.

### 2. Cómo se levanta
El frontend se sirve compilado dentro de un contenedor Nginx con proxy inverso hacia la API. Desde la carpeta hermana `test-simple-stock-flow-infra`:
```bash
docker compose up -d app
```
La aplicación web estará disponible de inmediato en `http://localhost:8080`.

Para desarrollo local directo con Node:
```bash
npm install
npm run dev
```

### 3. Dónde están los datos
La aplicación React es un cliente HTTP sin estado propio de base de datos. Consume todos sus datos a través de la API REST (`http://localhost:8000` o `/api` mediante el proxy inverso Nginx).

### 4. Cómo se prueba
Para compilar y verificar tipos de TypeScript:
```bash
npm run build
```

### 5. Qué falta
Toda la interacción descrita en las historias de usuario HU-01 a HU-08 para vendedores y administradores está completamente desarrollada y conectada al contrato de la API.