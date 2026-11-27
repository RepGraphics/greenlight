import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';

import pkg from '../package.json';

import authController from './controller/auth.js';
import profileController from './controller/profile.js';
import smartglassController from './controller/smartglass.js';
import gamepassController from './controller/gamepass.js';

import {
  startStream,
  getStreamStatus,
  sendSDPOffer,
  sendChatSDP,
  sendICECandidates,
  sendMsalToken,
  sendKeepalive,
  stopStream
 } from '@greenlight/player/server'

const t = initTRPC.create();
export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

const auth = new authController();
const profile = new profileController();
const smartglass = new smartglassController();
const gamepass = new gamepassController();

const zodWebToken = z.object({
  uhs: z.string(),
  token: z.string(),
})

const zodXhomeToken = z.object({
  token: z.string(),
  market: z.string(),
  language: z.string(),
})

const zodUserToken = z.object({
  token_type: z.string(),
  scope: z.string(),
  expires_in: z.number(),
  ext_expires_in: z.number(),
  access_token: z.string(),
  refresh_token: z.string(),
  id_token: z.string(),
})

const xCloudStreamConfig = z.object({
    id: z.string(),
    type: z.enum(['home', 'cloud']),
    language: z.string(),
    host: z.string().max(253),
    resolution: z.union([z.literal(720), z.literal(1080)])
})

function provisionError(cause: unknown) {
    const status = (cause as {error?: {status?: unknown}} | null)?.error?.status
    switch (status) {
        case 400: return new TRPCError({code:'BAD_REQUEST',message:'Xbox rejected the streaming target.'})
        case 401:
        case 403: return new TRPCError({code:'UNAUTHORIZED',message:'Xbox rejected stream authorization.'})
        case 404: return new TRPCError({code:'NOT_FOUND',message:'The Xbox streaming target was unavailable.'})
        case 409: return new TRPCError({code:'CONFLICT',message:'Xbox reported a session conflict.'})
        case 429: return new TRPCError({code:'TOO_MANY_REQUESTS',message:'Xbox is limiting new sessions.'})
        default: return new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Xbox session startup could not be confirmed.'})
    }
}

export const appRouter = router({
    ping: publicProcedure.query(() => 'pong'),
    version: publicProcedure.query(() => pkg.version),
    echo: publicProcedure.input(z.string()).query(({ input }) => `echo: ${input}`),

    auth_msal_start: publicProcedure.query(async () => await auth.startMsalAuth()),
    auth_msal_verify: publicProcedure.input(z.string()).query(async ({ input }) => await auth.verifyDeviceCode(input)),
    auth_msal_refresh: publicProcedure.input(zodUserToken).query(async ({ input }) => await auth.refreshUserToken(input)),
    auth_get_streamingtokens: publicProcedure.input(zodUserToken).query(async ({ input }) => await auth.getStreamingTokens(input)),
    auth_get_webtoken: publicProcedure.input(zodUserToken).query(async ({ input }) => await auth.getWebToken(input)),

    profile_get_current: publicProcedure.input(zodWebToken).query(async ({ input }) => await profile.getCurrentProfile(input)),
    profile_get_friends: publicProcedure.input(zodWebToken).query(async ({ input }) => await profile.getFriendsList(input)),
    
    smartglass_consoles_list: publicProcedure.input(zodWebToken).query(async ({ input }) => await smartglass.getConsolesList(input)),

    gamepass_get_titles: publicProcedure.input(zodXhomeToken).query(async ({ input }) => await gamepass.getTitles(input)),
    gamepass_get_recent_titles: publicProcedure.input(zodXhomeToken).query(async ({ input }) => await gamepass.getRecentTitles(input)),
    gamepass_get_new_titles: publicProcedure.input(zodXhomeToken).query(async ({ input }) => await gamepass.getNewTitles(input)),

    gamepass_batch_productids: publicProcedure.input(z.object({ token: zodXhomeToken, productIds: z.array(z.string().min(1).max(128)).min(1).max(100) })).query(async ({ input }) => await gamepass.resolveTitles(input.token, input.productIds)),
    gamepass_resolve_productid: publicProcedure.input(z.object({ token: zodXhomeToken, productId: z.string().min(1).max(128) })).query(async ({ input }) => await gamepass.resolveTitle(input.token, input.productId)),

    streaming_stop_stream: publicProcedure.input(z.object({ token: zodXhomeToken, xCloudStreamConfig: xCloudStreamConfig, sessionPath: z.string().max(256) })).mutation(async ({ input }) => await stopStream(input.token, input.xCloudStreamConfig, input.sessionPath)),
    streaming_start_stream: publicProcedure.input(z.object({ token: zodXhomeToken, xCloudStreamConfig: xCloudStreamConfig })).mutation(async ({ input }) => {
        try {return await startStream(input.token, input.xCloudStreamConfig)}
        catch (cause) {throw provisionError(cause)}
    }),
    streaming_get_status: publicProcedure.input(z.object({ token: zodXhomeToken, xCloudStreamConfig: xCloudStreamConfig, sessionPath: z.string().max(256) })).mutation(async ({ input }) => await getStreamStatus(input.token, input.xCloudStreamConfig, input.sessionPath)),
    streaming_send_sdp_offer: publicProcedure.input(z.object({ token: zodXhomeToken, xCloudStreamConfig: xCloudStreamConfig, sessionPath: z.string().max(256), sdpOffer: z.any() })).mutation(async ({ input }) => await sendSDPOffer(input.token, input.xCloudStreamConfig, input.sessionPath, input.sdpOffer)),
    streaming_send_chat_sdp: publicProcedure.input(z.object({ token: zodXhomeToken, xCloudStreamConfig: xCloudStreamConfig, sessionPath: z.string().max(256), offer: z.object({type:z.literal('offer'),sdp:z.string().min(1).max(262144)}) })).mutation(async ({input})=>await sendChatSDP(input.token,input.xCloudStreamConfig,input.sessionPath,input.offer)),
    streaming_send_ice_candidates: publicProcedure.input(z.object({ token: zodXhomeToken, xCloudStreamConfig: xCloudStreamConfig, sessionPath: z.string().max(256), candidates: z.array(z.any()) })).mutation(async ({ input }) => await sendICECandidates(input.token, input.xCloudStreamConfig, input.sessionPath, input.candidates)),
    streaming_send_msal_token: publicProcedure.input(z.object({ token: zodXhomeToken, xCloudStreamConfig: xCloudStreamConfig, sessionPath: z.string().max(256), refreshToken: z.string() })).mutation(async ({ input }) => await sendMsalToken(input.token, input.xCloudStreamConfig, input.sessionPath, input.refreshToken)),
    streaming_send_keepalive: publicProcedure.input(z.object({ token: zodXhomeToken, xCloudStreamConfig: xCloudStreamConfig, sessionPath: z.string().max(256) })).mutation(async ({ input }) => await sendKeepalive(input.token, input.xCloudStreamConfig, input.sessionPath)),
});

export default appRouter;
