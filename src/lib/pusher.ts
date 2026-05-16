import PusherServer from "pusher";
import PusherClient from "pusher-js";

// Handle CJS/ESM default import interop
const PServer = (PusherServer as any).default || PusherServer;
const PClient = (PusherClient as any).default || PusherClient;

const serverAppId = process.env.PUSHER_APP_ID || process.env.app_id;
const serverKey = process.env.PUSHER_KEY || process.env.key;
const serverSecret = process.env.PUSHER_SECRET || process.env.secret;
const serverCluster = process.env.PUSHER_CLUSTER || process.env.cluster;

const isServerConfigured = !!(serverAppId && serverKey && serverSecret && serverCluster);

export const pusherServer = isServerConfigured
  ? new PServer({
      appId: serverAppId,
      key: serverKey,
      secret: serverSecret,
      cluster: serverCluster,
      useTLS: true,
    })
  : {
      trigger: async () => {
        // No-op in local/dev when Pusher env vars are not configured
      },
    };

// pusher-js (client) often exports the constructor as .Pusher or the default export itself
const PusherClientConstructor = (PClient as any).Pusher || PClient;

const clientKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
const clientCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

export const pusherClient = clientKey && clientCluster
  ? new PusherClientConstructor(clientKey, {
      cluster: clientCluster,
    })
  : null;

