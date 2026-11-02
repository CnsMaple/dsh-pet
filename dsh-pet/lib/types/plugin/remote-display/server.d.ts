import type { HttpRouteHandler } from '../http-route.ts';
/** 远程显示服务的构造参数。 */
export interface RemoteDisplayServerOptions {
    /** 业务路由处理函数（与本地 Helper 管道、DSH 路由完全同一份）。 */
    readonly handlePetRoute: HttpRouteHandler;
    /** 日志出口。 */
    readonly log: {
        info(message: string): void;
        warn(message: string): void;
    };
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
/**
 * 启动远程显示服务。
 *
 * @param options - 业务路由、日志、端口与对外地址。
 * @returns 监听端口、令牌、基址与关闭函数。
 */
export declare function startRemoteDisplayServer(options: RemoteDisplayServerOptions): Promise<RemoteDisplayServer>;
