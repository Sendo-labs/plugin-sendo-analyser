#!/usr/bin/env bun

/**
 * Serveur de test HTTP pour les routes du plugin Sendo Analyser
 * 
 * Usage:
 *   bun run test-routes.ts [port]
 * 
 * Exemple:
 *   bun run test-routes.ts 3333
 * 
 * Le serveur reste actif et vous pouvez tester les routes avec:
 *   curl http://localhost:3333/trades/2fg5QD1eD7rzNNCsvnhmXFm5hqNgwTTG8p7kQ6f3rx6f?limit=5
 */

import { sendoAnalyserPlugin, SendoAnalyserService } from '../index.js';
import type { IAgentRuntime } from '@elizaos/core';
import http from 'http';
import { URL } from 'url';

// Port du serveur (par défaut 3333)
const PORT = parseInt(process.argv[2] || '3333', 10);

// Mock runtime minimal pour les tests
class MockRuntime {
  private services: Map<string, any> = new Map();
  private settings: Map<string, string> = new Map();

  constructor() {
    // Charger les variables d'environnement
    if (process.env.HELIUS_API_KEY) {
      this.settings.set('HELIUS_API_KEY', process.env.HELIUS_API_KEY);
    }
    if (process.env.BIRDEYE_API_KEY) {
      this.settings.set('BIRDEYE_API_KEY', process.env.BIRDEYE_API_KEY);
    }
    if (process.env.BIRDEYE_RATE_LIMIT) {
      this.settings.set('BIRDEYE_RATE_LIMIT', process.env.BIRDEYE_RATE_LIMIT);
    }
    if (process.env.HELIUS_RATE_LIMIT) {
      this.settings.set('HELIUS_RATE_LIMIT', process.env.HELIUS_RATE_LIMIT);
    }

    // Initialiser le service
    if (this.settings.has('HELIUS_API_KEY')) {
      try {
        const service = new SendoAnalyserService(this as any);
        this.services.set('sendo_analyser', service);
        console.log('✅ Service SendoAnalyserService initialisé');
      } catch (error: any) {
        console.error('❌ Erreur lors de l\'initialisation du service:', error.message);
        process.exit(1);
      }
    } else {
      console.error('❌ HELIUS_API_KEY n\'est pas défini dans les variables d\'environnement');
      process.exit(1);
    }
  }

  getService<T>(name: string): T | null {
    return (this.services.get(name) as T) || null;
  }

  getSetting(key: string): string | undefined {
    return this.settings.get(key);
  }
}

// Fonction pour trouver la route correspondante
function findRoute(pathname: string, method: string): { route: any; params: Record<string, string> } | null {
  if (!sendoAnalyserPlugin.routes) {
    return null;
  }

  for (const route of sendoAnalyserPlugin.routes) {
    if (route.type !== method) {
      continue;
    }

    // Vérifier si le pathname correspond au pattern de la route
    const routeParts = route.path.split('/');
    const pathParts = pathname.split('/');

    if (routeParts.length !== pathParts.length) {
      continue;
    }

    const params: Record<string, string> = {};
    let matches = true;

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        const paramName = routeParts[i].slice(1);
        params[paramName] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return { route, params };
    }
  }

  return null;
}

// Fonction principale - Créer et démarrer le serveur HTTP
async function startServer() {
  console.log('🚀 Démarrage du serveur de test pour le plugin Sendo Analyser\n');

  // Créer le runtime mock
  const runtime = new MockRuntime();

  // Initialiser le plugin (optionnel pour le serveur de test)
  try {
    if (sendoAnalyserPlugin.init) {
      await (sendoAnalyserPlugin.init as any)({}, runtime);
      console.log('✅ Plugin initialisé\n');
    }
  } catch (error: any) {
    // L'initialisation n'est pas critique pour le serveur de test
    console.log('⚠️  Note: Initialisation du plugin ignorée (non critique)\n');
  }

  // Créer le serveur HTTP
  const server = http.createServer(async (req, res) => {
    // Gérer CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Gérer les requêtes OPTIONS (preflight)
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      const pathname = url.pathname;
      const method = req.method || 'GET';

      // Route spéciale pour la page d'accueil
      if (pathname === '/' || pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Sendo Analyser Test Server',
          routes: sendoAnalyserPlugin.routes?.map(r => ({
            method: r.type,
            path: r.path,
            example: r.path.replace(':address', 'YOUR_ADDRESS')
          })) || []
        }));
        return;
      }

      // Trouver la route correspondante
      const routeMatch = findRoute(pathname, method);

      if (!routeMatch) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: {
            code: 'ROUTE_NOT_FOUND',
            message: `Route ${method} ${pathname} not found`
          }
        }));
        return;
      }

      const { route, params } = routeMatch;

      // Extraire les query parameters
      const query: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        query[key] = value;
      });

      // Créer les objets mock req et res
      const mockReq = {
        params,
        query,
        method,
        url: pathname,
        headers: req.headers,
      };

      const mockRes = {
        writeHead: (status: number, headers: any) => {
          res.writeHead(status, {
            'Content-Type': 'application/json',
            ...headers
          });
        },
        end: (data: string) => {
          res.end(data);
        },
      };

      // Logger la requête
      console.log(`📥 ${method} ${pathname}${url.search ? url.search : ''}`);

      // Appeler le handler de la route
      if (route.handler) {
        await route.handler(mockReq, mockRes, runtime);
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: {
            code: 'HANDLER_NOT_FOUND',
            message: 'Route handler not found'
          }
        }));
      }

    } catch (error: any) {
      console.error('❌ Erreur lors du traitement de la requête:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Internal server error'
        }
      }));
    }
  });

  // Démarrer le serveur
  server.listen(PORT, () => {
    console.log(`✅ Serveur démarré sur http://localhost:${PORT}\n`);
    console.log('📋 Routes disponibles:\n');
    
    if (sendoAnalyserPlugin.routes && sendoAnalyserPlugin.routes.length > 0) {
      sendoAnalyserPlugin.routes.forEach((route, index) => {
        const examplePath = route.path.replace(':address', 'YOUR_ADDRESS');
        console.log(`   ${index + 1}. ${route.type} ${route.path}`);
        console.log(`      → http://localhost:${PORT}${examplePath}`);
        if (route.path.includes('limit')) {
          console.log(`      → http://localhost:${PORT}${examplePath}?limit=5&cursor=optional`);
        }
        console.log('');
      });
    }

    console.log('💡 Exemples de commandes curl:\n');
    console.log(`   # Tester les signatures`);
    console.log(`   curl "http://localhost:${PORT}/signatures/YOUR_ADDRESS?limit=5"\n`);
    console.log(`   # Tester les trades`);
    console.log(`   curl "http://localhost:${PORT}/trades/YOUR_ADDRESS?limit=5"\n`);
    console.log(`   # Tester les transactions`);
    console.log(`   curl "http://localhost:${PORT}/transactions/YOUR_ADDRESS?limit=5"\n`);
    console.log(`   # Tester les tokens`);
    console.log(`   curl "http://localhost:${PORT}/tokens/YOUR_ADDRESS"\n`);
    console.log(`   # Tester les NFTs`);
    console.log(`   curl "http://localhost:${PORT}/nfts/YOUR_ADDRESS"\n`);
    console.log(`   # Tester le global`);
    console.log(`   curl "http://localhost:${PORT}/global/YOUR_ADDRESS"\n`);
    console.log(`   # Tester l'analyse complète`);
    console.log(`   curl "http://localhost:${PORT}/wallet/YOUR_ADDRESS"\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🟢 Serveur actif - Appuyez sur Ctrl+C pour arrêter\n');
  });

  // Gérer l'arrêt propre
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Arrêt du serveur...');
    server.close(() => {
      console.log('✅ Serveur arrêté');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('\n\n🛑 Arrêt du serveur...');
    server.close(() => {
      console.log('✅ Serveur arrêté');
      process.exit(0);
    });
  });
}

// Démarrer le serveur
startServer().catch(error => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});

