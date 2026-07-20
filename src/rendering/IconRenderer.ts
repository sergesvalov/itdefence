import Phaser from 'phaser';

export class IconRenderer {
  public static drawIcon(scene: Phaser.Scene, x: number, y: number, type: 'tower' | 'furniture', variantOrType: string, radius: number): Phaser.GameObjects.Graphics {
    const gfx = scene.add.graphics({ x, y });

    // Slightly smaller radius to fit inside UI slots nicely
    const r = radius * 0.55;

    if (type === 'tower') {
      if (variantOrType === 'cooler') {
        gfx.fillStyle(0xecf0f1);
        gfx.fillRoundedRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4, 4);
        gfx.lineStyle(1.5, 0xbdc3c7);
        gfx.strokeRoundedRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4, 4);
        gfx.fillStyle(0x3498db, 0.75);
        gfx.fillCircle(0, 0, r * 0.6);
        gfx.fillStyle(0xffffff, 0.4);
        gfx.fillCircle(-r * 0.2, -r * 0.2, r * 0.2);
      } else if (variantOrType === 'router') {
        gfx.fillStyle(0x2c3e50);
        gfx.fillRoundedRect(-r, -r * 0.7, r * 2, r * 1.4, 4);
        gfx.lineStyle(2, 0x34495e);
        gfx.lineBetween(-r * 0.7, -r * 0.7, -r * 0.9, -r * 1.2);
        gfx.lineBetween(r * 0.7, -r * 0.7, r * 0.9, -r * 1.2);
        gfx.fillStyle(0x2ecc71);
        gfx.fillCircle(-r * 0.6, r * 0.4, 2);
        gfx.fillStyle(0xe74c3c);
        gfx.fillCircle(0, r * 0.4, 2);
      } else if (variantOrType === 'docs') {
        gfx.fillStyle(0xf1f2f6);
        gfx.fillRect(-r * 0.8, -r * 0.9, r * 1.6, r * 1.8);
        gfx.fillStyle(0x00b894);
        gfx.fillRect(-r * 0.9, -r * 0.8, r * 1.8, r * 1.6);
        gfx.fillStyle(0x2d3436);
        gfx.fillRect(-r * 0.9, -r * 0.8, 8, r * 1.6);
      } else if (variantOrType === 'coffee') {
        gfx.fillStyle(0x2d3436);
        gfx.fillRoundedRect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8, 6);
        gfx.fillStyle(0x95a5a6);
        gfx.fillRect(-r * 0.6, r * 0.3, r * 1.2, r * 0.4);
        gfx.fillStyle(0xffffff);
        gfx.fillCircle(0, r * 0.1, r * 0.4);
        gfx.fillStyle(0x6F4E37);
        gfx.fillCircle(0, r * 0.1, r * 0.25);
      } else if (variantOrType === 'aircon') {
        gfx.fillStyle(0xdfe6e9);
        gfx.fillRoundedRect(-r * 1.2, -r * 0.6, r * 2.4, r * 1.2, 4);
        gfx.lineStyle(2, 0xb2bec3);
        gfx.strokeRoundedRect(-r * 1.2, -r * 0.6, r * 2.4, r * 1.2, 4);
        gfx.fillStyle(0x636e72);
        gfx.fillRect(-r * 0.8, -r * 0.4, r * 0.8, r * 0.8);
        gfx.fillRect(r * 0.1, -r * 0.4, r * 0.8, r * 0.8);
      } else if (variantOrType === 'partner') {
        gfx.fillStyle(0xd1ccc0);
        gfx.fillRoundedRect(-r * 1.4, -r * 0.9, r * 2.8, r * 1.8, 6);
        gfx.fillStyle(0x84817a);
        gfx.fillRect(-r * 1.4, r * 0.5, r * 2.8, r * 0.4);
        gfx.fillStyle(0x2d3436);
        gfx.fillRect(-r * 0.6, -r * 0.6, r * 1.2, r * 0.8);
      } else {
        // Fallback
        gfx.fillStyle(0xaaaaaa);
        gfx.fillRect(-r, -r, r * 2, r * 2);
      }
    } else {
      if (variantOrType === 'desk') {
        gfx.fillStyle(0xd1ccc0);
        gfx.fillRoundedRect(-r * 1.5, -r * 0.8, r * 3, r * 1.6, 6);
      } else if (variantOrType === 'chair') {
        gfx.fillStyle(0x34495e);
        gfx.fillCircle(0, 0, r * 0.9);
        gfx.fillStyle(0x2c3e50);
        gfx.fillRect(-r * 0.7, -r * 0.9, r * 1.4, r * 0.5);
      } else if (variantOrType === 'cabinet') {
        gfx.fillStyle(0x95a5a6);
        gfx.fillRect(-r * 0.8, -r * 1.2, r * 1.6, r * 2.4);
        gfx.lineStyle(1.5, 0x7f8c8d);
        gfx.lineBetween(-r * 0.8, -r * 0.4, r * 0.8, -r * 0.4);
        gfx.lineBetween(-r * 0.8, r * 0.4, r * 0.8, r * 0.4);
      } else if (variantOrType === 'sofa') {
        gfx.fillStyle(0xe66767);
        gfx.fillRoundedRect(-r * 1.6, -r * 0.9, r * 3.2, r * 1.8, 6);
        gfx.fillStyle(0xc44569);
        gfx.fillRect(-r * 1.6, -r * 0.9, r * 0.4, r * 1.8);
        gfx.fillRect(r * 1.2, -r * 0.9, r * 0.4, r * 1.8);
      } else {
        // Fallback
        gfx.fillStyle(0x888888);
        gfx.fillRect(-r, -r, r * 2, r * 2);
      }
    }

    return gfx;
  }
}
