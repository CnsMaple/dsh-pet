/**
 * 拖拽跟随与几何的共享出口（精简版）：已删除抛掷/碰撞/挤压等物理引擎实现，仅保留常量、弹簧、身体包围盒换算与 Q 弹曲线。
 * @module dsh-pet/src/shared/physics
 */
export { DEFAULT_PHYSICS, DEFAULT_THROW_POWER, GRAVITY, GROUND_FRICTION, MAX_THROW_SPEED, RESTITUTION, THROW_SPEED_ANCHOR, SQ_DURATION_MS, SQ_SQUASH, SQ_MAX_SQUASH, SQ_HARD_SPEED, SQ_SOFT_SPEED, SPRING_C, SPRING_K, } from './physics/constants.ts';
export { softClampSpeed, springStep } from './physics/spring.ts';
export { bodyPixelBox } from './physics/collide.ts';
export { landingSquash, squashScale } from './physics/squash.ts';
