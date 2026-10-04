/**
 * Stub Prisma types agar `import ... from "@prisma/client"` tetap
 * resolve ke TS types. Sebenarnya `index.d.ts` ada di folder yang sama,
 * tapi `default.d.ts` hilang setelah pnpm install — pakai pendekatan
 * `export *` ke path eksplisit.
 */
declare module "@prisma/client";
