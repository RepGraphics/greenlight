/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import {isRpcPath,rpcRequestAllowed,rpcHeaders,rpcHeaderFailure,rpcPathAllowed,boundedRpcBody,RpcBodyError} from './rpcpolicy';
import { appRouter } from '@greenlight/platform';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		if(isRpcPath(url.pathname)) {
			if(!rpcRequestAllowed(request.method,url.search))return new Response('POST RPC requests required',{status:request.method==='POST'?400:405,headers:{...rpcHeaders,Allow:'POST'}});
			const failure=rpcHeaderFailure(request.headers);
			if(failure)return new Response('RPC request rejected',{status:failure,headers:rpcHeaders});
			if(!rpcPathAllowed(url.pathname))return new Response('Invalid RPC path',{status:400,headers:rpcHeaders});
			let body:ArrayBuffer;
			try{body=await boundedRpcBody(request.body)}
			catch(error){return new Response('RPC request rejected',{status:error instanceof RpcBodyError?error.status:400,headers:rpcHeaders})}
			const headers=new Headers(request.headers);
			headers.delete('content-length');
			const boundedRequest=new Request(request.url,{method:'POST',headers,body,signal:request.signal});
			return fetchRequestHandler({
				endpoint: '/trpc',
				req: boundedRequest,
				router: appRouter,
				createContext: () => ({}),
				allowMethodOverride: true,
				responseMeta:()=>({headers:rpcHeaders}),
			});
		} else if(url.pathname === '/') {
			const homepage = new URL('/home/', request.url).href;
			return Response.redirect(homepage, 302);
		} else {
			return new Response('Not Found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;