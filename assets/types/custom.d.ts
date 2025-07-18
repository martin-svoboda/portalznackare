declare module '@babel/runtime/*';

// Rozšíření globálního Window objektu o kct_portal
declare global {
  interface Window {
    kct_portal?: {
      rest_namespace: string;
      nonce: string;
      menu?: Array<{
        title: string;
        url: string;
      }>;
      bloginfo?: {
        name: string;
      };
      is_admin?: boolean;
      settings?: {
        login_image?: string;
        methodical_files?: any[];
      };
    };
  }
}

// Export prázdného objektu, aby TypeScript rozpoznal tento soubor jako modul
export {};
