/**
 * 远程显示层的宿主侧 RPC 服务：把 /dsh-pet-7340 业务路由通过 HTTP 暴露给 Windows 显示层。
 *
 * 与本地 Helper 的 stdout 管道是一对孪生：`POST /rpc` 收一条 BridgeRequest、用同一份 handlePetRoute
 * 应答；素材因为跨机器读不到宿主绝对路径，改成回一个 `assetUrl`，由显示层再 GET `/asset` 流式拉取。
 * 必须始终成立：除 `GET /health` 外每个请求都要带远程令牌，令牌只驻内存、不进日志。
 * @module dsh-pet/src/host/plugin/remote-display/server
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readBody, sendFile, type RouteResult } from '../../http.ts';
import { toBridgeResponse } from '../desktop/bridge-response.ts';
import type { HttpRouteHandler } from '../http-route.ts';

/** 远程 RPC 的应答体：素材走 `assetUrl`（绝对地址，需带令牌再拉），其余走 `body`。 */
interface RemoteRpcResponse {
  readonly id: number;
  readonly status: number;
  readonly contentType?: string;
  readonly body?: string;
  readonly assetUrl?: string;
}

/** 远程显示服务的构造参数。 */
export interface RemoteDisplayServerOptions {
  /** 业务路由处理函数（与本地 Helper 管道、DSH 路由完全同一份）。 */
  readonly handlePetRoute: HttpRouteHandler;
  /** 日志出口。 */
  readonly log: { info(message: string): void; warn(message: string): void };
  /** 监听端口偏好；被占用时向后顺延。 */
  readonly port: number;
  /** 监听地址，默认 0.0.0.0（Windows 需能访问）。 */
  readonly bindHost?: string;
  /** 对外宣告的主机名/IP（拼 assetUrl 用）：显示层能访问到的那个地址。 */
  readonly advertiseHost: string;
}

/** 远程显示服务句柄。 */
export interface RemoteDisplayServer {
  /** 实际监听端口。 */
  readonly port: number;
  /** 进程内远程令牌；只写进连接文件，不进日志。 */
  readonly token: string;
  /** 显示层应连接的基址，形如 `http://<ip>:<port>`。 */
  readonly baseUrl: string;
  /** 关闭服务并释放连接。 */
  close(): Promise<void>;
}

/** 端口顺延上限：从偏好端口起最多试这么多个。 */
const PORT_SCAN_LIMIT = 20;

/** 定时安全地比较令牌；形状不符直接判否（避免长度泄漏）。 */
function tokenEquals(supplied: unknown, expected: string): boolean {
  if (typeof supplied !== 'string') return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 从请求里取令牌：优先请求头，其次查询串 `token`（后者只给手动/测试用）。 */
function requestToken(req: IncomingMessage): unknown {
  const header = req.headers['x-dsh-pet-remote-token'];
  if (typeof header === 'string') return header;
  try {
    return new URL(req.url ?? '/', 'http://127.0.0.1').searchParams.get('token') ?? undefined;
  } catch {
    return undefined;
  }
}

/** 把一次业务结果翻成远程 RPC 应答：素材回 assetUrl，其余沿用管道应答的形状。 */
function toRemoteRpcResponse(
  id: number,
  result: RouteResult,
  baseUrl: string,
  token: string,
  routeUrl: string,
): RemoteRpcResponse {
  const pipe = toBridgeResponse(id, result);
  if (pipe.file !== undefined) {
    const assetUrl = `${baseUrl}/asset?u=${encodeURIComponent(routeUrl)}&token=${encodeURIComponent(token)}`;
    return { id, status: 200, contentType: pipe.contentType, assetUrl };
  }
  return { id, status: pipe.status, contentType: pipe.contentType, body: pipe.body };
}

/** 收集并解析 JSON 请求体；超过上限或非法 JSON 时返回 undefined。 */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  try {
    const text = await readBody(req);
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** 回一个 JSON 应答。 */
function writeJson(res: ServerResponse, status: number, obj: unknown): void {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

/** 建一个把插件业务路由暴露给显示层的服务监听器（不含端口绑定）。 */
function createListener(
  options: RemoteDisplayServerOptions,
  token: string,
  baseUrlOf: () => string,
): (req: IncomingMessage, res: ServerResponse) => void {
  const { handlePetRoute, log } = options;
  return (req, res) => {
    let pathname: string;
    try {
      pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    } catch {
      writeJson(res, 400, { error: 'bad-url' });
      return;
    }
    if (pathname === '/health') {
      writeJson(res, 200, { ok: true, name: 'dsh-pet-remote-display', pid: process.pid });
      return;
    }
    if (!tokenEquals(requestToken(req), token)) {
      writeJson(res, 403, { error: 'forbidden' });
      return;
    }
    if (pathname === '/rpc') {
      void handleRpc(req, res);
      return;
    }
    if (pathname === '/asset') {
      void handleAsset(req, res);
      return;
    }
    writeJson(res, 404, { error: 'not-found' });
  };

  /** POST /rpc：一条 BridgeRequest → handlePetRoute → RemoteRpcResponse。 */
  async function handleRpc(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      writeJson(res, 405, { error: 'method-not-allowed' });
      return;
    }
    const body = await readJsonBody(req);
    const id = Number(body?.id);
    if (!body || !Number.isFinite(id) || typeof body.url !== 'string') {
      writeJson(res, 400, { error: 'bad-request' });
      return;
    }
    const method = typeof body.method === 'string' && body.method ? body.method : 'GET';
    const text = typeof body.body === 'string' ? body.body : undefined;
    try {
      const result = await handlePetRoute(body.url, method, text);
      writeJson(res, 200, toRemoteRpcResponse(id, result, baseUrlOf(), token, body.url));
    } catch (e) {
      log.warn('[dsh-pet] remote rpc failed: ' + (e instanceof Error ? e.message : String(e)));
      writeJson(res, 200, {
        id,
        status: 500,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ error: 'rpc-handler-error' }),
      });
    }
  }

  /** GET /asset?u=<原始路由地址>：按同一份业务路由解析出文件，再用 sendFile 支持 Range 流式返回。 */
  async function handleAsset(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      writeJson(res, 405, { error: 'method-not-allowed' });
      return;
    }
    let routeUrl: string | null = null;
    try {
      routeUrl = new URL(req.url ?? '/', 'http://127.0.0.1').searchParams.get('u');
    } catch {
      /* 保留 null，下面统一判空 */
    }
    if (!routeUrl) {
      writeJson(res, 400, { error: 'missing-u' });
      return;
    }
    try {
      const result = await handlePetRoute(routeUrl, 'GET');
      if (result.kind !== 'file') {
        writeJson(res, 404, { error: 'not-a-file' });
        return;
      }
      sendFile(req, res, result.file, result.contentType);
    } catch (e) {
      log.warn('[dsh-pet] remote asset failed: ' + (e instanceof Error ? e.message : String(e)));
      writeJson(res, 500, { error: 'asset-failed' });
    }
  }
}

/** 从偏好端口起逐个尝试绑定，只吞 EADDRINUSE。 */
async function bindServer(server: Server, preferred: number, host: string): Promise<number> {
  for (let port = preferred; port < preferred + PORT_SCAN_LIMIT; port += 1) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = (): void => {
          server.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
      });
      const addr = server.address();
      return typeof addr === 'object' && addr !== null ? addr.port : port;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error(`从 ${preferred} 起连续 ${PORT_SCAN_LIMIT} 个端口都被占用`);
}

/**
 * 启动远程显示服务。
 *
 * @param options - 业务路由、日志、端口与对外地址。
 * @returns 监听端口、令牌、基址与关闭函数。
 */
export async function startRemoteDisplayServer(options: RemoteDisplayServerOptions): Promise<RemoteDisplayServer> {
  const token = randomBytes(32).toString('base64url');
  let baseUrl = '';
  const server = createServer(createListener(options, token, () => baseUrl));
  server.on('clientError', (_error, socket) => socket.destroy());
  const port = await bindServer(server, options.port, options.bindHost ?? '0.0.0.0');
  baseUrl = `http://${options.advertiseHost}:${port}`;
  options.log.info(`[dsh-pet] 远程显示服务已监听 ${options.bindHost ?? '0.0.0.0'}:${port}（对外 ${baseUrl}）`);
  return {
    port,
    token,
    baseUrl,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
