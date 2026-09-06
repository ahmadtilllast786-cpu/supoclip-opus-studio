/**
 * Ported from SupoClip's smooth_face_crop_trajectory:
 * Eases horizontal camera crop smoothly across detected speaker face coordinates.
 */
export interface FaceTrackingPoint {
  timeSec: number;
  faceCenterX: number; // 0 to 1 fraction
  confidence: number;
}

export class FaceAutoFramingEngine {
  private currentCenterX: number = 0.5;
  private targetCenterX: number = 0.5;
  private smoothingFactor: number = 0.08; // Exponential moving average

  public updateTarget(newTargetX: number) {
    // Clamp to safe margins (0.25 to 0.75 so we never crop off empty space)
    this.targetCenterX = Math.max(0.28, Math.min(0.72, newTargetX));
  }

  public step(deltaTimeSec: number = 1 / 60): number {
    // Smooth ease toward target
    const rate = Math.min(1.0, this.smoothingFactor * (deltaTimeSec * 60));
    this.currentCenterX += (this.targetCenterX - this.currentCenterX) * rate;
    return this.currentCenterX;
  }

  public getCurrentCenterX(): number {
    return this.currentCenterX;
  }
}
