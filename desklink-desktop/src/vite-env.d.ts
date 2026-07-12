/// <reference types="vite/client" />

import type { DeskLinkApi } from '@/types';

declare global {
  interface Window {
    desklink?: DeskLinkApi;
  }
}

export {};
