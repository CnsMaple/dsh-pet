/** 身体包围盒（HIT_BOX 命中框比例换算到视口像素）。
 *  box = 宠物包围盒左上角；bottomPad = 舞台脚底垫高。 */
export declare const bodyPixelBox: (o: {
    x: number;
    y: number;
    size: number;
    bottomPad: number;
}) => {
    left: number;
    top: number;
    right: number;
    bottom: number;
};
