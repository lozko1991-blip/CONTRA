/**
 * SurfaceDetector — визначає матеріал поверхні під позицією.
 *
 * Raycast стартує трохи нижче "стоп", тому ніколи
 * не влучає у власні коллайдери гравця чи бота.
 */
export function detectSurface(physics, position, height = 1.8) {
  if (!physics?.world) {
    return 'concrete';
  }

  const originY = position.y - height / 2 - 0.06;

  try {
    const hit = physics.raycast(
      {
        x: position.x,
        y: originY,
        z: position.z
      },
      {
        x: 0,
        y: -1,
        z: 0
      },
      0.8,
      null
    );

    return hit?.userData?.material ?? 'concrete';
  } catch {
    return 'concrete';
  }
}
