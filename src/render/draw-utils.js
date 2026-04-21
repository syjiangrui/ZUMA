// Pure canvas helpers — no game state, only ctx and geometry params.
// Split out from render.js to isolate reusable primitives.

export function traceRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function fillRoundedRect(ctx, x, y, width, height, radius) {
  traceRoundedRect(ctx, x, y, width, height, radius);
  ctx.fill();
}

export function drawStonePanel(ctx, x, y, width, height, radius, options = {}) {
  const {
    top = "#7a8590",
    bottom = "#636e78",
    stroke = "rgba(94, 72, 43, 0.88)",
    innerStroke = "rgba(247, 227, 181, 0.16)",
    shadow = "rgba(0, 0, 0, 0.16)",
  } = options;

  ctx.save();

  ctx.fillStyle = shadow;
  fillRoundedRect(ctx, x, y + 4, width, height, radius);

  const fill = ctx.createLinearGradient(x, y, x, y + height);
  fill.addColorStop(0, top);
  fill.addColorStop(0.48, bottom);
  fill.addColorStop(1, bottom);
  ctx.fillStyle = fill;
  fillRoundedRect(ctx, x, y, width, height, radius);

  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  fillRoundedRect(ctx, x + 4, y + 4, width - 8, Math.max(12, height * 0.28), radius - 4);

  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  traceRoundedRect(ctx, x, y, width, height, radius);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.strokeStyle = innerStroke;
  traceRoundedRect(ctx, x + 3, y + 3, width - 6, height - 6, Math.max(4, radius - 3));
  ctx.stroke();

  ctx.restore();
}

export function makeHorizontalTextureSeamless(ctx, width, height, seamWidth) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const original = new Uint8ClampedArray(imageData.data);

  for (let x = 0; x < seamWidth; x += 1) {
    const leftX = x;
    const rightX = width - seamWidth + x;

    for (let y = 0; y < height; y += 1) {
      const leftIndex = (y * width + leftX) * 4;
      const rightIndex = (y * width + rightX) * 4;

      for (let channel = 0; channel < 4; channel += 1) {
        const mixed = Math.round(
          (original[leftIndex + channel] + original[rightIndex + channel]) * 0.5,
        );
        imageData.data[leftIndex + channel] = mixed;
        imageData.data[rightIndex + channel] = mixed;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
