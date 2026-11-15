/// <reference types="astro/client" />
declare namespace App {
  interface Locals {
    admin: import('./cms/auth').AdminSession | null;
    form?: FormData;
    preview: boolean;
  }
}
