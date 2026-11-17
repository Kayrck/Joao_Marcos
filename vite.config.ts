import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

/** Substitui %SITE_URL% no index.html (metadados Open Graph exigem URL absoluta). */
function siteUrlPlugin(siteUrl: string) {
  return {
    name: 'site-url-html',
    transformIndexHtml: (html: string) => html.replaceAll('%SITE_URL%', siteUrl),
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = (env.SITE_URL || 'https://jo-o-marcos.vercel.app').replace(/\/+$/, '')
  const api = `http://localhost:${env.API_PORT || 8787}`

  return {
    plugins: [
      figmaAssetResolver(),
      siteUrlPlugin(siteUrl),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],

    build: {
      rollupOptions: {
        output: {
          // o painel (gráficos etc.) fica fora do pacote do site público
          manualChunks(id: string) {
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts'
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'react'
          },
        },
      },
    },

    // --- CONFIGURAÇÃO PARA O DOCKER / DESENVOLVIMENTO ---
    server: {
      host: true, // Isso diz ao Vite para ouvir conexões de fora (0.0.0.0)
      port: 5173,
      watch: {
        usePolling: true, // Isso ajuda o Windows a atualizar a tela sozinho quando você altera o código
      },
      // A API roda em outro processo (npm run dev:api); em produção ela é uma função da Vercel no mesmo domínio.
      // changeOrigin:false mantém o Host do navegador (a API compara Origin × Host na proteção CSRF)
      proxy: {
        '/api': { target: api, changeOrigin: false },
        '/uploads': { target: api, changeOrigin: false },
        '/robots.txt': { target: api, changeOrigin: false },
        '/sitemap.xml': { target: api, changeOrigin: false },
      },
    },
  }
})
