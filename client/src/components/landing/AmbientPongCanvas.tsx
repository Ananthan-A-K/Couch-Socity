import React, { useEffect, useRef } from 'react';

export const AmbientPongCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Ball state
    let ballX = width / 2;
    let ballY = height / 2;
    let ballSpeedX = 1.2;
    let ballSpeedY = 0.8;
    const ballSize = 6;

    // Paddle positions
    let leftPaddleY = height / 2 - 35;
    let rightPaddleY = height / 2 - 35;
    const paddleWidth = 4;
    const paddleHeight = 70;
    const paddleMargin = 28;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Subtle Center Line (minimalist dotted)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Move ball
      ballX += ballSpeedX;
      ballY += ballSpeedY;

      // Bounce top/bottom
      if (ballY - ballSize / 2 <= 0) {
        ballY = ballSize / 2;
        ballSpeedY = Math.abs(ballSpeedY);
      } else if (ballY + ballSize / 2 >= height) {
        ballY = height - ballSize / 2;
        ballSpeedY = -Math.abs(ballSpeedY);
      }

      // Smoothly track paddles to ball with lazy chill delay
      leftPaddleY += (ballY - (leftPaddleY + paddleHeight / 2)) * 0.04;
      rightPaddleY += (ballY - (rightPaddleY + paddleHeight / 2)) * 0.04;

      // Bound paddles
      leftPaddleY = Math.max(10, Math.min(height - paddleHeight - 10, leftPaddleY));
      rightPaddleY = Math.max(10, Math.min(height - paddleHeight - 10, rightPaddleY));

      // Left paddle collision
      const leftPaddleX = paddleMargin;
      if (
        ballX - ballSize / 2 <= leftPaddleX + paddleWidth &&
        ballY >= leftPaddleY &&
        ballY <= leftPaddleY + paddleHeight
      ) {
        ballSpeedX = Math.abs(ballSpeedX);
        ballX = leftPaddleX + paddleWidth + ballSize / 2;
      }

      // Right paddle collision
      const rightPaddleX = width - paddleMargin - paddleWidth;
      if (
        ballX + ballSize / 2 >= rightPaddleX &&
        ballY >= rightPaddleY &&
        ballY <= rightPaddleY + paddleHeight
      ) {
        ballSpeedX = -Math.abs(ballSpeedX);
        ballX = rightPaddleX - ballSize / 2;
      }

      // Reset if out of bounds
      if (ballX < 0 || ballX > width) {
        ballX = width / 2;
        ballY = height / 2;
        ballSpeedX = (Math.random() > 0.5 ? 1.2 : -1.2);
        ballSpeedY = (Math.random() * 1.2 - 0.6);
      }

      // Draw Paddles
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.fillRect(leftPaddleX, leftPaddleY, paddleWidth, paddleHeight);
      ctx.fillRect(rightPaddleX, rightPaddleY, paddleWidth, paddleHeight);

      // Draw Ball
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(ballX - ballSize / 2, ballY - ballSize / 2, ballSize, ballSize);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-70"
    />
  );
};
