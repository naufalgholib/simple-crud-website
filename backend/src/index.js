import cluster from 'node:cluster';
import os from 'node:os';

const configuredWorkers = Number(process.env.WEB_CONCURRENCY || 0);
const workerCount = configuredWorkers > 0
  ? configuredWorkers
  : Math.max(1, os.availableParallelism());

if (cluster.isPrimary) {
  let shuttingDown = false;

  console.log(`[cluster] primary ${process.pid} starting ${workerCount} worker(s)`);

  for (let index = 0; index < workerCount; index += 1) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`[cluster] worker ${worker.process.pid} exited code=${code} signal=${signal}`);
    if (!shuttingDown) cluster.fork();
  });

  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[cluster] received ${signal}, stopping workers`);

    for (const worker of Object.values(cluster.workers)) {
      worker?.process.kill('SIGTERM');
    }

    const forceTimer = setTimeout(() => process.exit(1), 10_000);
    forceTimer.unref();

    cluster.disconnect(() => process.exit(0));
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
} else {
  await import('./server.js');
}
